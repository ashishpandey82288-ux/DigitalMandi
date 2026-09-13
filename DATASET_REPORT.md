# DigitalMandi Agricultural ML Dataset Report

**Report Generated:** 2026-09-13 00:00:20 UTC
**Dataset Specification:** Manifest v1.0.0

## 1. Executive Summary
- **Total Samples:** 240
- **Primary Crops:** Wheat (120), Rice (120)
- **Total Visual Defect Classes:** 8
- **Leakage-Free Splits:** Train (160), Val (40), Test (40)
- **Corrupted Images:** 0 (0.0%)
- **Duplicates Detected:** 0 (0.0%)
- **Missing / Null Labels:** 0 (0.0%)

## 2. Class Distribution & Representation

| DigitalMandi Class | Sample Count | Percentage | Defect Category | Statutory FAQ Limit |
| :--- | :--- | :--- | :--- | :--- |
| `BROKEN` | 30 | 12.5% | Mechanical | Max 7.5% |
| `DAMAGED` | 30 | 12.5% | Visual / Physiological | Max 4.5% |
| `DISCOLORED` | 30 | 12.5% | Visual / Physiological | Premium (100%) |
| `FOREIGN_MATTER` | 30 | 12.5% | Purity / Physical | Max 2.0% |
| `INSECT_DAMAGED` | 30 | 12.5% | Biological / Pest | Max 1.0% |
| `MOLDY` | 30 | 12.5% | Biological / Pest | Max 0.5% |
| `SOUND` | 30 | 12.5% | Visual / Physiological | Premium (100%) |
| `SPROUTED` | 30 | 12.5% | Biological / Pest | Premium (100%) |

## 3. Data Leakage Prevention Guarantees
- **Grouping Strategy:** Grouped by physical batch ID (`sample_batch_id`).
- All kernels originating from the same physical harvest lot are quarantined inside the same split.
- Correlated images are **never** randomly shuffled across train and test sets.

## 4. Evaluated Dataset Sources & Licensing

| Source Name | Citations / Publisher | License | Crop Coverage | Intended Operational Role |
| :--- | :--- | :--- | :--- | :--- |
| **GrainSet** | Comp. & Electronics in Ag (2023) | CC BY-NC 4.0 | Wheat, Rice | Primary appearance quality benchmark |
| **GrainDet** | Fine-Grained Defect Det. (2023) | CC BY-NC-SA 4.0 | Wheat | Multi-kernel bounding box detection |
| **WheatVision** | Kaggle Open Agri Benchmark | CC0 1.0 / PDDL | Wheat | Morphological baseline classification |
| **Mendeley Paddy** | Mendeley Data (2022) | CC BY 4.0 | Rice / Paddy | Seed morphological defect baseline |

## 5. Preprocessing & Hygiene Standards
- **Integrity:** Byte verification and PIL Image format validation.
- **Security:** Image resolution capped to 16 Megapixels (`Image.MAX_IMAGE_PIXELS`) to prevent decompression bombs; max file size capped to 10MB.
- **SSRF Protection:** Strict hostname parsing and internal IP range blocking (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`).
