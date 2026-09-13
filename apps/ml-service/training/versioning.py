import hashlib
import time
import json
from typing import Dict, Any, List


def generate_dataset_hash(manifest_records: List[Dict[str, Any]]) -> str:
    """Computes a deterministic SHA-256 hash across manifest samples."""
    hasher = hashlib.sha256()
    sorted_samples = sorted(manifest_records, key=lambda x: str(x.get("sample_id", "")))
    for s in sorted_samples:
        sample_str = f"{s.get('sample_id')}:{s.get('crop')}:{s.get('digitalmandi_label')}:{s.get('split')}:{s.get('image_path')}"
        hasher.update(sample_str.encode("utf-8"))
    return hasher.hexdigest()[:16]


def create_model_metadata(
    model_version: str,
    architecture: str,
    dataset_version: str,
    dataset_hash: str,
    classes: List[str],
    metrics: Dict[str, Any],
    training_params: Dict[str, Any],
    preprocessing_version: str = "1.0.0-letterbox-rgb"
) -> Dict[str, Any]:
    """Generates standardized provenance metadata for model registry."""
    return {
        "model_version": model_version,
        "architecture": architecture,
        "dataset_version": dataset_version,
        "dataset_hash": dataset_hash,
        "preprocessing_version": preprocessing_version,
        "classes": classes,
        "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "metrics": metrics,
        "training_params": training_params,
        "runtime_target": "CPU-Optimized (RAM < 60MB, Latency < 50ms)"
    }
