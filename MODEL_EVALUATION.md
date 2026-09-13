# DigitalMandi AI Quality Grading Model Evaluation

**Model Version:** `DigitalMandi-GrainVision-Wheat-v1.0`
**Architecture:** `GrainMorphology-RandomForest-Calibrated`
**Training Timestamp:** 2026-09-12T23:59:17Z
**Dataset Hash:** `19a8655ba1d918f7`

## 1. Evaluation Summary (Held-Out Test Set)

- **Overall Accuracy:** 85.0%
- **Macro Precision:** 84.5%
- **Macro Recall:** 85.0%
- **Macro F1 Score:** 84.4%
- **Inference Latency:** ~2.5 ms per kernel (CPU single-thread)
- **Memory Footprint:** < 45 MB RAM (Safe for Render 512MB limit)

## 2. Per-Class Performance Breakdown

| Defect Class | Precision | Recall | F1 Score | Test Support | Operational Risk Rating |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `BROKEN` | 100.0% | 100.0% | 100.0% | 5 | HIGH (Deduction Impact) |
| `DAMAGED` | 33.3% | 20.0% | 25.0% | 5 | MODERATE |
| `DISCOLORED` | 100.0% | 100.0% | 100.0% | 5 | MODERATE |
| `FOREIGN_MATTER` | 100.0% | 100.0% | 100.0% | 5 | HIGH (Deduction Impact) |
| `INSECT_DAMAGED` | 100.0% | 100.0% | 100.0% | 5 | CRITICAL (Statutory Sub-FAQ) |
| `MOLDY` | 100.0% | 100.0% | 100.0% | 5 | CRITICAL (Statutory Sub-FAQ) |
| `SOUND` | 42.9% | 60.0% | 50.0% | 5 | MODERATE |
| `SPROUTED` | 100.0% | 100.0% | 100.0% | 5 | MODERATE |

## 3. Confusion Matrix

| True \ Pred | `BROK` | `DAMA` | `DISC` | `FORE` | `INSE` | `MOLD` | `SOUN` | `SPRO` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`BROKEN`** | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **`DAMAGED`** | 0 | 1 | 0 | 0 | 0 | 0 | 4 | 0 |
| **`DISCOLORED`** | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| **`FOREIGN_MATTER`** | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| **`INSECT_DAMAGED`** | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |
| **`MOLDY`** | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| **`SOUND`** | 0 | 2 | 0 | 0 | 0 | 0 | 3 | 0 |
| **`SPROUTED`** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |

## 4. Real-World Limitations & Known Biases
1. **Single vs. Clustered Kernels**: Model performance is optimal on separated single kernels or spread sample trays. Clustered or heavily overlapping grains may cause partial occlusion.
2. **Lighting Sensitivity**: Severe harsh shadows (< 50 lux) can elevate dark spot false positives. Mandi inspection stations should provide diffuse top-down illumination (> 300 lux).
3. **Internal vs. External Defects**: The RGB optical model cannot observe internal endosperm rot or internal weevil larvae without visible external entry holes.
4. **Moisture Separation**: The model explicitly **does not** estimate moisture from pixels; moisture percentage must always be measured using calibrated electronic moisture meters.

## 5. Human-in-the-Loop Safeguards
- The visual ML model provides assistive advisory scoring and defect localization.
- The government/mandi quality inspector retains authoritative statutory override rights via `/api/grading/:id/verify`.
- Any discrepancy or override requires mandatory recorded remarks in the immutable audit ledger.
