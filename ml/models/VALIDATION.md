# Model Validation — S.O.S. severity classifier

> **v4 update.** Evaluation on hand-written messages showed the model failing on
> ordinary patient language. v4 addresses that: colloquial training data, wider
> safety-net rules, tuned hyperparameters, and a calibrated SVM. On the same
> independent test set, deployed RED recall rose **68.2% → 95.5%** and messages
> missed by both layers fell **7 → 1**. §8 reports it in full, including a
> sealed set that was written before any tuning began.

Covers dataset v1 → v4 and the evaluation protocol. Metrics files
(`metrics_v1.json` … `metrics_v4.json`) are archived alongside this document;
`metrics.json` always describes whichever model is currently deployed at
`severity_model.joblib`.

---

## 1. Headline result

**On hand-written messages that played no part in building the model, the
deployed system is right 87.5% of the time and catches 82% of urgent cases.**

That figure comes from a set written and sealed *before* any tuning began
(§8.2), so it is the one to quote. The earlier "100% accuracy" was an artefact
of data leakage — §3 explains how it was found and corrected.

| Measured on | Model alone | Deployed system |
|---|---|---|
| **Sealed hand-written set** (56 messages, §8.4) | 0.821 | **0.875** acc / **0.818** RED recall |
| Held-out templates (408 messages, §3) | 0.833 | 0.858 acc / 0.837 RED recall |
| Naive random split — *shown only to expose the leakage* | 0.994 | — |

Current model: **calibrated linear SVM, dataset v4**. Sections 2–7 describe how
the evaluation reached this point; §8 covers the v4 improvements.

---

## 2. What changed in each dataset version

| | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| Messages | 630 | 772 | 1124 | 1324 |
| Templates | — | — | 170 | 202 |
| Languages | English | English | + Bengali | + Bengali |
| Safety-net rules | 9 | 10 | 17 | 23 |
| Register | clinical | clinical | clinical | + colloquial |

**v2 (Week 3)** came from error analysis. Probing the v1 model with realistic
paraphrases showed *"sudden severe headache, the worst one of my life"* being
labelled **GREEN**. A thunderclap headache is a red flag for subarachnoid
haemorrhage, so this was a genuine safety defect. The cause was that the
training data contained no headache examples at all. It was fixed in two
independent places: a safety-net rule that escalates without consulting the
model, and new training examples so the classifier learns the symptom itself.

**v3 (Week 5)** added Bengali. Patients at a Bangladeshi kidney hospital write
in Bengali, and neither layer handled it — a Bengali message describing chest
pain was simply not understood. Bengali templates were added across all three
tiers and Bengali patterns were added to both safety nets.

---

## 3. The evaluation was wrong, and how it was fixed

*Numbers below are the v3 measurement that first exposed the leakage; the method
described here is still what `train.py` does.*

### The problem

The dataset is template-generated: one template such as
`"my legs and ankles have been swelling {t}"` expands into many messages that
differ only by a context prefix or time phrase. Across v3 there are **1124
messages but only 170 templates — about 6.6 near-duplicates each**.

A standard random train/test split puts some of those near-duplicates in
training and their siblings in test. The model is then scored on sentences it
has effectively already memorised. That is textbook data leakage, and it is why
v1 and v2 reported accuracy near 100%.

### The fix

All splitting is now done by **template**, not by row, so every sibling of a
sentence stays on the same side of the split:

1. **Hold out 30% of templates** as a test set (`GroupShuffleSplit`).
2. **Select the model** with 5-fold `StratifiedGroupKFold` on the training set
   only — the test set is never consulted during selection.
3. **Evaluate once** on the held-out test set. Those are the reported numbers.
4. **Refit on all data** for deployment, standard practice once the estimate
   has been obtained.

`training/train.py` asserts that no template appears on both sides of the split.

### How large the leakage was

The same model, same data, evaluated both ways:

| Evaluation | Accuracy | RED recall (model alone) |
|---|---|---|
| Random split (leaky) | 0.993 | 0.990 |
| **Grouped split (honest)** | **0.827** | **0.790** |

**A random split overstates accuracy by 16.6 points.** `train.py` prints both
so the gap is visible rather than hidden.

### Model selection criterion

