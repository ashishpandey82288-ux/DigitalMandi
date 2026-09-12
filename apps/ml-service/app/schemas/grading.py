from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class GradingRequest(BaseModel):
    sample_reference: str = Field(..., description="Unique sample reference tracking code")
    crop_name: str = Field(..., description="Name of the crop (e.g. Wheat, Paddy)")
    crop_code: Optional[str] = Field(None, description="Standard crop code")
    moisture_percentage: float = Field(..., ge=0.0, le=100.0, description="Moisture percentage measured by electronic moisture meter")
    standard_moisture_limit: float = Field(..., ge=0.0, le=100.0, description="Statutory standard moisture limit")
    foreign_matter_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Measured foreign matter percentage")
    damaged_grains_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Measured damaged grains percentage")
    broken_grains_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Measured broken grains percentage")
    sample_image_url: Optional[str] = Field(None, description="Image URL or base64 data URI of grain sample")

class QualityParameterAnalysis(BaseModel):
    moisture: Dict[str, Any]
    foreignMatter: Dict[str, Any]
    damagedGrains: Dict[str, Any]
    brokenGrains: Dict[str, Any]

class GradingResponse(BaseModel):
    success: bool = True
    sample_reference: str
    ai_model_version: str = "KisanFlow-AgriVision-YOLOv8-v1.0"
    ai_confidence_score: float
    ai_inference_status: str
    predicted_grade: str
    moisture_percentage: float
    standard_moisture_limit: float
    is_moisture_pass: bool
    excess_moisture_percentage: float
    foreign_matter_percentage: float
    damaged_grains_percentage: float
    broken_grains_percentage: float
    parameter_analysis: QualityParameterAnalysis
    recommendation: str
    visual_defect_heatmap_url: Optional[str] = None
