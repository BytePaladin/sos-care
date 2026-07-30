# Model Validation — Dataset v1 vs v2 (Week 5–6 ML deliverable)

Ties to [plan.md](../plan.md) Week 5 ("dataset v2 expansion driven by error
analysis") and Week 6 ("final model validation writeup"). Both `metrics_v1.json`
and `metrics_v2.json` are archived in this folder alongside `metrics.json`
(always the metrics for whichever model is currently deployed at
`severity_model.joblib` — that's v2 as of this writeup).

## 1. Error analysis (what drove v2)

`try_it.py` was probed with realistic paraphrases the templated v1 dataset
never covered. Two concrete failures stood out:

| Message | v1 result | Problem |
|---|---|---|
| "sudden severe headache, worst one of my life" | **GREEN** | A thunderclap headache is a textbook red flag for subarachnoid hemorrhage / hypertensive emergency. The model alone missed it, and the safety net didn't cover it either — a genuine gap in the project's core safety guarantee. |
| "my urine smells strange" | **RED** | No clinical basis for urgency; the model was pattern-matching lexical overlap with unrelated RED templates rather than symptom severity. |
| "headache" phrased in slightly different ways (`i have a headache` vs `i am feeling high headache` vs `very high headache`) | **flipped between GREEN and YELLOW** | Zero headache templates existed in v1's YELLOW/GREEN pools, so predictions on that symptom were essentially noise. |
| "abdominal pain" phrasings | **unstable** | Only flank/kidney-area pain was templated; generic abdominal pain had no coverage. |

Root cause: v1's 630 rows are template-generated, so any real-world phrasing of
a symptom absent from the templates gets an unreliable, unstable prediction.

## 2. Fixes applied for v2

- **Safety net** ([safety_net.py](../safety_net.py)): added a `thunderclap_headache`
  pattern (`worst headache of my life`, `sudden severe headache`, etc.) so this
  class of message is caught deterministically, independent of model quality.
  Pinned with new tests in `tests/test_safety_net.py` (both a must-trigger case
  and a must-NOT-trigger "mild headache" case, to guard against over-escalation).
- **Dataset v2** ([training/build_dataset.py](../training/build_dataset.py)):
  added templates for headache (GREEN/YELLOW/RED-via-safety-net), abdominal pain
  (YELLOW/RED-with-fever), and unusual urine odor (YELLOW) — the exact gaps
  found above. Dataset grew from 630 → 772 rows (`--target-per-class 260`, up
  from 210, since the larger template pool supports it).

## 3. Metrics: v1 vs v2 (5-fold stratified CV, selected model = logreg both times)

| Metric | v1 (630 rows) | v2 (772 rows) |
|---|---|---|
| Accuracy | 0.998 | 1.000 |
| Macro-F1 | 0.998 | 1.000 |
| RED recall | 1.000 | 1.000 |

RED recall was already perfect in v1 on its own template distribution — the
v2 gain is in **coverage and stability**, not raw CV accuracy: the previously
undertrained symptoms (headache, abdominal pain, urine odor) now have adequate
templated support, closing the misclassification and instability found above.

## 4. Post-fix verification

Re-running the exact probe messages from §1 against the v2 model + updated
safety net:

| Message | v2 result |
|---|---|
| "sudden severe headache, worst one of my life" | **RED** (safety net triggered) |
| "my urine smells strange" | **YELLOW** |
| "i have a headache" / "i am feeling high headache" / "i am feeling very high headache" | **YELLOW** (stable across phrasings) |
| "i am feeling high abdominal pain" | **YELLOW** |
| "severe abdominal pain with fever" | **RED** |
| "mild stomach ache after eating" | **GREEN** |

Full regression: `python -m pytest -q` → 32/32 passing, including the two new
safety-net cases.

## 5. Reproducing this

```bash
cd ml
python training/build_dataset.py --version 2 --target-per-class 260   # regenerate data/dataset_v2.csv
python training/train.py --data dataset_v2.csv                        # retrain + redeploy severity_model.joblib
python -m pytest -q                                                   # 32 passed
```
