import abc
from typing import Dict, Any, Optional
from PIL import Image


class BaseVisualInspectionModel(abc.ABC):
    """Abstract base interface for DigitalMandi visual grain quality inspection models."""

    @abc.abstractmethod
    def predict(self, image: Image.Image, crop: str = "Wheat") -> Dict[str, Any]:
        """
        Runs visual defect inspection on a PIL Image.
        Returns dictionary containing:
        - predicted_class: str
        - class_probabilities: Dict[str, float]
        - visual_quality_score: float (0.0 to 1.0)
        - confidence: float (0.0 to 1.0)
        - detected_defects: List[Dict[str, Any]]
        - inference_time_ms: float
        """
        pass

    @property
    @abc.abstractmethod
    def model_version(self) -> str:
        """Returns the canonical model version string."""
        pass

    @property
    @abc.abstractmethod
    def metadata(self) -> Dict[str, Any]:
        """Returns the model provenance and training metadata."""
        pass
