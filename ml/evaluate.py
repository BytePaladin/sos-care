"""Evaluate the deployed model on an independent, hand-written test set.

`training/train.py` already holds out 30% of templates, which measures
generalisation to unseen *templates*. This script is a stricter check: every
message in `data/heldout_eval.csv` was written by hand, in phrasing deliberately
unlike the generator's templates -- colloquialisms ("my pee has stopped"),
third-person reports ("my husband said I was shaking"), clinical signs described
in lay terms ("looked like coffee grounds"), and Bengali.

Nothing here was used for training or model selection, so this is the closest
available estimate of real-world performance.

Run from the `ml/` directory:  python evaluate.py
"""

import argparse
import os
import sys

import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

# The evaluation set contains Bengali, and the default Windows console codepage
# (cp1252) cannot encode it. Without this the script dies mid-report.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):  # pragma: no cover - non-standard stdout
    pass

import predict  # noqa: E402
import safety_net  # noqa: E402

LABELS = ["GREEN", "YELLOW", "RED"]
DEFAULT_SET = os.path.join(_HERE, "data", "heldout_eval.csv")

GREEN, YELLOW, RED, DIM, RESET = (
    "\033[92m", "\033[93m", "\033[91m", "\033[90m", "\033[0m")
_COLOR = {"GREEN": GREEN, "YELLOW": YELLOW, "RED": RED}


def _is_bengali(text):
    return any("ঀ" <= ch <= "৿" for ch in text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default=DEFAULT_SET,
                        help="CSV with text,label[,note] columns")
    parser.add_argument("--show-errors", action="store_true", default=True,
                        help="list every misclassified message")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        raise SystemExit("Evaluation set not found: " + args.data)

    df = pd.read_csv(args.data)
    texts = df["text"].astype(str).tolist()
    y_true = df["label"].astype(str).tolist()
    notes = (df["note"].astype(str).tolist() if "note" in df.columns
             else [""] * len(texts))

    predict.load_model()

    # The model's own prediction, and the decision the deployed system makes.
    y_model, y_hybrid, overrides = [], [], []
    for t in texts:
        result = predict.predict_label(t)
        y_model.append(result["mlLabel"])
        y_hybrid.append(result["finalLabel"])
        overrides.append(result["ruleOverride"])

    n_bn = sum(1 for t in texts if _is_bengali(t))
    print(f"Independent evaluation set: {len(texts)} hand-written messages "
          f"({n_bn} Bengali, {len(texts) - n_bn} English)")
    print(f"Class counts: { {l: y_true.count(l) for l in LABELS} }")

    for title, y_pred in (("MODEL ONLY", y_model),
                          ("DEPLOYED SYSTEM (model + safety net)", y_hybrid)):
        report = classification_report(
            y_true, y_pred, labels=LABELS, output_dict=True, zero_division=0)
        print("\n" + "=" * 68)
        print(title)
        print("=" * 68)
        print(f"accuracy={report['accuracy']:.3f}  "
              f"macro-F1={report['macro avg']['f1-score']:.3f}  "
              f"RED recall={report['RED']['recall']:.3f}")
        print(classification_report(y_true, y_pred, labels=LABELS, zero_division=0))
        print("confusion matrix (rows=true, cols=pred) order " + str(LABELS))
        print(confusion_matrix(y_true, y_pred, labels=LABELS))

    # The safety-critical number: urgent messages the deployed system missed.
    missed_red = [(t, m, n) for t, yt, m, n in zip(texts, y_true, y_hybrid, notes)
                  if yt == "RED" and m != "RED"]
    rescued = sum(1 for yt, ym, yh in zip(y_true, y_model, y_hybrid)
                  if yt == "RED" and ym != "RED" and yh == "RED")

    print("\n" + "=" * 68)
    print("SAFETY ANALYSIS")
    print("=" * 68)
    print(f"RED messages rescued by the safety net after the model missed them: {rescued}")
    print(f"RED messages missed by BOTH layers: {len(missed_red)}")
    for text, got, note in missed_red:
        print(f"  {RED}MISSED{RESET} (predicted {got}) [{note}] {text}")

    # Over-escalation matters too: a queue full of false REDs hides real ones.
    false_red = [(t, yt) for t, yt, yh in zip(texts, y_true, y_hybrid)
                 if yt != "RED" and yh == "RED"]
    print(f"\nNon-urgent messages escalated to RED (false alarms): {len(false_red)}")
    for text, true_label in false_red:
        print(f"  {DIM}false RED{RESET} (true {true_label}) {text}")

    if args.show_errors:
        print("\n" + "=" * 68)
        print("ALL ERRORS (deployed system)")
        print("=" * 68)
        wrong = [(t, yt, yh, n) for t, yt, yh, n
                 in zip(texts, y_true, y_hybrid, notes) if yt != yh]
        if not wrong:
            print("none")
        for text, true_label, got, note in wrong:
            print(f"  true={_COLOR[true_label]}{true_label:6}{RESET} "
                  f"got={_COLOR.get(got, '')}{got:6}{RESET} [{note}] {text}")

    # Bengali-specific accuracy, since it was added in v3 and is worth tracking.
    if n_bn:
        bn = [(yt, yh) for t, yt, yh in zip(texts, y_true, y_hybrid) if _is_bengali(t)]
        bn_acc = sum(1 for a, b in bn if a == b) / len(bn)
        en = [(yt, yh) for t, yt, yh in zip(texts, y_true, y_hybrid)
              if not _is_bengali(t)]
        en_acc = sum(1 for a, b in en if a == b) / len(en)
        print("\n" + "=" * 68)
        print("BY LANGUAGE (deployed system)")
        print("=" * 68)
        print(f"  english: {en_acc:.3f} ({len(en)} messages)")
        print(f"  bengali: {bn_acc:.3f} ({len(bn)} messages)")


if __name__ == "__main__":
    main()
