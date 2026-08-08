"""Train and evaluate the S.O.S. severity classifier (spec.md 6.3.2-6.3.3).

Pipeline: TF-IDF features (word 1-2 grams + character n-grams, for robustness to
misspellings) -> linear classifier. Two candidates are compared -- Logistic
Regression and Linear SVM.

EVALUATION PROTOCOL (Week 6)
----------------------------
The dataset is template-generated: one template produces many near-identical
messages that differ only in a context prefix or a time phrase. A row-wise
random split therefore puts a sentence in training and its near-twin in test,
and the model is scored on phrasings it has effectively memorised. That is data
leakage, and it is why earlier versions of this project reported ~100% accuracy.

Everything here is split by TEMPLATE instead:

    1. Hold out 30% of *templates* as a test set (GroupShuffleSplit).
    2. Select the model with 5-fold grouped CV on the training set ONLY.
    3. Evaluate the selected model ONCE on the held-out test set. Those are the
       headline numbers.
    4. Report the naive random-split score alongside, purely to show the size of
       the leakage rather than hide it.
    5. Refit on all data for deployment (standard practice once the estimate has
       been obtained).

Model selection is SAFETY-FIRST (NFR1): the criterion is the RED recall of the
deployed system -- classifier plus the deterministic safety net -- because that
is what determines whether an urgent message actually reaches staff. Macro-F1
breaks ties so that among equally safe models the more balanced one wins.

Run from the `ml/` directory:  python training/train.py --data dataset_v3.csv
"""

import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import (
    GroupShuffleSplit, StratifiedGroupKFold, StratifiedKFold, cross_val_predict)
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

_ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ML_ROOT)
from preprocess import clean_text  # noqa: E402
import safety_net  # noqa: E402

MODEL_PATH = os.path.join(_ML_ROOT, "models", "severity_model.joblib")
LABELS = ["GREEN", "YELLOW", "RED"]
SEED = 42


