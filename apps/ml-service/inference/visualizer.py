import io
import base64
from PIL import Image, ImageDraw
from typing import List, Dict, Any, Tuple


def render_defect_overlay(
    image: Image.Image,
    defects: List[Dict[str, Any]],
    target_size: Tuple[int, int] = (320, 320)
) -> str:
    """
    Renders visual defect localization overlay on the grain sample image.
    Draws highlighted bounding boxes / points around detected defective grains.
    Returns: data:image/png;base64,... URI
    """
    img = image.copy()
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Create transparent overlay layer
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    color_map = {
        "BROKEN": (230, 126, 34, 180),          # Amber/Orange
        "DAMAGED": (231, 76, 60, 180),          # Red
        "SPROUTED": (46, 204, 113, 180),        # Green
        "INSECT_DAMAGED": (155, 89, 182, 180),  # Purple
        "MOLDY": (192, 57, 43, 200),            # Dark Crimson
        "FUSARIUM_SHRIVELED": (243, 156, 18, 180),# Gold
        "BLACK_POINT": (52, 73, 94, 200),       # Dark Slate
        "FOREIGN_MATTER": (211, 84, 0, 200),    # Burnt Orange
        "SOUND": (39, 174, 96, 120),            # Emerald
    }

    w, h = img.size

    for d in defects:
        cls_name = d.get("class", "DAMAGED")
        color = color_map.get(cls_name, (231, 76, 60, 180))
        box = d.get("box")  # [x1, y1, x2, y2]
        if box and len(box) == 4:
            x1, y1, x2, y2 = box
            draw.rectangle([x1, y1, x2, y2], outline=color[:3] + (255,), width=2)
            draw.rectangle([x1, y1, x2, y2], fill=color)

    # Composite overlay onto base image
    combined = Image.alpha_composite(img, overlay).convert("RGB")
    combined.thumbnail(target_size, Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    combined.save(buf, format="PNG", optimize=True)
    b64_str = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_str}"
