import os
import joblib
from skl2onnx import to_onnx
from skl2onnx.common.data_types import StringTensorType
import numpy as np

# Load the trained joblib model
model_path = os.path.join(os.path.dirname(__file__), "models", "severity_model.joblib")
if not os.path.exists(model_path):
    print("Model not found at", model_path)
    exit(1)

model = joblib.load(model_path)
print("Model loaded successfully.")

# Convert to ONNX
# We use a simple string input for the pipeline
try:
    onx = to_onnx(model, initial_types=[("text_input", StringTensorType([None, 1]))])
    onnx_path = os.path.join(os.path.dirname(__file__), "models", "severity_model.onnx")
    with open(onnx_path, "wb") as f:
        f.write(onx.SerializeToString())
    print("ONNX model saved successfully to", onnx_path)
except Exception as e:
    print("Error during ONNX conversion:", e)
    # If ONNX fails (e.g. because of custom preprocessors), we might need to write a custom JSON exporter
