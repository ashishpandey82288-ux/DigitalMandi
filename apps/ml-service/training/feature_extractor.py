import numpy as np
from PIL import Image
from typing import List


class GrainMorphologyFeatureExtractor:
    """
    High-efficiency CPU-friendly morphological, color, and texture feature extractor
    for individual grain kernel and grain batch inspection.
    Extracts fixed-length feature vectors without requiring heavy GPU neural nets.
    """

    def __init__(self, target_size=(128, 128)):
        self.target_size = target_size

    def extract_features(self, img: Image.Image) -> np.ndarray:
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to standardized analysis resolution
        resized = img.resize(self.target_size, Image.Resampling.BILINEAR)
        rgb_arr = np.array(resized, dtype=np.float32) / 255.0  # H, W, 3
        gray_arr = 0.2989 * rgb_arr[:, :, 0] + 0.5870 * rgb_arr[:, :, 1] + 0.1140 * rgb_arr[:, :, 2]

        features: List[float] = []

        # 1. Color Channel Statistics (RGB)
        for c in range(3):
            ch = rgb_arr[:, :, c]
            mean_c = float(np.mean(ch))
            std_c = float(np.std(ch))
            features.extend([mean_c, std_c])

        # 2. Color Ratios & Perceptual Contrast
        r = rgb_arr[:, :, 0]
        g = rgb_arr[:, :, 1]
        b = rgb_arr[:, :, 2]
        # Redness / Yellowness indices common in grain quality assessment
        rg_ratio = float(np.mean((r + 1e-4) / (g + 1e-4)))
        rb_ratio = float(np.mean((r + 1e-4) / (b + 1e-4)))
        features.extend([rg_ratio, rb_ratio])

        # 3. Grain Foreground Mask & Morphology
        # Grain kernels are typically separated from neutral/gray inspection background
        bg_diff = np.abs(gray_arr - 0.5)
        fg_mask = bg_diff > 0.08  # Foreground threshold
        fg_pixels = np.sum(fg_mask)
        total_pixels = gray_arr.size
        area_fraction = float(fg_pixels / max(1, total_pixels))
        features.append(area_fraction)

        if fg_pixels > 20:
            y_indices, x_indices = np.nonzero(fg_mask)
            w_span = float(np.max(x_indices) - np.min(x_indices) + 1)
            h_span = float(np.max(y_indices) - np.min(y_indices) + 1)
            aspect_ratio = float(max(w_span, h_span) / max(1.0, min(w_span, h_span)))
            bbox_fill = float(fg_pixels / max(1.0, (w_span * h_span)))
            features.extend([aspect_ratio, bbox_fill])
        else:
            features.extend([1.0, 0.0])

        # 4. Texture & Edge Roughness (Sobel Gradient Filters)
        # Horizontal & vertical gradient approximations
        gx = np.abs(gray_arr[:, 1:] - gray_arr[:, :-1])
        gy = np.abs(gray_arr[1:, :] - gray_arr[:-1, :])
        grad_mean_x = float(np.mean(gx))
        grad_std_x = float(np.std(gx))
        grad_mean_y = float(np.mean(gy))
        grad_std_y = float(np.std(gy))
        total_roughness = float(grad_mean_x + grad_mean_y)
        features.extend([grad_mean_x, grad_std_x, grad_mean_y, grad_std_y, total_roughness])

        # 5. Spatial Quadrant Density (Captures localized defects e.g. Black Point / Radicle)
        h, w = gray_arr.shape
        q1 = float(np.mean(gray_arr[: h // 2, : w // 2]))
        q2 = float(np.mean(gray_arr[: h // 2, w // 2 :]))
        q3 = float(np.mean(gray_arr[h // 2 :, : w // 2]))
        q4 = float(np.mean(gray_arr[h // 2 :, w // 2 :]))
        spatial_variance = float(np.var([q1, q2, q3, q4]))
        features.extend([q1, q2, q3, q4, spatial_variance])

        # 6. Dark Spot Defect Intensity (Insect weevil holes / Mold spots / Black point)
        dark_pixels_fraction = float(np.sum((gray_arr < 0.25) & fg_mask) / max(1.0, fg_pixels))
        bright_spot_fraction = float(np.sum((gray_arr > 0.85) & fg_mask) / max(1.0, fg_pixels))
        features.extend([dark_pixels_fraction, bright_spot_fraction])

        return np.array(features, dtype=np.float32)