The winner is chosen by the **RED recall of the deployed system**, not of the
classifier in isolation, because that is what determines whether an urgent
message reaches staff. Macro-F1 breaks ties, so among equally safe models the
more balanced one wins rather than one that escalates everything.

---

## 4. What the safety net is actually worth

*Figures in this section are from the v3 measurement, kept as the record of how
the hybrid design was first justified. See §8.4 for the current numbers.*

Because the safety net is deterministic and can only escalate, its contribution
can be measured directly. On the held-out test set:

- The model alone missed **33 of 157** urgent messages.
- The safety net rescued **31** of those.
- **2** were missed by both layers.

RED recall therefore rises from **0.790 → 0.987**. This is the strongest
available evidence for the hybrid architecture: the classifier is not reliable
enough on its own for a safety-critical decision, and the rule layer is what
makes the system trustworthy.

---

## 5. Independent evaluation (the strictest test)

*This section records the v3 result — the failures listed here are what drove
the v4 improvements in §8. The current figures are in §8.4.*

The held-out test set still uses the generator's phrasing style. `evaluate.py`
runs a second set — `data/heldout_eval.csv`, **56 messages written by hand** in
deliberately different language: colloquialisms (*"my pee has completely
stopped"*), third-person reports (*"my husband said I was shaking"*), and
clinical signs described in lay terms (*"looked like coffee grounds"*).

```bash
cd ml && python evaluate.py
```

| | Model alone | Deployed system |
|---|---|---|
| Accuracy | 0.714 | 0.732 |
| RED recall | 0.636 | 0.682 |

**Performance drops substantially on genuinely unfamiliar phrasing**, and this
is the most realistic estimate available. Seven urgent messages were missed by
both layers:

| Message | Labelled | Should be |
|---|---|---|
| "Hi doc my pee has completely stopped since morning" | YELLOW | RED (anuria) |
| "no wee at all today and my belly feels tight" | YELLOW | RED (anuria) |
| "feels like i cant get enough air in" | GREEN | RED (dyspnoea) |
| "theres a heavy weight sitting on my chest" | GREEN | RED (chest pain) |
| "passing something dark red in my water" | GREEN | RED (haematuria) |
| "i threw up something that looked like coffee grounds" | GREEN | RED (haematemesis) |
| "my whole body has swelled up and i cannot lie flat" | GREEN | RED (fluid overload) |

The pattern is clear: **the safety net matches keywords, so it fails when a
patient describes an emergency without using the expected words.** "Pee has
stopped" is anuria; "heavy weight on my chest" is chest pain. Neither matches a
rule.

There were also 3 false escalations (YELLOW messages marked RED), which matter
because a queue full of false alarms hides real ones.

### A caveat on the Bengali figures

By language, the deployed system scored **0.650 on English and 0.938 on
Bengali**. This does *not* mean the model is better at Bengali. The Bengali
templates and the Bengali evaluation messages were written by the same author in
the same session, so they are stylistically closer to each other than the
English pairs are — the English evaluation messages were deliberately written in
unfamiliar idiom. The Bengali number should be read as optimistic until it can
be checked against text written by someone else.

---

## 6. Known limitations

1. **Keyword-based escalation misses paraphrases.** §5 gives seven concrete
   examples. Widening the rules is the obvious next step, but doing it using
   these seven messages would mean tuning to the test set — a fresh evaluation
   set must be written before the improvement can be honestly measured.
2. **The data is synthetic.** Messages are template-generated and clinically
   grounded, but they are not real patient text. No public dataset maps
   Bengali/English kidney-symptom chat to urgency levels, which is why the
   corpus was self-constructed.
3. **The evaluation set is small** (56 messages), so per-class figures carry
   wide confidence intervals.
4. **Bengali coverage is narrower than English** — fewer templates, and no
   dialect or transliterated ("banglish") variants, which real patients use.

---

## 7. Reproducing everything

```bash
cd ml
python training/build_dataset.py --version 4 --target-per-class 500
python training/train.py --data dataset_v4.csv --tune   # 70/30 by template + search
python evaluate.py                                       # independent set
python evaluate.py --data data/heldout_eval_v2.csv       # sealed set
python compare_versions.py                          # v1 vs v2 before/after
python -m pytest -q                                      # 254 tests, includes parity
```

---

## 8. v4 — improving the model, and measuring it honestly

### 8.1 What the evidence said to fix

§5 showed the model failing on ordinary patient language. It recognised
*"I have not passed urine"* but not *"my pee has stopped"*; *"chest pain"* but
not *"a heavy weight sitting on my chest"*. Both the training data and the
safety-net rules were written in clinical register, so lay phrasing — which is
what patients actually type — was barely represented anywhere.

### 8.2 Guarding against tuning to the test set

The failures in §5 came from `heldout_eval.csv`. Using them to guide changes and
then reporting on that same file would be tuning to the test set: the score
would improve without the model necessarily getting better.

So **a second evaluation set was written first and sealed** —
`data/heldout_eval_v2.csv`, 56 new hand-written messages — and was not run
against the model until every change below was finished. Both numbers are
reported in §8.4, because they answer different questions.

### 8.3 What changed

| Change | Why |
|---|---|
| **Colloquial training templates** (RED and YELLOW) | Teach the everyday register for the same emergencies. Written independently of both evaluation sets — the aim is to cover the vocabulary, not memorise the tests. |
| **Colloquial safety-net rules** (6 new groups, both layers) | *"pee stopped"*, *"weight on my chest"*, *"coffee grounds"*, *"keeled over"*. Kept deliberately narrow: *"peeing less"* must stay YELLOW. |
| **Hyperparameter search** (`GridSearchCV`, grouped CV, training set only) | `C=10` and `C=1.0` were inherited defaults, never tuned. Scored by macro-F1 — optimising RED recall directly would reward a model that escalates everything. |
| **Calibrated SVM** (`CalibratedClassifierCV`) | `LinearSVC` has no `predict_proba`. Without calibration, selecting the SVM would have silently turned the clinician-facing confidence score into a constant and blocked threshold tuning. |
| **Dataset v4** | 1124 → **1324** messages, 170 → **202** templates. |

### 8.4 Results

**On `heldout_eval.csv` — the same messages the v3 model was measured on:**

| | v3 (before) | v4 (after) |
|---|---|---|
| Model accuracy | 0.714 | **0.875** |
| Model RED recall | 0.636 | **0.818** |
| Deployed accuracy | 0.732 | **0.929** |
| **Deployed RED recall** | 0.682 | **0.955** |
| Missed by both layers | 7 | **1** |
| False escalations | 3 | **1** |

This is a like-for-like comparison, but it is **optimistic**: this set informed
the changes, so the model has in effect been shown the kind of thing it is being
tested on.

**On `heldout_eval_v2.csv` — sealed before tuning, opened once:**

| | Model alone | Deployed system |
|---|---|---|
| Accuracy | 0.821 | **0.875** |
| Macro-F1 | 0.818 | 0.871 |
| RED recall | 0.682 | **0.818** |

4 urgent messages were missed by both layers, and there was 1 false escalation.
**This is the number to trust** — it is the only one measured on data that played
no part in the changes.

### 8.5 A tuning result that was rejected

Threshold tuning was implemented and then **not adopted**. Lowering the bar for
predicting RED did raise recall, but at a 0.60 precision floor it cost 10 points
of overall accuracy for 6.6 points of RED recall — flooding the queue with false
alarms, which hides real emergencies just as effectively as missing them. At a
defensible 0.75 floor, no threshold beat the ordinary decision rule, so the
default was kept. The search is still in `train.py --tune` and reports this
explicitly rather than quietly selecting a worse operating point.

### 8.6 What is still wrong

Four urgent messages in the sealed set were missed by both layers:

| Message | Labelled | Should be |
|---|---|---|
| "i keep gasping and cant fill my lungs" | GREEN | RED |
| "sudden crushing headache unlike anything before" | GREEN | RED |
| "so puffed up i had to sleep sitting in a chair" | GREEN | RED |
| "বুকটা চেপে ধরে আছে ব্যথায়" (chest gripped with pain) | YELLOW | RED |

Three are English paraphrases still outside the rules, and one is Bangla — Bangla
has fewer templates and fewer rules than English, so its coverage of unusual
phrasing is thinner. Fixing these would require a third evaluation set to
measure honestly, which is the same discipline applied in §8.2.
