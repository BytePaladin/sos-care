# Model Validation — S.O.S. severity classifier

Covers dataset v1 → v3 and the evaluation protocol. Metrics files
(`metrics_v1.json` … `metrics_v3.json`) are archived alongside this document;
`metrics.json` always describes whichever model is currently deployed at
`severity_model.joblib`.

---

## 1. Headline result

**On messages phrased in ways the model has never seen, the classifier alone is
right about 83% of the time and catches 79% of urgent cases. The deployed
system — classifier plus the deterministic safety net — catches 98.7% of urgent
cases.**

The earlier "100% accuracy" figure was an artefact of data leakage. §3 explains
how it was found and corrected.

| | Model alone | Deployed system (model + safety net) |
|---|---|---|
| Accuracy | 0.827 | 0.916 |
| Macro-F1 | 0.844 | — |
| **RED recall** | 0.790 | **0.987** |

Held-out test set: 347 messages generated from 51 templates that appear nowhere
in training. Selected model: logistic regression, dataset v3.

---

## 2. What changed in each dataset version

| | v1 | v2 | v3 |
|---|---|---|---|
| Messages | 630 | 772 | 1124 |
| Templates | — | — | 170 |
| Languages | English | English | English + Bengali |
| Safety-net rules | 9 | 10 | 17 |

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
python training/build_dataset.py --version 3 --target-per-class 400
python training/train.py --data dataset_v3.csv     # 70/30 by template
python evaluate.py                                  # independent hand-written set
python compare_versions.py                          # v1 vs v2 before/after
python -m pytest -q                                 # 254 tests, includes parity
```
