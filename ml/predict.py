"""Combine the ML classifier with the rule-based safety net (spec.md 2.4).

This is the hybrid labeling logic in one place:

    finalLabel = RED            if the safety net flags a critical phrase
               = classifier(text)  otherwise

`ruleOverride` reports whether the deterministic keyword layer fired. Both the
Flask service (app.py) and the CLI below call `predict_label`.
"""

import json
import os
import sys

import joblib

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)  # so the pickled vectorizer can import preprocess.clean_text
import safety_net  # noqa: E402

MODEL_PATH = os.path.join(_HERE, "models", "severity_model.joblib")

_model = None


def load_model(path: str = MODEL_PATH):
    """Load and cache the serialized pipeline. Raises if it hasn't been trained."""
    global _model
    if _model is None:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Model not found at {path}. Run: python training/train.py")
        _model = joblib.load(path)
    return _model


def is_model_loaded() -> bool:
    return _model is not None


def model_version() -> str:
    """Which dataset the deployed model was trained on.

    Read from models/metrics.json (written by training/train.py) rather than
    hardcoded, so it cannot drift out of date after a retrain. Reported in the
    /predict response and echoed into backend logs, which makes it possible to
    tell which model produced a stored triage decision.
    """
    metrics_path = os.path.join(_HERE, "models", "metrics.json")
    try:
        with open(metrics_path, encoding="utf-8") as f:
            return str(json.load(f).get("dataset", "unknown"))
    except (OSError, ValueError):
        return "unknown"


def explain_prediction(text: str, top_n: int = 5) -> list:
    """Which words pushed this message towards its predicted tier.

    The classifier is linear (TF-IDF -> logistic regression), so a term's
    contribution to a class score is simply its TF-IDF value multiplied by that
    class's coefficient. Summing those products *is* the decision, which means
    this is a faithful explanation rather than an approximation of one.

    Only the word/bigram half of the feature union is reported. The pipeline
    also uses character n-grams -- they make the model robust to misspellings
    but "hes", "est" and "st " are meaningless to a clinician reading a queue.

    Returns [{"term": str, "weight": float}, ...], strongest first. Empty if the
    model type does not expose coefficients.
    """
    model = load_model()
    clf = model.named_steps["clf"]
    if not hasattr(clf, "coef_"):
        return []

    features = model.named_steps["features"]
    word_vec = dict(features.transformer_list)["word"]

    # The FeatureUnion concatenates word features first, then char features, so
    # the word block is the leading slice of every coefficient row.
    word_names = word_vec.get_feature_names_out()
    n_word = len(word_names)

    predicted = str(model.predict([text])[0])
    classes = list(clf.classes_)
    row = clf.coef_[classes.index(predicted)] if len(classes) > 2 else clf.coef_[0]

    tfidf = word_vec.transform([text])
    contributions = []
    for idx, value in zip(tfidf.indices, tfidf.data):
        weight = float(value * row[idx])
        if weight > 0:  # only what argued FOR the predicted tier
            contributions.append({"term": str(word_names[idx]), "weight": weight})

    contributions.sort(key=lambda c: c["weight"], reverse=True)
    return contributions[:top_n]


def predict_label(text: str) -> dict:
    """Return the hybrid severity decision for one message.

    {"mlLabel": ..., "confidence": float, "ruleOverride": bool, "finalLabel": ...}
    -- exactly the contract the backend consumes (spec.md 6.3.5).
    """
    model = load_model()
    ml_label = str(model.predict([text])[0])
    if hasattr(model, "predict_proba"):
        confidence = float(model.predict_proba([text])[0].max())
    else:
        confidence = 1.0
    sn = safety_net.check(text)
    rule_override = sn["triggered"]
    final_label = "RED" if rule_override else ml_label
    return {
        "mlLabel": ml_label,
        "confidence": confidence,
        "ruleOverride": rule_override,
        "finalLabel": final_label,
    }


if __name__ == "__main__":
    load_model()
    demo = [
        "I haven't passed any urine since yesterday",   # RED (safety net + model)
        "My ankles have been swelling for two days",    # YELLOW
        "Can I eat bananas on my current diet?",         # GREEN
        "My heart is racing and I feel like I might drop",  # RED-ish, model-driven
    ]
    for msg in demo:
        print(predict_label(msg), "|", msg)
