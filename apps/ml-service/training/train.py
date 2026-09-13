import os
import sys
import json
import time
import pickle
import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from preprocessing.augmentations import GrainImageAugmenter
from preprocessing.validator import validate_and_load_image
from training.feature_extractor import GrainMorphologyFeatureExtractor
from training.versioning import generate_dataset_hash, create_model_metadata
from evaluation.metrics import compute_classification_metrics
from models.registry import ModelRegistry


def run_training_pipeline(
    data_dir: str,
    output_model_version: str = "DigitalMandi-GrainVision-Wheat-v1.0",
    augment_factor: int = 2
) -> dict:
    """
    Executes end-to-end reproducible ML training pipeline for DigitalMandi grain inspection.
    """
    manifest_file = os.path.join(data_dir, "dataset_manifest.json")
    if not os.path.exists(manifest_file):
        raise FileNotFoundError(f"Dataset manifest not found: {manifest_file}")

    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    samples = manifest_data.get("samples", [])
    dataset_hash = generate_dataset_hash(samples)

    print(f"[Training] Loaded {len(samples)} samples. Dataset hash: {dataset_hash}")

    feature_extractor = GrainMorphologyFeatureExtractor()
    augmenter = GrainImageAugmenter(seed=42)

    X_train, y_train = [], []
    X_val, y_val = [], []
    X_test, y_test = [], []

    classes_set = set()

    for s in samples:
        rel_path = s["image_path"]
        label = s["digitalmandi_label"]
        split = s.get("split", "train")
        classes_set.add(label)

        full_img_path = os.path.join(data_dir, rel_path)
        img, err, _ = validate_and_load_image(full_img_path)
        if img is None:
            print(f"[Training] Warning: skipping unreadable sample {rel_path}: {err}")
            continue

        base_feat = feature_extractor.extract_features(img)

        if split == "train":
            X_train.append(base_feat)
            y_train.append(label)

            # Apply realistic smartphone augmentations
            for _ in range(augment_factor):
                aug_img = augmenter.augment(img)
                aug_feat = feature_extractor.extract_features(aug_img)
                X_train.append(aug_feat)
                y_train.append(label)

        elif split == "val":
            X_val.append(base_feat)
            y_val.append(label)
        elif split == "test":
            X_test.append(base_feat)
            y_test.append(label)

    classes = sorted(list(classes_set))
    print(f"[Training] Classes: {classes}")
    print(f"[Training] Train samples (augmented): {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # Model architecture: Balanced Random Forest with Probability Calibration
    base_clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    t0 = time.perf_counter()
    calibrator = CalibratedClassifierCV(estimator=base_clf, cv=3, method="sigmoid")
    calibrator.fit(X_train, y_train)
    fit_time = round(time.perf_counter() - t0, 3)

    # Evaluate on held-out test set
    y_test_pred = calibrator.predict(X_test)
    test_metrics = compute_classification_metrics(y_test, list(y_test_pred), classes)

    # Evaluate on validation set
    y_val_pred = calibrator.predict(X_val)
    val_metrics = compute_classification_metrics(y_val, list(y_val_pred), classes)

    print(f"[Evaluation] Validation Macro F1: {val_metrics['macro_f1']}")
    print(f"[Evaluation] Test Overall Accuracy: {test_metrics['overall_accuracy']}, Macro F1: {test_metrics['macro_f1']}")

    training_params = {
        "n_estimators": 100,
        "max_depth": 12,
        "calibration": "sigmoid-prefit",
        "fit_time_seconds": fit_time,
        "augment_factor": augment_factor,
        "feature_dim": len(X_train[0]) if X_train else 0,
        "train_samples_augmented": len(X_train),
        "test_samples": len(X_test)
    }

    metadata = create_model_metadata(
        model_version=output_model_version,
        architecture="GrainMorphology-RandomForest-Calibrated",
        dataset_version=manifest_data.get("manifest_version", "1.0.0"),
        dataset_hash=dataset_hash,
        classes=classes,
        metrics=test_metrics,
        training_params=training_params
    )

    # Save candidate artifact
    artifact_pkl = os.path.join(data_dir, "model_classifier.pkl")
    with open(artifact_pkl, "wb") as f:
        pickle.dump(calibrator, f)

    registry = ModelRegistry()
    candidate_dir = registry.save_candidate_model(artifact_pkl, metadata)
    os.remove(artifact_pkl)

    # Evaluate against production baseline and promote
    comparison = registry.evaluate_and_compare(metadata)
    print(f"[Registry] Comparison Decision: {comparison['decision']} - {comparison['reason']}")

    if comparison["decision"] == "PROMOTE":
        registry.promote_candidate_to_production(candidate_dir, approved_by="Automated Benchmark Validator")
        print(f"[Registry] Promoted {output_model_version} to PRODUCTION.")

    return {
        "model_version": output_model_version,
        "dataset_hash": dataset_hash,
        "test_metrics": test_metrics,
        "val_metrics": val_metrics,
        "comparison": comparison
    }


if __name__ == "__main__":
    base_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    res = run_training_pipeline(base_data_dir)
    print(json.dumps(res, indent=2))
