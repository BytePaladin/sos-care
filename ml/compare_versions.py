"""Side-by-side v1 vs v2 comparison -- the Week 3 demo script.

Week 3's work was error analysis: finding where the v1 model failed and fixing
it. That story is only convincing if you can see the "before" as well as the
"after", so this script reconstructs both and runs the same messages through
each:

    v1 = model trained on dataset_v1.csv + the safety net WITHOUT the rule
         that was added in v2 (`thunderclap_headache`)
    v2 = model trained on dataset_v2.csv + the full current safety net

The v1 model is retrained in memory each run (a couple of seconds) rather than
kept as a committed binary, so this stays reproducible from the data files.

Run from the `ml/` directory:  python compare_versions.py
"""

import os
import sys

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

import safety_net  # noqa: E402
from preprocess import clean_text  # noqa: E402

# The rule added in v2 -- excluded to reconstruct the v1 safety net.
_RULE_ADDED_IN_V2 = "thunderclap_headache"

# The messages that drove the v2 dataset expansion, plus controls that must not
# regress. `expect` is what the v2 system should say.
PROBES = [
    ("sudden severe headache, worst one of my life", "RED"),
    ("this is the worst headache I've ever had", "RED"),
    ("my urine smells strange", "YELLOW"),
    ("i have a headache", "YELLOW"),
    ("i am feeling high headache", "YELLOW"),
    ("i am feeling very high headache", "YELLOW"),
    ("i am feeling high abdominal pain", "YELLOW"),
    # --- controls: these already worked in v1 and must still work ---
    ("Can I eat bananas on my current diet?", "GREEN"),
    ("My legs and ankles have been swelling for two days", "YELLOW"),
    ("I haven't passed any urine since yesterday", "RED"),
]

GREEN, YELLOW, RED, RESET = "\033[92m", "\033[93m", "\033[91m", "\033[0m"
_COLOR = {"GREEN": GREEN, "YELLOW": YELLOW, "RED": RED}


def _build_pipeline():
    """Same architecture as training/train.py's selected model (logreg)."""
    features = FeatureUnion([
        ("word", TfidfVectorizer(
            preprocessor=clean_text, ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(
            preprocessor=clean_text, analyzer="char_wb", ngram_range=(3, 5),
            min_df=2, sublinear_tf=True)),
    ])
    return Pipeline([
        ("features", features),
        ("clf", LogisticRegression(max_iter=2000, C=10, class_weight="balanced")),
    ])


def _train(dataset_name):
    path = os.path.join(_HERE, "data", dataset_name)
    if not os.path.exists(path):
        raise SystemExit(f"Dataset not found: {path}")
    df = pd.read_csv(path)
    pipe = _build_pipeline()
    pipe.fit(df["text"].astype(str).tolist(), df["label"].astype(str).tolist())
    return pipe, len(df)


def _safety_net_hit(text, include_v2_rule):
    """Run the safety net, optionally excluding the rule added in v2."""
    matches = safety_net.check(text)["matches"]
    if not include_v2_rule:
        matches = [m for m in matches if m != _RULE_ADDED_IN_V2]
    return matches


def _decide(model, text, include_v2_rule):
    """finalLabel = RED if the safety net fires, else the model's label."""
    ml_label = str(model.predict([text])[0])
    matches = _safety_net_hit(text, include_v2_rule)
    final = "RED" if matches else ml_label
    return final, bool(matches)


def main():
    print("Training the v1 model from data/dataset_v1.csv ...")
    v1_model, v1_n = _train("dataset_v1.csv")
    print("Training the v2 model from data/dataset_v2.csv ...")
    v2_model, v2_n = _train("dataset_v2.csv")
    print(f"\nv1: {v1_n} messages, {len(safety_net._CRITICAL_PATTERNS) - 1} safety-net rules")
    print(f"v2: {v2_n} messages, {len(safety_net._CRITICAL_PATTERNS)} safety-net rules")
    print("\n('net' = the deterministic safety net fired and forced RED)\n")

    header = f"{'v1 (before)':<22} {'v2 (after)':<22} {'expected':<9}  message"
    print(header)
    print("-" * len(header))

    fixed = 0
    failures = 0
    for text, expected in PROBES:
        v1_label, v1_net = _decide(v1_model, text, include_v2_rule=False)
        v2_label, v2_net = _decide(v2_model, text, include_v2_rule=True)

        def cell(label, net):
            tag = f"{label}{' + net' if net else ''}"
            return f"{_COLOR[label]}{tag:<13}{RESET}"

        changed = "  ->" if v1_label != v2_label else "    "
        ok = "" if v2_label == expected else "   <-- MISMATCH"
        if v2_label != expected:
            failures += 1
        elif v1_label != expected:
            fixed += 1

        print(f"{cell(v1_label, v1_net)}{changed}  {cell(v2_label, v2_net)}"
              f"       {expected:<9}  {text}")

    print()
    print(f"Corrected by the v2 work : {fixed}")
    print(f"Still wrong in v2        : {failures}")
    if failures == 0:
        print("\nEvery probe message now matches the expected tier.")


if __name__ == "__main__":
    main()
