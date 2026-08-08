# Demo script — Week 5–6 ML progress recording

Run from `ml/`: `python try_it.py`. Paste each message below and narrate the
point in brackets. This matches plan.md's Week 6 exit criterion: "one clear
message per tier plus one safety-net override that the model alone would have
missed."

## 1. Baseline tiers (model-driven, safety net not needed)

| Type | Message | Expected |
|---|---|---|
| GREEN | `Can I eat bananas on my current diet?` | GREEN, safety net not triggered |
| YELLOW | `My legs and ankles have been swelling for two days` | YELLOW, safety net not triggered |
| RED | `My heart is racing and I feel like I might drop` | RED, model-driven (no exact safety-net phrase — the classifier itself has to catch this) |

[Say: "these three show the classifier alone correctly separating routine,
watch, and urgent messages."]

## 2. The safety-net override — the project's core guarantee

| Message | Expected |
|---|---|
| `I haven't passed any urine since yesterday` | RED — **safety net TRIGGERED**, forces RED regardless of the model's own prediction |

[Say: "this is the deterministic layer — even if the classifier were wrong,
this phrase alone forces RED. That's the guarantee spec.md §11 requires."]

## 3. The ML finding — before vs after, side by side (the Week 3 demo)

One command reconstructs the old model from `dataset_v1.csv` and runs the same
messages through both versions:

```bash
cd ml
python compare_versions.py
```

It prints a `v1 (before) → v2 (after)` table. The headline row:

```
GREEN  ->  RED + net     RED     sudden severe headache, worst one of my life
```

...and a summary line: **5 corrected, 0 still wrong**. The last three rows are
controls that already worked in v1 and are unchanged — that's the evidence the
fix didn't break anything else.

[Say: "I tested the model with realistic phrasings that were not in its training
data. It marked a thunderclap headache — a warning sign of bleeding in the brain
— as GREEN, routine. The cause was that the training data had no headache
examples at all, so the model had never learned the symptom. I fixed it in two
places: a safety-net rule that forces RED without consulting the model, and new
training examples so the model learns it too. This table is the before and
after, and the bottom three rows prove nothing else regressed."]

To show the accuracy numbers behind it:

```bash
python -c "import json; d=json.load(open('models/metrics_v2.json')); r=d['results'][d['selected_model']]; print('accuracy', round(r['accuracy'],4), '| RED recall', r['red_recall'])"
```

Full write-up with metrics tables: [models/VALIDATION.md](models/VALIDATION.md).

## Week 5 — Building the Bangla language model

**The problem.** Patients at a Bangladeshi kidney hospital write in Bangla. The
model had only ever seen English, and neither safety layer recognised a single
Bangla word. A patient typing "বুকে ব্যথা করছে" (chest pain) got no useful triage.

**What was built:**

1. **Bangla training data.** Bangla templates were written across all three
   tiers -- urgent (anuria, breathlessness, chest pain, bleeding, seizure),
   watch-level (swelling, weakness, reduced urine, itching, fever) and routine
   (diet, appointments, medicine timing). Bangla is verb-final, so the time
   expression sits at the front of the sentence rather than the end, and the
   templates are built that way rather than translated word for word.
2. **Bangla safety-net rules.** 7 new deterministic rules, in *both* the Python
   and JavaScript layers, so an explicit Bangla emergency escalates even if the
   model is wrong or offline.
3. **Retrained the model** as dataset v3 -- one bilingual model rather than two,
   so no language detection step is needed before classification.

```bash
cd ml
python training/build_dataset.py --version 3 --target-per-class 400
python training/train.py --data dataset_v3.csv
```

[Say: "the dataset went from 772 English messages to 1124 bilingual ones. I did
not train a separate Bangla model -- the character n-gram features let one model
learn both scripts, so there is no language-detection step that could fail."]

**Prove it works, standalone:**

```bash
python try_it.py
```

| Message | Meaning | Expected |
|---|---|---|
| `বুকে ব্যথা করছে` | chest pain | RED + safety net |
| `গতকাল থেকে প্রস্রাব হচ্ছে না` | no urine since yesterday | RED + safety net |
| `দুই দিন ধরে পা ফুলে আছে` | legs swollen two days | YELLOW |
| `আমি কি কলা খেতে পারব` | can I eat bananas | GREEN |

**And prove the two safety nets agree** -- the Bangla rules exist twice, in
Python and in JavaScript, so a test pins them to one shared corpus:

```bash
python -m pytest tests/test_safety_net_parity.py -q
```

[Say: "this runs the same Bangla and English messages through both
implementations and fails if they ever disagree. When I first wrote it, it
caught three real inconsistencies."]

**How the model was measured honestly.** The dataset is template-generated:
1124 messages from only 170 templates. A random train/test split would put a
sentence in training and its near-twin in test, so the score would be inflated.
Everything is split by template instead:

```
random split (leaky)   : 0.993 accuracy
grouped split (honest) : 0.827 accuracy
```

[Say: "this is why I stopped reporting 100%. Splitting by template drops it to
83%, and that is the number I trust."]

## Week 6 — Integrating the Bangla model into the system

The model is only useful if a Bangla message reaches it through the real
application. Week 6 wired it end to end and made the decision visible.

**1. The ML service now declares a version and an explanation.** `/predict`
returns the label, a confidence score, the model version, and the terms that
drove the decision -- while still satisfying the contract the backend team
froze:

```bash
cd server && npm run check:ml     # 10 passed, 0 failed
```

**2. Bangla flows through the whole stack.** Log in as the patient, start a
**New Chat**, and type each Bangla message from the table above. The severity
badge appears on the reply, and the case lands in the staff queue.

**3. The doctor's dashboard now explains itself.** Open a RED case and look at
the **"Why this ranking"** panel:

- a **confidence** figure
- **🛡 Safety-net rule triggered** with the rules that fired (e.g. `breathing`,
  `chest pain`)
- **the terms that drove the model's decision**, as a weighted bar chart

[Say: "before this, the dashboard showed a colour and asked the doctor to trust
it. Now it shows which layer made the decision and on what evidence. For a
medical tool that matters -- a clinician should not be asked to accept an
unexplained label. The explanation is exact rather than approximate, because the
classifier is linear: each term's contribution is its TF-IDF value times the
model's weight, and those contributions add up to the decision itself."]

**4. The fail-safe still holds.** Stop the ML service and send another message:
the system degrades to YELLOW rather than failing, and Bangla emergencies are
still escalated to RED by the safety net.

## 4. Full-stack end-to-end demo (the main event)

Start all three services per the root [README](../README.md), then open
http://localhost:5173.

**As the patient** (log in `01700000000` / `Demo@1234`):

Send each message in its own chat (click **New Chat** between them) and point out
the severity badge that appears on the reply:

| Message | Badge shown |
|---|---|
| `Can I eat bananas on my current diet?` | GREEN |
| `My legs and ankles have been swelling for two days` | YELLOW |
| `My heart is racing and I feel like I might drop` | RED (model caught it alone — no safety-net badge) |
| `I haven't passed any urine since yesterday` | RED **+ safety-net override** badge |

[Say: "the badge comes from the backend, not the browser — the message went to
Express, which called the Flask classifier and ran the safety net."]

**As the staff** (log out, log in `01800000000` / `Staff@1234`):

The Clinical Triage Desk shows those four cases with REDs sorted to the top.
Open the anuria case and show the **CLINICAL LOGS & NOTES** panel:

```
System (Safety-Net)
Force-escalated to RED. Rule hits: ANURIA. ML label was: red.
```

[Say: "this is the audit trail — it records what the model said and why the
deterministic layer overrode it. That's the guarantee spec.md §11 requires."]

## 5. Fail-safe — ML service down (spec.md NFR2)

With the stack running, stop the Flask service (Ctrl+C in the `ml/app.py`
terminal), then:

```bash
curl http://localhost:5000/api/health
```

It reports `mlService: "offline (fallback heuristic active)"`. Now send another
message from the patient chat:

- A symptom message still gets logged — degraded to **YELLOW**, never silently GREEN.
- `I haven't passed any urine since yesterday` **still returns RED**, because the
  safety net is deterministic and runs inside the backend, independent of the model.

[Say: "killing the ML service degrades the system, it doesn't break it — and the
safety guarantee survives even with the model completely offline."]

Restart `python app.py` afterwards to return to normal.
