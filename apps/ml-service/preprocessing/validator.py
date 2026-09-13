import os
import re
import io
import hashlib
import ipaddress
import urllib.parse
import numpy as np
from typing import Tuple, Optional, Union
from PIL import Image

# Enforce strict decompression bomb safety: maximum 16 megapixels (e.g. 4096 x 4096)
Image.MAX_IMAGE_PIXELS = 16_000_000

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB maximum
MIN_DIMENSION = 32
MAX_DIMENSION = 4096

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # Cloud metadata endpoint
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def is_ssrf_safe_url(url: str) -> bool:
    """Validates that a remote URL is safe from SSRF attacks."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = parsed.hostname
        if not hostname or hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
            return False

        # If hostname is an IP literal, verify it is public
        try:
            ip = ipaddress.ip_address(hostname)
            for network in BLOCKED_IP_NETWORKS:
                if ip in network:
                    return False
        except ValueError:
            # Hostname is a domain name
            if hostname.endswith(".local") or hostname.endswith(".internal"):
                return False

        return True
    except Exception:
        return False


def validate_image_payload(image_payload: str) -> bool:
    """Validates whether image payload is a well-formed safe HTTP(S) URL, local file path, or valid base64 data URI."""
    if not image_payload:
        return True
    if os.path.exists(image_payload):
        return True
    if image_payload.startswith(("http://", "https://")):
        return is_ssrf_safe_url(image_payload)
    if image_payload.startswith("data:image/"):
        match = re.match(r"^data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$", image_payload)
        if not match:
            return False
        try:
            import base64
            raw_b64 = match.group(1)
            decoded = base64.b64decode(raw_b64, validate=True)
            return len(decoded) > 0
        except Exception:
            return False
    return False


def compute_image_hashes(image: Image.Image) -> Tuple[str, str]:
    """Computes MD5 hash of raw bytes and a 64-bit perceptual hash (aHash) for duplicate detection."""
    # Byte MD5
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    raw_md5 = hashlib.md5(buf.getvalue()).hexdigest()

    # Perceptual average hash (aHash 8x8)
    resized = image.convert("L").resize((8, 8), Image.Resampling.LANCZOS)
    pixels = np.array(resized, dtype=np.float32).flatten()
    avg = float(np.mean(pixels))
    bits = "".join("1" if p >= avg else "0" for p in pixels)
    phash = f"{int(bits, 2):016x}"

    return raw_md5, phash


def validate_and_load_image(
    image_input: Union[bytes, str],
    check_duplicates: bool = False
) -> Tuple[Optional[Image.Image], Optional[str], Optional[dict]]:
    """
    Validates, sanitizes, and safely decodes an image payload.
    Supports raw bytes, base64 data URI, or file path.
    Returns: (PIL.Image, error_message, metadata_dict)
    """
    try:
        raw_bytes: bytes

        if isinstance(image_input, bytes):
            raw_bytes = image_input
        elif isinstance(image_input, str):
            if image_input.startswith("data:image/"):
                match = re.match(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$", image_input)
                if not match:
                    return None, "Malformed base64 data URI format or unsupported MIME type", None
                mime = match.group(1)
                import base64
                try:
                    raw_bytes = base64.b64decode(match.group(2), validate=True)
                except Exception:
                    return None, "Invalid base64 payload encoding", None
            elif image_input.startswith(("http://", "https://")):
                if not is_ssrf_safe_url(image_input):
                    return None, "URL rejected due to SSRF security policy", None
                # Do not perform remote HTTP downloads inside offline test/validation routines
                return None, "Remote URL loading requires explicit stream fetching", None
            else:
                # File path
                import os
                if not os.path.exists(image_input):
                    return None, f"Image file not found: {image_input}", None
                with open(image_input, "rb") as f:
                    raw_bytes = f.read()
        else:
            return None, "Unsupported image input type", None

        # Size check
        if len(raw_bytes) == 0:
            return None, "Empty image payload (0 bytes)", None
        if len(raw_bytes) > MAX_FILE_BYTES:
            return None, f"Image payload exceeds maximum limit of {MAX_FILE_BYTES // (1024*1024)}MB", None

        # PIL integrity check
        byte_stream = io.BytesIO(raw_bytes)
        try:
            with Image.open(byte_stream) as img:
                img.verify()
        except Exception as e:
            return None, f"Corrupted or invalid image data: {str(e)}", None

        # Re-open for actual reading (verify consumes stream)
        byte_stream.seek(0)
        img = Image.open(byte_stream)

        # Dimension validation
        width, height = img.size
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            return None, f"Image resolution too small: {width}x{height} (minimum {MIN_DIMENSION}x{MIN_DIMENSION})", None
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            return None, f"Image resolution too large: {width}x{height} (maximum {MAX_DIMENSION}x{MAX_DIMENSION})", None

        # Format validation
        img_format = (img.format or "").upper()
        if img_format not in ("JPEG", "PNG", "WEBP"):
            return None, f"Unsupported image format '{img_format}'. Permitted: JPEG, PNG, WEBP", None

        # Compute metadata
        raw_md5, phash = compute_image_hashes(img)
        metadata = {
            "format": img_format,
            "width": width,
            "height": height,
            "size_bytes": len(raw_bytes),
            "md5": raw_md5,
            "phash": phash,
        }

        # Convert to RGB if needed
        if img.mode != "RGB":
            img = img.convert("RGB")

        return img, None, metadata

    except Image.DecompressionBombError:
        return None, "Image rejected: potential decompression bomb detected", None
    except Exception as e:
        return None, f"Unexpected validation error: {str(e)}", None
