# S.O.S. — Machine Learning Microservice

The ML/AI module for **S.O.S. (Symptom Optimized Screener)** — owner: **Mohammad Imtiaz Hassan**.

It classifies a patient's free-text symptom message as **GREEN** (routine), **YELLOW** (needs review), or **RED** (urgent), reinforced by a deterministic rule-based safety net that force-escalates explicitly dangerous messages to RED. It runs as a standalone Flask service the backend calls over HTTP — see [../spec.md](../spec.md) §6.3.

## Module layout

```
ml/
├── data/dataset_v1.csv, dataset_v2.csv   # self-constructed labeled corpora (text,label)
├── training/
│   ├── build_dataset.py   # regenerates a dataset version from clinical templates
│   └── train.py           # compares LogReg vs Linear SVM, saves the winner
├── models/                # severity_model.joblib (gitignored) + metrics.json
│                          # + metrics_v1.json / metrics_v2.json (per-version archive)
│                          # + VALIDATION.md (v1 vs v2 error analysis and comparison)
├── preprocess.py          # shared text cleaning (baked into the model)
├── safety_net.py          # rule-based critical-phrase override
├── predict.py             # hybrid decision: model + safety net -> finalLabel
├── app.py                 # Flask service: /health, /predict
├── tests/test_safety_net.py   # pins the safety net's behavior
├── DEMO_SCRIPT.md         # scripted messages for the progress demo/recording
└── requirements.txt
```

## Setup

The scientific stack (scikit-learn, pandas, numpy, scipy, joblib) may already be
available system-wide. To create an isolated environment:

```bash
cd ml
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
```

## Usage

Run everything from the `ml/` directory:

```bash
# 1. (Re)build the dataset — reproducible, seeded (add --version/--target-per-class for a new version)
python training/build_dataset.py --version 2 --target-per-class 260

# 2. Train + evaluate; selects the model by RED recall, then macro-F1
python training/train.py --data dataset_v2.csv

# 3. Run the tests
python -m pytest -q

# 4. Start the service (default port 5001)
python app.py
```

See [models/VALIDATION.md](models/VALIDATION.md) for the v1 → v2 error analysis,
the metrics comparison, and reproduction steps. See
[DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a scripted walkthrough (tiers + safety-net
override + this week's fix) suitable for a progress recording.

### API

```
GET /health
  -> { "status": "ok", "modelLoaded": true }

POST /predict
  body:     { "text": "I haven't passed urine since yesterday" }
  response: { "mlLabel": "YELLOW", "ruleOverride": true, "finalLabel": "RED" }
```

Quick check once the service is running:

```bash
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"I can't breathe and my chest hurts\"}"
```

## How the hybrid label works

```
finalLabel = RED                 if the safety net flags a critical phrase
           = classifier(text)     otherwise
```

The safety net (`safety_net.py`) runs independently of the model, so classifier
error can never suppress an explicitly critical message — the project's core
safety guarantee ([../spec.md](../spec.md) §11).

## Dataset note

No public dataset maps patient-style kidney-symptom chat text to urgency levels,
so this one is **self-constructed** (a stated contribution of the project). The
messages are synthetic — template-generated with natural variation and grounded
in the proposal's clinical symptom-to-severity mapping and National Kidney
Foundation guidance on AKI/CKD warning signs. They are illustrative patient
phrasings, **not** real patient data. `build_dataset.py` verifies that no
GREEN/YELLOW message contains a safety-net phrase, so the two layers never
contradict each other. Dataset v2 (Week 5) expands this set from error analysis.
