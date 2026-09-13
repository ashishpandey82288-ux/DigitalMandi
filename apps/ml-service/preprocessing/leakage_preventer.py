import random
from typing import List, Dict, Any, Tuple
from collections import defaultdict


def split_dataset_leakage_free(
    samples: List[Dict[str, Any]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    group_key: str = "sample_batch_id",
    stratify_key: str = "digitalmandi_label"
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Performs leakage-free train/validation/test partitioning.
    Ensures all images/samples belonging to the same physical batch (group_key)
    are strictly grouped within the SAME split.
    """
    assert abs((train_ratio + val_ratio + test_ratio) - 1.0) < 1e-5, "Ratios must sum to 1.0"

    rng = random.Random(seed)

    # Group sample indices by physical batch
    batch_to_samples = defaultdict(list)
    batch_primary_label = {}

    for idx, s in enumerate(samples):
        b_id = s.get(group_key) or f"isolated_{s.get('sample_id', idx)}"
        batch_to_samples[b_id].append(s)
        # Record majority label for stratum tracking
        lbl = s.get(stratify_key, "UNKNOWN")
        if b_id not in batch_primary_label:
            batch_primary_label[b_id] = lbl

    # Stratify batches by label
    label_to_batches = defaultdict(list)
    for b_id, lbl in batch_primary_label.items():
        label_to_batches[lbl].append(b_id)

    train_batches = set()
    val_batches = set()
    test_batches = set()

    for lbl, b_list in sorted(label_to_batches.items()):
        rng.shuffle(b_list)
        n = len(b_list)
        if n == 1:
            # If only 1 batch for rare class, assign to train
            train_batches.add(b_list[0])
            continue
        if n == 2:
            train_batches.add(b_list[0])
            test_batches.add(b_list[1])
            continue

        n_val = max(1, int(round(n * val_ratio)))
        n_test = max(1, int(round(n * test_ratio)))
        n_train = n - n_val - n_test
        if n_train < 1:
            n_train = 1
            if n_val > 1:
                n_val -= 1
            elif n_test > 1:
                n_test -= 1

        val_batches.update(b_list[:n_val])
        test_batches.update(b_list[n_val : n_val + n_test])
        train_batches.update(b_list[n_val + n_test :])

    train_samples = []
    val_samples = []
    test_samples = []

    for b_id, s_list in batch_to_samples.items():
        if b_id in train_batches:
            for s in s_list:
                s_copy = dict(s)
                s_copy["split"] = "train"
                train_samples.append(s_copy)
        elif b_id in val_batches:
            for s in s_list:
                s_copy = dict(s)
                s_copy["split"] = "val"
                val_samples.append(s_copy)
        else:
            for s in s_list:
                s_copy = dict(s)
                s_copy["split"] = "test"
                test_samples.append(s_copy)

    # Verification: assert disjoint batches
    all_train_batches = {s.get(group_key) for s in train_samples if s.get(group_key)}
    all_val_batches = {s.get(group_key) for s in val_samples if s.get(group_key)}
    all_test_batches = {s.get(group_key) for s in test_samples if s.get(group_key)}

    leakage_train_val = all_train_batches.intersection(all_val_batches)
    leakage_train_test = all_train_batches.intersection(all_test_batches)
    leakage_val_test = all_val_batches.intersection(all_test_batches)

    leakage_detected = len(leakage_train_val) + len(leakage_train_test) + len(leakage_val_test) > 0

    stats = {
        "total_samples": len(samples),
        "total_batches": len(batch_to_samples),
        "train_count": len(train_samples),
        "val_count": len(val_samples),
        "test_count": len(test_samples),
        "train_ratio": round(len(train_samples) / max(1, len(samples)), 4),
        "val_ratio": round(len(val_samples) / max(1, len(samples)), 4),
        "test_ratio": round(len(test_samples) / max(1, len(samples)), 4),
        "leakage_free": not leakage_detected,
    }

    return train_samples, val_samples, test_samples, stats
