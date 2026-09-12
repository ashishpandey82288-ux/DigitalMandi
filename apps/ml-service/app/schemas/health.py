from pydantic import BaseModel
from typing import Optional, Dict

class HealthResponse(BaseModel):
    success: bool = True
    service: str = "KisanFlow ML Service"
    status: str = "running"
    version: str = "1.0.0-phase1"
    capabilities_planned: list[str] = [
        "ARIMA Load Forecasting",
        "Random Forest Price Prediction",
        "YOLOv8 Crop Grading",
        "EfficientNet Grain Defect Classification",
        "Isolation Forest Anomaly Detection",
        "DILRMP Satellite Yield Verification"
    ]
