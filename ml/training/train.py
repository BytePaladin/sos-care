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
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import (
    GridSearchCV, GroupShuffleSplit, StratifiedGroupKFold, StratifiedKFold,
    cross_val_predict)
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
    """The two candidate classifiers, both able to produce probabilities.

    LinearSVC returns decision-function margins, not probabilities. It is
    wrapped in CalibratedClassifierCV so that whichever model wins, the service
    can report a meaningful confidence figure to the clinician and the RED
    threshold can be tuned. Without this, selecting the SVM would silently turn
    the dashboard's confidence display into a constant.
    """
    return {
        "logreg": Pipeline([
            ("features", build_features()),
            ("clf", LogisticRegression(max_iter=2000, C=10, class_weight="balanced")),
        ]),
        "linsvm": Pipeline([
            ("features", build_features()),
            ("clf", CalibratedClassifierCV(
                LinearSVC(C=1.0, class_weight="balanced"), cv=3)),
        ]),
    }


# Grids are small on purpose: the dataset has ~200 template groups, so a large
# search would mostly be fitting noise between near-identical configurations.
PARAM_GRIDS = {
    "logreg": {
        "clf__C": [0.5, 1, 3, 10, 30],
        "features__word__min_df": [1, 2],
    },
    # The SVM sits inside CalibratedClassifierCV, so its C lives one level down.
    "linsvm": {
        "clf__estimator__C": [0.1, 0.5, 1, 3, 10],
        "features__word__min_df": [1, 2],
    },
}


def tune(name, pipe, X, y, groups, cv):
    """Search hyperparameters with grouped CV on the training set.

    Scored by macro-F1 rather than RED recall: optimising RED recall directly
    rewards a model that simply escalates everything, which would be useless.
    Balanced quality is chosen here, and the operating point is then shifted
    towards safety separately (see `tune_red_threshold`).
    """
    grid = GridSearchCV(
        pipe, PARAM_GRIDS[name], cv=cv, scoring="f1_macro", n_jobs=1, refit=True)
    grid.fit(X, y, groups=groups)
    print(f"  {name:<8} best macro-F1={grid.best_score_:.3f}  params={grid.best_params_}")
    return grid.best_estimator_, grid.best_params_, float(grid.best_score_)


def tune_red_threshold(pipe, X, y, groups, cv, min_precision=0.75):
    """Pick a probability threshold above which a message is escalated to RED.

    Missing an urgent message is far worse than reviewing a non-urgent one, so
    the default argmax decision rule is not the right operating point. This
    lowers the bar for predicting RED, subject to RED precision not collapsing
    -- an unchecked threshold would flood the queue with false alarms and hide
    the real emergencies, which is the same failure in a different direction.

    Returns (threshold, chosen_recall, chosen_precision) or None if the model
    does not produce probabilities.
    """
    if not hasattr(pipe, "predict_proba"):
        return None

    proba = cross_val_predict(pipe, X, y, cv=cv, groups=groups, method="predict_proba")
    classes = list(pipe.fit(X, y).classes_)
    red_idx = classes.index("RED")
    red_scores = proba[:, red_idx]
    truth = np.array(y)

    # Baseline: what the ordinary argmax rule already achieves. A tuned
    # threshold is only worth adopting if it beats this.
    argmax_pred = np.array(classes)[proba.argmax(axis=1)]
    base_tp = int(((truth == "RED") & (argmax_pred == "RED")).sum())
    base_fn = int(((truth == "RED") & (argmax_pred != "RED")).sum())
    base_recall = base_tp / (base_tp + base_fn) if (base_tp + base_fn) else 0.0

    best = None
    for threshold in np.arange(0.20, 0.75, 0.05):
        pred_red = red_scores >= threshold
        tp = int(((truth == "RED") & pred_red).sum())
        fp = int(((truth != "RED") & pred_red).sum())
        fn = int(((truth == "RED") & ~pred_red).sum())
        if tp == 0:
            continue
        precision = tp / (tp + fp)
        recall = tp / (tp + fn)
        if precision < min_precision:
            continue
        # Must actually improve on argmax, not just clear the floor.
        if recall <= base_recall:
            continue
        if best is None or recall > best[1]:
            best = (float(threshold), float(recall), float(precision))

    if best is None:
        print(f"  argmax already gives RED recall={base_recall:.3f} at or above "
              f"the precision floor; no threshold improves on it")
    return best


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
    parser.add_argument("--tune", action="store_true",
                        help="search hyperparameters and the RED threshold (slower)")
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

    tuned_params = None
    if args.tune:
        print("\nSearching hyperparameters (grouped CV, training set only)...")
        tuned_params = {}
        for name in list(pipes):
            pipes[name], best_params, _ = tune(
                name, pipes[name], list(X_train), list(y_train), g_train, cv)
            tuned_params[name] = {k: str(v) for k, v in best_params.items()}

    cv_results = {name: evaluate(name, pipe, list(X_train), list(y_train), cv,
                                 groups=g_train)
                  for name, pipe in pipes.items()}

    best = max(cv_results, key=lambda n: (cv_results[n]["hybrid"]["red_recall"],
                                          cv_results[n]["macro_f1"]))
    print(f"\n>>> Selected: {best} "
          f"(CV hybrid RED recall={cv_results[best]['hybrid']['red_recall']:.3f}, "
          f"macro-F1={cv_results[best]['macro_f1']:.3f})")

    # ── Step 2b: choose the RED operating point on the training folds ─────
    red_threshold = None
    if args.tune:
        print("\nTuning the RED decision threshold (training folds only)...")
        chosen = tune_red_threshold(pipes[best], list(X_train), list(y_train),
                                    g_train, cv)
        if chosen:
            red_threshold, r_recall, r_precision = chosen
            print(f"  threshold={red_threshold:.2f} -> RED recall={r_recall:.3f}, "
                  f"precision={r_precision:.3f} (precision floor 0.75)")
        else:
            print("  no threshold cleared the precision floor; keeping argmax")

    # ── Step 3: evaluate the selected model ONCE on the held-out test set ─
    print("\n" + "=" * 70)
    print("FINAL EVALUATION -- held-out test set, unseen templates")
    print("=" * 70)
    fitted = pipes[best].fit(list(X_train), list(y_train))
    y_test_pred = list(fitted.predict(list(X_test)))
    if red_threshold is not None and hasattr(fitted, "predict_proba"):
        # Apply the tuned operating point: escalate when the RED probability
        # clears the threshold, even if another class scored marginally higher.
        classes = list(fitted.classes_)
        red_idx = classes.index("RED")
        proba = fitted.predict_proba(list(X_test))
        y_test_pred = ["RED" if p[red_idx] >= red_threshold else lbl
                       for p, lbl in zip(proba, y_test_pred)]
    test_results = score_predictions(
        list(X_test), list(y_test), y_test_pred,
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
        "tuned_params": tuned_params,
        "red_threshold": red_threshold,
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
