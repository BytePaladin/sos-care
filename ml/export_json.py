import os
import json
import joblib
import numpy as np

def export_model_to_json(model_path, json_path):
    print(f"Loading model from {model_path}...")
    pipeline = joblib.load(model_path)
    
    features = pipeline.named_steps["features"]
    clf = pipeline.named_steps["clf"]
    
    # Extract word vectorizer
    word_vec = dict(features.transformer_list)["word"]
    char_vec = dict(features.transformer_list)["char"]
    
    # We need to know if clf is CalibratedClassifierCV or directly a linear model
    # If CalibratedClassifierCV, extracting coefficients is harder because there are multiple estimators.
    if hasattr(clf, "calibrated_classifiers_"):
        print("CalibratedClassifierCV detected. For a pure JS implementation, we should ideally retrain a LogisticRegression which natively outputs probabilities, or just use the first base estimator (which gives margins) for simplicity.")
        
        # Let's extract the first base estimator just to see if we can
        base_clf = clf.calibrated_classifiers_[0].base_estimator
        if hasattr(base_clf, "coef_"):
            coef = base_clf.coef_.tolist()
            intercept = base_clf.intercept_.tolist()
        else:
            coef = None
            intercept = None
    else:
        coef = clf.coef_.tolist()
        intercept = clf.intercept_.tolist()
        
    data = {
        "word_vocab": word_vec.vocabulary_,
        "word_idf": word_vec.idf_.tolist() if hasattr(word_vec, "idf_") else None,
        "char_vocab": char_vec.vocabulary_,
        "char_idf": char_vec.idf_.tolist() if hasattr(char_vec, "idf_") else None,
        "coef": coef,
        "intercept": intercept,
        "classes": clf.classes_.tolist()
    }
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"Model exported to {json_path}")

if __name__ == "__main__":
    model_path = os.path.join(os.path.dirname(__file__), "models", "severity_model.joblib")
    json_path = os.path.join(os.path.dirname(__file__), "models", "severity_model_weights.json")
    if os.path.exists(model_path):
        export_model_to_json(model_path, json_path)
    else:
        print("Model not found. Train it first!")
