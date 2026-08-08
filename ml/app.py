"""Flask ML microservice for S.O.S. (spec.md 6.3.5).

Exposes the hybrid classifier + safety net as a single endpoint the Express
backend calls. This service is the ONLY thing that touches the model; the rest
of the system speaks to it over HTTP, which keeps the ML module swappable
(spec.md 2.3, modularity).

    GET  /health   -> { "status": "ok", "modelLoaded": bool }
    POST /predict  -> body { "text": "..." }
                      { "mlLabel", "ruleOverride", "finalLabel" }

Run from the `ml/` directory:  python app.py   (defaults to port 5001)
"""

import os

from flask import Flask, jsonify, request
from flask_cors import CORS

import predict

app = Flask(__name__)
CORS(app)  # backend runs on a different origin during development


@app.get("/health")
def health():
    return jsonify({"status": "ok", "modelLoaded": predict.is_model_loaded()})


@app.post("/predict")
def predict_route():
    data = request.get_json(silent=True) or {}
    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Request body must include a non-empty 'text' string."}), 400
    try:
        result = predict.predict_label(text)
        # Response shape is fixed by server/docs/ML_SERVICE_CONTRACT.md (v1):
        # `label` + `confidence`, lowercase. Per that contract the service
        # returns the *classifier's* label only -- the safety net and the final
        # override decision belong to the backend, so that a model bug can never
        # disable them. mlLabel/ruleOverride/finalLabel are kept alongside for
        # the standalone CLI tools and for debugging; the backend ignores them.
        return jsonify({
            "label": result["mlLabel"].lower(),
            "confidence": result["confidence"],
            "model_version": predict.model_version(),
            "mlLabel": result["mlLabel"],
            "ruleOverride": result["ruleOverride"],
            "finalLabel": result["finalLabel"],
        })
    except FileNotFoundError as e:
        # Model not trained yet -- fail loudly so the backend can apply its
        # YELLOW fail-safe (spec.md NFR2) rather than get a wrong label.
        return jsonify({"error": str(e)}), 503


if __name__ == "__main__":
    # Warm the model at startup so /health reports true and the first request
    # isn't slow. If it isn't trained yet, start anyway and report modelLoaded=false.
    try:
        predict.load_model()
        print("Model loaded.")
    except FileNotFoundError as e:
        print(f"WARNING: {e}")
    port = int(os.environ.get("ML_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
