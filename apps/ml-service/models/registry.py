import os
import json
import shutil
import time
from typing import Optional, Dict, Any


class ModelRegistry:
    """
    Manages lifecycle of DigitalMandi grain inspection models:
    models/
      candidate/
      production/
      archive/
    Strict gatekeeper: models must be compared and promoted intentionally.
    """

    def __init__(self, base_models_dir: Optional[str] = None):
        if base_models_dir is None:
            base_models_dir = os.path.join(os.path.dirname(__file__))
        self.base_dir = base_models_dir
        self.candidate_dir = os.path.join(self.base_dir, "candidate")
        self.production_dir = os.path.join(self.base_dir, "production")
        self.archive_dir = os.path.join(self.base_dir, "archive")

        for d in (self.candidate_dir, self.production_dir, self.archive_dir):
            os.makedirs(d, exist_ok=True)

    def get_production_metadata(self) -> Optional[Dict[str, Any]]:
        meta_path = os.path.join(self.production_dir, "model_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def save_candidate_model(
        self,
        model_artifact_path: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Saves candidate weights and metadata for review."""
        model_version = metadata.get("model_version", f"DigitalMandi-Candidate-{int(time.time())}")
        version_dir = os.path.join(self.candidate_dir, model_version)
        os.makedirs(version_dir, exist_ok=True)

        target_artifact = os.path.join(version_dir, os.path.basename(model_artifact_path))
        shutil.copy2(model_artifact_path, target_artifact)

        meta_file = os.path.join(version_dir, "model_metadata.json")
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        return version_dir

    def evaluate_and_compare(
        self,
        candidate_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compares candidate metrics against production metrics.
        Returns recommendation: PROMOTE, REJECT, or MANUAL_REVIEW.
        """
        prod_meta = self.get_production_metadata()
        if not prod_meta:
            return {
                "decision": "PROMOTE",
                "reason": "No current production model exists. Candidate is eligible as initial baseline.",
                "candidate_f1": candidate_metadata.get("metrics", {}).get("macro_f1", 0.0),
                "production_f1": None
            }

        cand_f1 = candidate_metadata.get("metrics", {}).get("macro_f1", 0.0)
        prod_f1 = prod_meta.get("metrics", {}).get("macro_f1", 0.0)

        cand_acc = candidate_metadata.get("metrics", {}).get("overall_accuracy", 0.0)
        prod_acc = prod_meta.get("metrics", {}).get("overall_accuracy", 0.0)

        # Check critical defect recall (Broken, Moldy, Insect)
        cand_per_class = candidate_metadata.get("metrics", {}).get("per_class", {})
        prod_per_class = prod_meta.get("metrics", {}).get("per_class", {})

        critical_defects = ["MOLDY", "INSECT_DAMAGED", "BROKEN"]
        regression = False
        for cd in critical_defects:
            cand_r = cand_per_class.get(cd, {}).get("recall", 0.0)
            prod_r = prod_per_class.get(cd, {}).get("recall", 0.0)
            if cand_r < prod_r - 0.05:  # >5% drop in safety-critical defect recall
                regression = True
                break

        if regression:
            return {
                "decision": "REJECT",
                "reason": f"Candidate exhibited regression in critical safety defect recall compared to production.",
                "candidate_f1": cand_f1,
                "production_f1": prod_f1
            }

        if cand_f1 >= prod_f1 and cand_acc >= prod_acc - 0.02:
            return {
                "decision": "PROMOTE",
                "reason": f"Candidate demonstrates superior or equal macro F1 ({cand_f1} vs {prod_f1}) without regression.",
                "candidate_f1": cand_f1,
                "production_f1": prod_f1
            }

        return {
            "decision": "REJECT",
            "reason": f"Candidate macro F1 ({cand_f1}) does not exceed production baseline ({prod_f1}).",
            "candidate_f1": cand_f1,
            "production_f1": prod_f1
        }

    def promote_candidate_to_production(
        self,
        candidate_version_dir: str,
        approved_by: str = "Chief Agricultural Quality Inspector"
    ) -> bool:
        """Promotes candidate to production, moving current production model to archive."""
        meta_file = os.path.join(candidate_version_dir, "model_metadata.json")
        if not os.path.exists(meta_file):
            raise FileNotFoundError(f"Missing model_metadata.json in {candidate_version_dir}")

        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        # Archive current production if it exists
        current_prod_meta = self.get_production_metadata()
        if current_prod_meta:
            prev_version = current_prod_meta.get("model_version", f"archived_{int(time.time())}")
            archive_dest = os.path.join(self.archive_dir, prev_version)
            if os.path.exists(archive_dest):
                shutil.rmtree(archive_dest)
            shutil.copytree(self.production_dir, archive_dest)

        # Clear production dir
        for item in os.listdir(self.production_dir):
            p = os.path.join(self.production_dir, item)
            if os.path.isfile(p):
                os.remove(p)
            elif os.path.isdir(p):
                shutil.rmtree(p)

        # Copy candidate artifacts to production
        for item in os.listdir(candidate_version_dir):
            src = os.path.join(candidate_version_dir, item)
            dst = os.path.join(self.production_dir, item)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            elif os.path.isdir(src):
                shutil.copytree(src, dst)

        # Update metadata with promotion record
        meta["promotion_record"] = {
            "promoted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "approved_by": approved_by,
            "previous_production_version": current_prod_meta.get("model_version") if current_prod_meta else None
        }
        with open(os.path.join(self.production_dir, "model_metadata.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return True
