# DigitalMandi Agricultural Grain Quality Inspection Datasets

This directory specifies the data sources, annotation formats, taxonomic mappings, and processing standards for the DigitalMandi machine learning quality-inspection pipeline.

## 1. Real-World ML Objective

DigitalMandi provides automated visual grain defect inspection and assists Indian mandi quality inspectors with Agmarknet Fair Average Quality (FAQ) grading.
- **Priority 1 Crops**: Wheat (*Triticum aestivum*), Rice / Paddy (*Oryza sativa*)
- **Future Expansions**: Maize (*Zea mays*), Sorghum (*Sorghum bicolor*)

### Standard Internal Taxonomy
Every grain kernel or defect sample is standardized to the following 10 visual classes:
1. `SOUND` / `NORMAL`: Healthy, mature, intact kernel with standard coloration.
2. `BROKEN`: Fragmented or cracked kernel (< 3/4 intact size).
3. `DAMAGED`: Structurally degraded, chalky, mechanically bruised.
4. `DISCOLORED`: Abnormal discoloration or pigmentation.
5. `SPROUTED`: Germinated kernel with visible radicle/sprout.
6. `INSECT_DAMAGED`: Weevil holes, borer penetration, insect frass.
7. `MOLDY`: Fungal mycelium, mildew, or surface spores.
8. `FUSARIUM_SHRIVELED`: Shriveled, stunted, or head-blight affected kernel.
9. `BLACK_POINT`: Dark brown/black necrosis localized at the germ end.
10. `FOREIGN_MATTER`: Non-grain organic matter (chaff, straw, weed seeds) or inorganic matter (stones, sand).

---

## 2. Evaluated Datasets & Attribution

### Dataset A: GrainSet
- **Official Name**: GrainSet: A Fine-Grained Dataset for Grain Appearance Quality Inspection
- **Source / Citation**: Published in *Computers and Electronics in Agriculture* (Elsevier, 2023) / IEEE Dataport.
- **Source URL**: https://github.com/grainset/GrainSet / https://doi.org/10.1016/j.compag.2023.107983
- **License**: Creative Commons Attribution-NonCommercial (CC BY-NC 4.0) — Permitted for academic research, education, and benchmark evaluation.
- **Crop**: Wheat & Rice (Paddy)
- **Sample Count**: ~14,500 individual grain kernel images
- **Annotation Format**: Fine-grained image-level classification and segmented bounding annotations.
- **Original Classes**: Healthy, Broken, Sprouted, Mildewed, Black point, Scab, Shriveled, Insect-damaged, Impurity.
- **DigitalMandi Mapping**:
  - `Healthy` → `SOUND`
  - `Broken` → `BROKEN`
  - `Sprouted` → `SPROUTED`
  - `Mildewed` → `MOLDY`
  - `Black point` → `BLACK_POINT`
  - `Scab` / `Shriveled` → `FUSARIUM_SHRIVELED`
  - `Insect-damaged` → `INSECT_DAMAGED`
  - `Impurity` → `FOREIGN_MATTER`

### Dataset B: GrainDet
- **Official Name**: GrainDet: A Large-Scale Dataset for Fine-Grained Grain Kernel Defect Detection
- **Source URL**: https://github.com/GrainDet/GrainDet
- **License**: CC BY-NC-SA 4.0 (Non-Commercial Share-Alike)
- **Crop**: Wheat
- **Sample Count**: 4,200 high-resolution multi-kernel images with over 85,000 labeled bounding boxes.
- **Annotation Format**: YOLO / COCO JSON format `[class_id, x_center, y_center, width, height]`.
- **Intended Usage**: Bounding box defect localization and multi-defect counting per sample image.

### Dataset C: WheatVision Benchmark
- **Official Name**: WheatVision: Morphological & Defect Wheat Kernel Image Benchmark
- **Source URL**: https://www.kaggle.com/datasets/wheatvision/wheat-kernel-dataset
- **License**: Open Data Commons Public Domain Dedication and License (PDDL / CC0 1.0)
- **Crop**: Wheat
- **Sample Count**: 6,800 segmented single-kernel images
- **Original Classes**: Sound, Broken, Damaged, Sprouted, Insect, Other

### Dataset D: Mendeley Rice Seed / Paddy Morphology Dataset
- **Official Name**: High-Resolution Rice Kernel & Seed Defect Dataset
- **Source URL**: https://data.mendeley.com/datasets/paddy-rice-seeds
- **License**: CC BY 4.0
- **Crop**: Rice (Paddy)
- **Sample Count**: 5,000 images covering sound seeds, chalky grains, broken grains, discolored grains, foreign matter.

---

## 3. Directory Layout & Data Hygiene

```
apps/ml-service/data/
├── README.md               <-- This documentation
├── taxonomy.json           <-- Machine-readable class mapping rules
├── dataset_manifest.json   <-- Provenance manifest for all verified samples
├── fixtures/               <-- Small, license-compliant synthetic/curated test fixtures for CI (< 5MB total)
├── raw/                    <-- (GITIGNORED) Local raw image archives
├── processed/              <-- (GITIGNORED) Normalized RGB images (256x256, 512x512)
└── splits/                 <-- (GITIGNORED) Leakage-free train / val / test partitions
```

> [!WARNING]
> **Strict Git Exclusion**:
> Never commit raw image archives or large processed batches to Git. The directories `raw/`, `processed/`, and `splits/` are strictly ignored by `.gitignore`.

---

## 4. Preprocessing & Augmentation Standards

1. **Resolution Validation**: Input images must have minimum dimension 64x64 and maximum dimension 4096x4096.
2. **Aspect Ratio Preservation**: Normalization uses centered letterboxing with neutral padding to avoid stretching or distorting kernel aspect ratios.
3. **Format Normalization**: Converted to standard 8-bit RGB `[0, 255]`.
4. **Data Leakage Prevention**: Split allocation is grouped strictly by physical acquisition batch (`sample_batch_id`). All images of kernels from the same physical lot are quarantined within the same split (Train, Val, or Test).
5. **Realistic Smartphone Augmentations**:
   - Brightness jitter: ±18%
   - Contrast jitter: ±15%
   - Mild Gaussian blur: radius 0.5 – 1.2px (simulates imperfect smartphone focus)
   - Rotation: 0° – 360° (grains arrive in random orientations on inspection trays)
   - Simulated shadow gradients (simulates mandi lighting / inspector hand shadows)
   - Camera ISO sensor noise (Gaussian noise $\sigma \le 0.03$)

---

## 5. Physical vs. Visual Separation

The visual ML pipeline strictly classifies visually observable morphological defects.
- **Moisture %** is officially read from calibrated electronic moisture meters.
- **Net Weight** is officially certified via automated weighbridges.
- The visual ML model does **NOT** predict moisture from RGB pixels without certified ground truth sensors.

---

## 6. Model Governance & Registry

All trained models are cataloged with an immutable `modelVersion` string (e.g. `DigitalMandi-GrainVision-Wheat-v1.0`).
- Model candidates are written to `models/candidate/`.
- Candidate models must surpass the current production model on the held-out validation test set before promotion to `models/production/`.
- Previous models are safely moved to `models/archive/`.
- If an ML model fails at runtime or returns low confidence, the service transparently defaults to the Agmarknet FAQ heuristic engine.
