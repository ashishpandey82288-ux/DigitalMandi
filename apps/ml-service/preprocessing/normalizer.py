import numpy as np
from PIL import Image
from typing import Tuple


def letterbox_resize(
    image: Image.Image,
    target_size: Tuple[int, int] = (224, 224),
    fill_color: Tuple[int, int, int] = (128, 128, 128)
) -> Image.Image:
    """
    Resizes an image preserving aspect ratio with centered padding.
    Prevents artificial morphological distortion of grain kernels.
    """
    target_w, target_h = target_size
    orig_w, orig_h = image.size

    scale = min(target_w / orig_w, target_h / orig_h)
    new_w = max(1, int(orig_w * scale))
    new_h = max(1, int(orig_h * scale))

    resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", target_size, fill_color)
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y))

    return canvas


def normalize_image_to_tensor(
    image: Image.Image,
    mean: Tuple[float, float, float] = (0.485, 0.456, 0.406),
    std: Tuple[float, float, float] = (0.229, 0.224, 0.225)
) -> np.ndarray:
    """
    Converts PIL Image to normalized float32 array with shape (C, H, W).
    Standard ImageNet normalization suitable for CNN/feature extractors.
    """
    arr = np.array(image, dtype=np.float32) / 255.0  # H, W, C
    # Normalize channels
    for c in range(3):
        arr[:, :, c] = (arr[:, :, c] - mean[c]) / std[c]
    # Transpose to C, H, W
    return np.transpose(arr, (2, 0, 1))
