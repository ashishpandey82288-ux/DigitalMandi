import os
import sys
import json
import base64
import unittest
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from preprocessing.validator import validate_and_load_image, validate_image_payload, is_ssrf_safe_url
from preprocessing.normalizer import letterbox_resize
from preprocessing.leakage_preventer import split_dataset_leakage_free
from training.feature_extractor import GrainMorphologyFeatureExtractor
from inference.engine import DigitalMandiGradingEngine
from models.registry import ModelRegistry


class TestDigitalMandiMLPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = DigitalMandiGradingEngine()
        cls.data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
        cls.fixtures_dir = os.path.join(cls.data_dir, "fixtures")

    def test_01_valid_wheat_image_grade_a(self):
        """Valid sound wheat image with optimal moisture -> GRADE_A."""
        sound_wheat = os.path.join(self.fixtures_dir, "wheat_sound_0001.png")
        self.assertTrue(os.path.exists(sound_wheat), "Sound wheat fixture must exist")

        res = self.engine.grade_sample(
            sample_reference="SMP-WHEAT-TEST-01",
            crop_name="Wheat",
            moisture_percentage=11.5,
            standard_moisture_limit=12.0,
            sample_image_url=sound_wheat
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["predicted_grade"], "GRADE_A")
        self.assertTrue(res["is_moisture_pass"])
        self.assertGreaterEqual(res["ai_confidence_score"], 0.85)
        self.assertEqual(res["ai_model_version"], "DigitalMandi-GrainVision-Wheat-v1.0")
        self.assertIsNotNone(res["visual_defect_heatmap_url"])

    def test_02_valid_rice_image_grade(self):
        """Valid rice / paddy sample -> successful grading."""
        sound_rice = os.path.join(self.fixtures_dir, "rice_sound_0121.png")
        self.assertTrue(os.path.exists(sound_rice), "Sound rice fixture must exist")

        res = self.engine.grade_sample(
            sample_reference="SMP-RICE-TEST-02",
            crop_name="Rice",
            moisture_percentage=13.0,
            standard_moisture_limit=14.0,
            sample_image_url=sound_rice
        )
        self.assertTrue(res["success"])
        self.assertIn(res["predicted_grade"], ("GRADE_A", "GRADE_B"))
        self.assertTrue(res["is_moisture_pass"])
        self.assertEqual(res["moisture_percentage"], 13.0)

    def test_03_defective_moldy_wheat_below_faq(self):
        """Moldy wheat sample -> classified as BELOW_FAQ with active defect detection."""
        moldy_wheat = os.path.join(self.fixtures_dir, "wheat_moldy_0091.png")
        self.assertTrue(os.path.exists(moldy_wheat))

        res = self.engine.grade_sample(
            sample_reference="SMP-WHEAT-MOLD-03",
            crop_name="Wheat",
            moisture_percentage=12.0,
            standard_moisture_limit=12.0,
            sample_image_url=moldy_wheat
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["predicted_grade"], "BELOW_FAQ")
        self.assertIn("moldy", res["recommendation"].lower())

    def test_04_missing_image_fallback(self):
        """When no image is provided, engine gracefully evaluates physical parameters."""
        res = self.engine.grade_sample(
            sample_reference="SMP-NO-IMAGE-04",
            crop_name="Wheat",
            moisture_percentage=11.2,
            standard_moisture_limit=12.0,
            foreign_matter_percentage=0.5,
            damaged_grains_percentage=0.8,
            broken_grains_percentage=1.5,
            sample_image_url=None
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["predicted_grade"], "GRADE_A")
        self.assertEqual(res["ai_inference_status"], "COMPLETED")

    def test_05_excess_moisture_physical_rejection(self):
        """Statutory physical measurement takes precedence over visual appearance."""
        sound_wheat = os.path.join(self.fixtures_dir, "wheat_sound_0001.png")

        # Moisture 16.5% vs limit 12.0% -> excess 4.5% (> 4.0% severe threshold)
        res = self.engine.grade_sample(
            sample_reference="SMP-WHEAT-HIGH-MOISTURE",
            crop_name="Wheat",
            moisture_percentage=16.5,
            standard_moisture_limit=12.0,
            sample_image_url=sound_wheat
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["predicted_grade"], "BELOW_FAQ")
        self.assertFalse(res["is_moisture_pass"])
        self.assertEqual(res["excess_moisture_percentage"], 4.5)

    def test_06_corrupted_image_handling(self):
        """Corrupted image bytes rejected gracefully without crashing."""
        img, err, meta = validate_and_load_image(b"NOT_AN_IMAGE_HEADER_GARBAGE")
        self.assertIsNone(img)
        self.assertIn("Corrupted", err)

    def test_07_invalid_base64_payload(self):
        """Malformed base64 header or payload fails validation."""
        self.assertFalse(validate_image_payload("data:image/jpeg;base64,!!!invalid!!!"))
        self.assertFalse(validate_image_payload("ftp://unsafe.url/image.png"))
        self.assertTrue(validate_image_payload("https://trusted.cdn.gov.in/sample.jpg"))

    def test_08_ssrf_prevention(self):
        """SSRF protection blocks localhost and private cloud metadata endpoints."""
        self.assertFalse(is_ssrf_safe_url("http://localhost:8000/secret"))
        self.assertFalse(is_ssrf_safe_url("http://127.0.0.1/admin"))
        self.assertFalse(is_ssrf_safe_url("http://169.254.169.254/latest/meta-data/"))
        self.assertFalse(is_ssrf_safe_url("http://192.168.1.1/router"))
        self.assertTrue(is_ssrf_safe_url("https://agmarknet.gov.in/images/grain.jpg"))

    def test_09_leakage_free_splitting(self):
        """Guarantees zero physical harvest lot leakage between splits."""
        samples = [
            {"sample_id": f"s_{i}", "sample_batch_id": f"LOT_{i // 3}", "digitalmandi_label": "SOUND"}
            for i in range(30)
        ]
        train, val, test, stats = split_dataset_leakage_free(samples, 0.7, 0.15, 0.15, seed=42)
        self.assertTrue(stats["leakage_free"])

        train_lots = {s["sample_batch_id"] for s in train}
        val_lots = {s["sample_batch_id"] for s in val}
        test_lots = {s["sample_batch_id"] for s in test}

        self.assertEqual(len(train_lots.intersection(val_lots)), 0)
        self.assertEqual(len(train_lots.intersection(test_lots)), 0)
        self.assertEqual(len(val_lots.intersection(test_lots)), 0)

    def test_10_schema_compatibility(self):
        """Verifies full backward-compatible response schema fields."""
        sound_wheat = os.path.join(self.fixtures_dir, "wheat_sound_0001.png")
        res = self.engine.grade_sample(
            sample_reference="SMP-SCHEMA-VERIFY",
            crop_name="Wheat",
            moisture_percentage=11.9,
            standard_moisture_limit=12.0,
            sample_image_url=sound_wheat
        )
        required_keys = [
            "success", "sample_reference", "ai_model_version", "ai_confidence_score",
            "ai_inference_status", "predicted_grade", "moisture_percentage",
            "standard_moisture_limit", "is_moisture_pass", "excess_moisture_percentage",
            "foreign_matter_percentage", "damaged_grains_percentage",
            "broken_grains_percentage", "parameter_analysis", "recommendation",
            "visual_defect_heatmap_url"
        ]
        for k in required_keys:
            self.assertIn(k, res, f"Response must include key '{k}'")

        # Parameter analysis nested keys
        pa = res["parameter_analysis"]
        for param in ("moisture", "foreignMatter", "damagedGrains", "brokenGrains"):
            self.assertIn(param, pa)
            self.assertIn("measured", pa[param])
            self.assertIn("status", pa[param])


if __name__ == "__main__":
    unittest.main()
