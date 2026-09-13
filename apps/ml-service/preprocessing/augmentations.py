import random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from typing import Tuple, Optional


class GrainImageAugmenter:
    """
    Realistic Agricultural Field & Mandi Image Augmentation Pipeline.
    Simulates variations typical of Indian Mandi smartphone captures:
    - Uneven lighting / shadows
    - Exposure & contrast variation
    - Mild optical lens blur / autofocus imperfections
    - Arbitrary tray orientation (0-360°)
    - Sensor ISO noise
    """

    def __init__(
        self,
        brightness_range: Tuple[float, float] = (0.85, 1.15),
        contrast_range: Tuple[float, float] = (0.85, 1.15),
        rotation_enabled: bool = True,
        blur_prob: float = 0.35,
        noise_prob: float = 0.35,
        shadow_prob: float = 0.30,
        seed: Optional[int] = None
    ):
        self.brightness_range = brightness_range
        self.contrast_range = contrast_range
        self.rotation_enabled = rotation_enabled
        self.blur_prob = blur_prob
        self.noise_prob = noise_prob
        self.shadow_prob = shadow_prob
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)

    def apply_brightness_contrast(self, img: Image.Image) -> Image.Image:
        b_factor = self.rng.uniform(*self.brightness_range)
        c_factor = self.rng.uniform(*self.contrast_range)
        img = ImageEnhance.Brightness(img).enhance(b_factor)
        img = ImageEnhance.Contrast(img).enhance(c_factor)
        return img

    def apply_rotation(self, img: Image.Image) -> Image.Image:
        if not self.rotation_enabled:
            return img
        angle = self.rng.uniform(0, 360)
        # Rotate with background expansion and fill with neutral gray
        return img.rotate(angle, resample=Image.Resampling.BILINEAR, expand=False, fillcolor=(128, 128, 128))

    def apply_mild_blur(self, img: Image.Image) -> Image.Image:
        if self.rng.random() < self.blur_prob:
            radius = self.rng.uniform(0.4, 1.1)
            return img.filter(ImageFilter.GaussianBlur(radius=radius))
        return img

    def apply_simulated_shadow(self, img: Image.Image) -> Image.Image:
        """Simulates linear shadow gradient cast by operator hand or shed roofing."""
        if self.rng.random() >= self.shadow_prob:
            return img

        arr = np.array(img, dtype=np.float32)
        h, w, c = arr.shape

        # Random angle for shadow direction
        theta = self.rng.uniform(0, np.pi)
        x_coords = np.linspace(-1, 1, w)
        y_coords = np.linspace(-1, 1, h)
        xx, yy = np.meshgrid(x_coords, y_coords)

        proj = xx * np.cos(theta) + yy * np.sin(theta)
        # Sigmoid shadow attenuation between 0.65 and 1.0
        shadow_intensity = self.rng.uniform(0.65, 0.85)
        mask = shadow_intensity + (1.0 - shadow_intensity) / (1.0 + np.exp(-3 * proj))
        mask = np.expand_dims(mask, axis=2)

        arr = np.clip(arr * mask, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    def apply_camera_sensor_noise(self, img: Image.Image) -> Image.Image:
        """Simulates low-light ISO grain noise from mobile sensor."""
        if self.rng.random() >= self.noise_prob:
            return img

        arr = np.array(img, dtype=np.float32)
        sigma = self.rng.uniform(2.0, 7.0)
        noise = self.np_rng.normal(0, sigma, arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    def augment(self, image: Image.Image) -> Image.Image:
        img = image.copy()
        img = self.apply_rotation(img)
        img = self.apply_brightness_contrast(img)
        img = self.apply_simulated_shadow(img)
        img = self.apply_mild_blur(img)
        img = self.apply_camera_sensor_noise(img)
        return img
