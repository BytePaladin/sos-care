"""Train and evaluate the S.O.S. severity classifier (spec.md 6.3.2-6.3.3).

Pipeline: TF-IDF features (word 1-2 grams + character n-grams, for robustness to
misspellings) -> linear classifier. Two candidates are compared -- Logistic
Regression and Linear SVM -- with stratified cross-validation.

Model selection is SAFETY-FIRST (NFR1): the winner is chosen by RED recall first
(missing an urgent message is the worst failure), with macro-F1 as the tiebreak.

The chosen pipeline is refit on all data and serialized to
`ml/models/severity_model.joblib`; full metrics go to `ml/models/metrics.json`.
The text cleaner (preprocess.clean_text) is baked into the vectorizers, so the
exact same preprocessing travels inside the saved model at serving time.

Run from the `ml/` directory:  python training/train.py
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
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

_ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ML_ROOT)
from preprocess import clean_text  # noqa: E402

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


def evaluate(name, pipe, X, y, cv):
    """Cross-validated predictions -> per-class metrics + confusion matrix."""
    y_pred = cross_val_predict(pipe, X, y, cv=cv)
    report = classification_report(
        y, y_pred, labels=LABELS, output_dict=True, zero_division=0)
    cm = confusion_matrix(y, y_pred, labels=LABELS)
    red_recall = report["RED"]["recall"]
    macro_f1 = report["macro avg"]["f1-score"]
    accuracy = report["accuracy"]
    print(f"\n=== {name} (5-fold CV) ===")
    print(f"accuracy={accuracy:.3f}  macro-F1={macro_f1:.3f}  "
          f"RED recall={red_recall:.3f}")
    print(classification_report(y, y_pred, labels=LABELS, zero_division=0))
    print("confusion matrix (rows=true, cols=pred) order", LABELS)
    print(cm)
    return {
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "red_recall": red_recall,
        "per_class": {lbl: report[lbl] for lbl in LABELS},
        "confusion_matrix": cm.tolist(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default="dataset_v1.csv",
                         help="CSV filename under ml/data/ to train on")
    args = parser.parse_args()

    data_path = os.path.join(_ML_ROOT, "data", args.data)
    # metrics.json always reflects the currently-deployed model (at MODEL_PATH);
    # a version-stamped copy is kept alongside it for before/after comparison.
    version_suffix = os.path.splitext(args.data)[0].replace("dataset_", "")
    versioned_metrics_path = os.path.join(_ML_ROOT, "models", f"metrics_{version_suffix}.json")
    metrics_path = os.path.join(_ML_ROOT, "models", "metrics.json")

    if not os.path.exists(data_path):
        raise SystemExit(f"Dataset not found: {data_path}. Run training/build_dataset.py first.")

    df = pd.read_csv(data_path)
    X = df["text"].astype(str).tolist()
    y = df["label"].astype(str).tolist()
    print(f"Loaded {len(X)} messages. Class counts: "
          f"{ {lbl: y.count(lbl) for lbl in LABELS} }")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    pipes = candidates()
    results = {name: evaluate(name, pipe, X, y, cv) for name, pipe in pipes.items()}

    # Safety-first selection: RED recall first, macro-F1 as tiebreak.
    best = max(results, key=lambda n: (results[n]["red_recall"],
                                       results[n]["macro_f1"]))
    print(f"\n>>> Selected model: {best} "
          f"(RED recall={results[best]['red_recall']:.3f}, "
          f"macro-F1={results[best]['macro_f1']:.3f})")

    # Refit the winner on ALL data and serialize.
    final = pipes[best].fit(X, y)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(final, MODEL_PATH)

    metrics_payload = {
        "dataset": args.data,
        "selected_model": best,
        "labels": LABELS,
        "n_samples": len(X),
        "class_counts": {lbl: y.count(lbl) for lbl in LABELS},
        "cv_folds": 5,
        "results": results,
    }
    for path in (metrics_path, versioned_metrics_path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(metrics_payload, f, indent=2)

    print(f"\nSaved model  -> {MODEL_PATH}")
    print(f"Saved metrics -> {metrics_path}")
    print(f"Saved metrics -> {versioned_metrics_path}")


if __name__ == "__main__":
    main()