def build_features():
    """Word + character TF-IDF, both using the shared cleaner as preprocessor."""
    return FeatureUnion([
        ("word", TfidfVectorizer(
            preprocessor=clean_text, ngram_range=(1, 2),
            min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(
            preprocessor=clean_text, analyzer="char_wb", ngram_range=(3, 5),
            min_df=2, sublinear_tf=True)),
    ])


def candidates():
    return {
        "logreg": Pipeline([
            ("features", build_features()),
            ("clf", LogisticRegression(max_iter=2000, C=10, class_weight="balanced")),
        ]),
        "linsvm": Pipeline([
            ("features", build_features()),
            ("clf", LinearSVC(C=1.0, class_weight="balanced")),
        ]),
    }


def score_predictions(X, y_true, y_pred, title):
    """Metrics for one set of predictions, including the hybrid system.

    Used for both cross-validated and held-out predictions so the two are always
    computed identically.
    """
    report = classification_report(
        y_true, y_pred, labels=LABELS, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=LABELS)

    # The deployed system is the classifier PLUS the deterministic safety net,
    # which can only escalate. Scoring the classifier alone understates the
    # system; scoring only the combination hides how much the rules contribute.
    y_hybrid = ["RED" if safety_net.is_critical(t) else p for t, p in zip(X, y_pred)]
    h_report = classification_report(
        y_true, y_hybrid, labels=LABELS, output_dict=True, zero_division=0)
    rescued = sum(1 for t, p, h in zip(y_true, y_pred, y_hybrid)
                  if t == "RED" and p != "RED" and h == "RED")
    missed = sum(1 for t, h in zip(y_true, y_hybrid) if t == "RED" and h != "RED")

    print("\n=== " + title + " ===")
    print(f"model only : accuracy={report['accuracy']:.3f}  "
          f"macro-F1={report['macro avg']['f1-score']:.3f}  "
          f"RED recall={report['RED']['recall']:.3f}")
    print(f"hybrid     : accuracy={h_report['accuracy']:.3f}  "
          f"RED recall={h_report['RED']['recall']:.3f}  "
          f"(safety net rescued {rescued}, both layers missed {missed})")
    print(classification_report(y_true, y_pred, labels=LABELS, zero_division=0))
    print("confusion matrix (rows=true, cols=pred) order " + str(LABELS))
    print(cm)

    return {
        "accuracy": report["accuracy"],
        "macro_f1": report["macro avg"]["f1-score"],
        "red_recall": report["RED"]["recall"],
        "per_class": {lbl: report[lbl] for lbl in LABELS},
        "confusion_matrix": cm.tolist(),
        "hybrid": {
            "accuracy": h_report["accuracy"],
            "red_recall": h_report["RED"]["recall"],
            "red_rescued_by_safety_net": rescued,
            "red_missed_by_both_layers": missed,
            "confusion_matrix": confusion_matrix(y_true, y_hybrid, labels=LABELS).tolist(),
        },
    }


def evaluate(name, pipe, X, y, cv, groups=None):
    """Cross-validated predictions -> metrics, via score_predictions."""
    y_pred = cross_val_predict(pipe, X, y, cv=cv, groups=groups)
    return score_predictions(X, y, y_pred, name + " (5-fold CV)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default="dataset_v1.csv",
                        help="CSV filename under ml/data/ to train on")
    parser.add_argument("--test-size", type=float, default=0.30,
                        help="fraction of TEMPLATES held out as the test set")
    args = parser.parse_args()

    data_path = os.path.join(_ML_ROOT, "data", args.data)
    version_suffix = os.path.splitext(args.data)[0].replace("dataset_", "")
    versioned_metrics_path = os.path.join(
        _ML_ROOT, "models", "metrics_" + version_suffix + ".json")
    metrics_path = os.path.join(_ML_ROOT, "models", "metrics.json")

    if not os.path.exists(data_path):
        raise SystemExit(
            "Dataset not found: " + data_path + ". Run training/build_dataset.py first.")

    df = pd.read_csv(data_path)
    X = np.array(df["text"].astype(str))
    y = np.array(df["label"].astype(str))
    has_groups = "template" in df.columns
    groups = np.array(df["template"].astype(str)) if has_groups else np.arange(len(X))

    print(f"Loaded {len(X)} messages. Class counts: "
          f"{ {lbl: int((y == lbl).sum()) for lbl in LABELS} }")
    if has_groups:
        print(f"{len(set(groups))} distinct templates "
              f"({len(X) / len(set(groups)):.1f} messages per template on average)")
    else:
        print("WARNING: no `template` column -- every row is treated as its own "
              "group, so scores will be optimistic on template-generated data.")

    # ── Step 1: hold out a test set, split by TEMPLATE ────────────────────
    # Splitting by template rather than by row is the whole point: it keeps every
    # near-duplicate of a sentence on the same side of the split, so the test set
    # measures generalisation to unseen phrasings.
    splitter = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=SEED)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))
    X_train, y_train, g_train = X[train_idx], y[train_idx], groups[train_idx]
    X_test, y_test, g_test = X[test_idx], y[test_idx], groups[test_idx]

    print(f"\nTrain/test split ({int((1 - args.test_size) * 100)}/"
          f"{int(args.test_size * 100)} by template):")
    print(f"  train: {len(X_train):5d} messages / {len(set(g_train)):3d} templates")
    print(f"  test : {len(X_test):5d} messages / {len(set(g_test)):3d} templates")
    print(f"  test class counts: { {lbl: int((y_test == lbl).sum()) for lbl in LABELS} }")
    assert not (set(g_train) & set(g_test)), "a template leaked across the split"

    pipes = candidates()

    # ── Step 2: model selection with grouped CV on the TRAINING set only ──
    # The test set is not consulted here. Using it would turn the final score
    # into a measure of how well the choice was tuned to that set.
    print("\n" + "=" * 70)
    print("MODEL SELECTION -- 5-fold grouped CV on the training set")
    print("=" * 70)
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_results = {name: evaluate(name, pipe, list(X_train), list(y_train), cv,
                                 groups=g_train)
                  for name, pipe in pipes.items()}

    best = max(cv_results, key=lambda n: (cv_results[n]["hybrid"]["red_recall"],
                                          cv_results[n]["macro_f1"]))
    print(f"\n>>> Selected: {best} "
          f"(CV hybrid RED recall={cv_results[best]['hybrid']['red_recall']:.3f}, "
          f"macro-F1={cv_results[best]['macro_f1']:.3f})")

    # ── Step 3: evaluate the selected model ONCE on the held-out test set ─
    print("\n" + "=" * 70)
    print("FINAL EVALUATION -- held-out test set, unseen templates")
    print("=" * 70)
    fitted = pipes[best].fit(list(X_train), list(y_train))
    test_results = score_predictions(
        list(X_test), list(y_test), list(fitted.predict(list(X_test))),
        best + " on held-out test set")

    # ── Step 4: quantify the leakage a naive split would have hidden ──────
    leaky = None
    if has_groups:
        print("\n" + "=" * 70)
        print("FOR COMPARISON ONLY -- the naive random split (not used)")
        print("=" * 70)
        leaky = evaluate(best + " [random split]", pipes[best], list(X), list(y),
                         StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED))
        print(f"\n>>> Leakage: a random split reports {leaky['accuracy']:.3f} accuracy "
              f"vs {test_results['accuracy']:.3f} on unseen templates "
              f"(+{leaky['accuracy'] - test_results['accuracy']:.3f} inflation)")

    # ── Step 5: refit on ALL data for deployment ──────────────────────────
    # Standard practice: once the protocol above has produced an honest estimate,
    # the shipped model is retrained on everything so it also benefits from the
    # test templates. The reported metrics remain those from step 3.
    print("\nRefitting the selected model on all data for deployment...")
    final = pipes[best].fit(list(X), list(y))
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(final, MODEL_PATH)

    metrics_payload = {
        "dataset": args.data,
        "selected_model": best,
        "labels": LABELS,
        "n_samples": len(X),
        "n_templates": len(set(groups)) if has_groups else None,
        "class_counts": {lbl: int((y == lbl).sum()) for lbl in LABELS},
        "protocol": {
            "split": "GroupShuffleSplit by template, test_size=" + str(args.test_size),
            "selection": "StratifiedGroupKFold(5) on the training set only",
            "selection_criterion": "hybrid RED recall, macro-F1 as tiebreak",
            "final_model": "refit on all data after evaluation",
        },
        "n_train": len(X_train),
        "n_test": len(X_test),
        "headline_test_metrics": test_results,
        "cv_results_on_train": cv_results,
        "leaky_random_split_for_comparison": leaky,
    }
    for path in (metrics_path, versioned_metrics_path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(metrics_payload, f, indent=2)

    print("\nSaved model   -> " + MODEL_PATH)
    print("Saved metrics -> " + metrics_path)
    print("Saved metrics -> " + versioned_metrics_path)


if __name__ == "__main__":
    main()
