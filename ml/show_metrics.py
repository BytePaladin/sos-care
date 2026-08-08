"""Print the model's accuracy figures in the terminal, without retraining.

`training/train.py` produces these numbers but takes a minute or two to run.
This reads the saved results from `models/metrics.json` and prints them
instantly, which is what you want when demonstrating or answering a question.

It shows three things:

  1. Each candidate model on its own (logistic regression vs linear SVM)
  2. The chosen model measured on the held-out test set -- both the classifier
     alone and the full deployed system (classifier + safety net)
  3. What a naive random split would have claimed, to show the leakage it hides

Run from the `ml/` directory:  python show_metrics.py
"""

import argparse
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):  # pragma: no cover
    pass

BOLD, DIM, RESET = "\033[1m", "\033[90m", "\033[0m"
GREEN, YELLOW, RED, CYAN = "\033[92m", "\033[93m", "\033[91m", "\033[96m"
_COLOR = {"GREEN": GREEN, "YELLOW": YELLOW, "RED": RED}

W = 74


def rule(char="─"):
    print(DIM + char * W + RESET)


def header(title):
    print()
    print(BOLD + title + RESET)
    rule()


def pct(x):
    return f"{x * 100:5.1f}%"


def bar(value, width=22):
    """A small proportional bar so the numbers are comparable at a glance."""
    filled = int(round(value * width))
    return "█" * filled + DIM + "·" * (width - filled) + RESET


def show_candidates(data):
    """Each model on its own, scored by cross-validation on the training set."""
    header("1. EACH MODEL ON ITS OWN  (5-fold cross-validation, training set)")
    cv = data.get("cv_results_on_train") or {}
    if not cv:
        print("  not available in this metrics file")
        return

    selected = data.get("selected_model")
    print(f"  {'model':<10}{'accuracy':>10}{'macro-F1':>10}"
          f"{'RED recall':>12}{'+ safety net':>14}")
    for name, r in cv.items():
        mark = f"  {CYAN}<- selected{RESET}" if name == selected else ""
        hyb = r.get("hybrid", {}).get("red_recall")
        hyb_txt = pct(hyb) if hyb is not None else "n/a"
        print(f"  {name:<10}{pct(r['accuracy']):>10}{pct(r['macro_f1']):>10}"
              f"{pct(r['red_recall']):>12}{hyb_txt:>14}{mark}")

    print()
    print(DIM + "  Selected by RED recall of the deployed system (missing an urgent" + RESET)
    print(DIM + "  message is the worst failure), with macro-F1 breaking ties." + RESET)


def show_headline(data):
    """The chosen model on data it has never seen."""
    test = data.get("headline_test_metrics")
    if not test:
        print("\n  no held-out test metrics in this file")
        return

    n_test = data.get("n_test")
    header(f"2. THE CHOSEN MODEL ON UNSEEN DATA  ({n_test} messages, held-out templates)")

    hyb = test.get("hybrid", {})
    rows = [
        ("classifier alone", test["accuracy"], test["red_recall"]),
        ("+ safety net (what is deployed)", hyb.get("accuracy"), hyb.get("red_recall")),
    ]
    print(f"  {'':<34}{'accuracy':>10}   {'RED recall':>10}")
    for label, acc, red in rows:
        if acc is None:
            continue
        strong = BOLD if label.startswith("+") else ""
        print(f"  {strong}{label:<34}{pct(acc):>10}   {pct(red):>10}{RESET}  {bar(red)}")

    rescued = hyb.get("red_rescued_by_safety_net")
    missed = hyb.get("red_missed_by_both_layers")
    if rescued is not None:
        print()
        print(f"  The safety net caught {BOLD}{rescued}{RESET} urgent messages the model missed.")
        print(f"  {BOLD}{missed}{RESET} urgent messages were missed by both layers.")

    # Per-class detail for the classifier, and the confusion matrix.
    print()
    print(f"  {'per class':<10}{'precision':>11}{'recall':>9}{'F1':>8}{'support':>9}")
    for lbl in data.get("labels", []):
        c = test["per_class"][lbl]
        print(f"  {_COLOR.get(lbl, '')}{lbl:<10}{RESET}"
              f"{pct(c['precision']):>11}{pct(c['recall']):>9}"
              f"{pct(c['f1-score']):>8}{int(c['support']):>9}")

    print()
    print("  confusion matrix — classifier alone (rows = true, cols = predicted)")
    _print_cm(test["confusion_matrix"], data.get("labels", []))
    if hyb.get("confusion_matrix"):
        print()
        print("  confusion matrix — deployed system (classifier + safety net)")
        _print_cm(hyb["confusion_matrix"], data.get("labels", []))


def _print_cm(matrix, labels):
    print("            " + "".join(f"{l:>9}" for l in labels))
    for lbl, row in zip(labels, matrix):
        cells = "".join(f"{v:>9}" for v in row)
        print(f"  {_COLOR.get(lbl, '')}{lbl:<10}{RESET}{cells}")


def show_leakage(data):
    """Why the honest number is lower than the one a naive split would give."""
    leaky = data.get("leaky_random_split_for_comparison")
    test = data.get("headline_test_metrics")
    if not leaky or not test:
        return

    header("3. WHY NOT 100%?  (the naive split, shown for comparison only)")
    gap = leaky["accuracy"] - test["accuracy"]
    print(f"  {'random split (leaky)':<34}{pct(leaky['accuracy']):>10}   {bar(leaky['accuracy'])}")
    print(f"  {BOLD}{'split by template (honest)':<34}{pct(test['accuracy']):>10}{RESET}   "
          f"{bar(test['accuracy'])}")
    print()
    print(f"  A random split overstates accuracy by {BOLD}{gap * 100:.1f} points{RESET}.")
    print(DIM + "  The messages come from templates, so a random split trains on one" + RESET)
    print(DIM + "  phrasing and tests on its near-duplicate. Splitting by template" + RESET)
    print(DIM + "  keeps every variant on the same side, so nothing is scored twice." + RESET)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", default="metrics.json",
                        help="metrics file under ml/models/ (e.g. metrics_v2.json)")
    args = parser.parse_args(argv)

    path = os.path.join(_HERE, "models", args.file)
    if not os.path.exists(path):
        raise SystemExit(f"Not found: {path}\nRun: python training/train.py --data dataset_v3.csv")

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    print()
    rule("═")
    print(BOLD + "  S.O.S. severity classifier — saved evaluation results" + RESET)
    rule("═")
    print(f"  dataset        : {data.get('dataset')}")
    print(f"  messages       : {data.get('n_samples')}"
          + (f"  (from {data['n_templates']} templates)" if data.get("n_templates") else ""))
    counts = data.get("class_counts", {})
    if counts:
        print("  class balance  : "
              + "  ".join(f"{_COLOR.get(k, '')}{k}{RESET} {v}" for k, v in counts.items()))
    proto = data.get("protocol", {})
    if proto:
        print(f"  train / test   : {data.get('n_train')} / {data.get('n_test')}"
              f"   ({proto.get('split', '')})")
        print(f"  selected by    : {proto.get('selection_criterion', '')}")

    show_candidates(data)
    show_headline(data)
    show_leakage(data)

    print()
    rule("═")
    print(DIM + "  Full write-up: models/VALIDATION.md" + RESET)
    print(DIM + "  Real-world check on hand-written messages: python evaluate.py" + RESET)
    print()


if __name__ == "__main__":
    main()
