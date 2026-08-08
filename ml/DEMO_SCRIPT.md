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

## 3b. Week 5 — safety-net parity and Bengali

**Parity.** The project has two safety nets: `ml/safety_net.py` (Python, used by
the ML tools) and `server/services/safetyNet.js` (JavaScript, the one that
actually runs in the app). They had drifted: the thunderclap-headache rule from
Week 3 existed only in Python, so **the fix was never live in the running
system**. Both are now pinned to one shared corpus.

```bash
cd ml && python -m pytest tests/test_safety_net_parity.py -q
```

[Say: "the test runs the same messages through both implementations and fails if
they disagree. When I first ran it, it found three real gaps — the backend
missed 'struggling to breathe' and 'the bleeding won't stop', and my Python
layer missed 'cannot urinate'. All three are fixed and can't silently come back."]

**Bengali.** Neither layer understood Bengali before this week. Show it live in
the app (§4) with:

| Message | Expected |
|---|---|
| `বুকে ব্যথা করছে` (chest pain) | RED + safety-net override |
| `গতকাল থেকে প্রস্রাব হচ্ছে না` (no urine since yesterday) | RED + override |
| `দুই দিন ধরে পা ফুলে আছে` (legs swollen two days) | YELLOW |
| `আমি কি কলা খেতে পারব` (can I eat bananas) | GREEN |

## 3c. Week 6 — honest evaluation (the most important part)

```bash
cd ml && python training/train.py --data dataset_v3.csv
```

Point at three things in the output:

1. **`170 distinct templates` for 1124 messages.** Each template makes ~6.6
   near-identical messages.
2. **The 70/30 split is by template**, so no sentence and its near-twin land on
   opposite sides.
3. **The leakage line at the end:** a random split reports **0.993** accuracy;
   the honest grouped split reports **0.827**.

[Say: "our earlier 100% accuracy was not real. The data is template-generated,
so a random split trains on one variant of a sentence and tests on its twin —
the model was being scored on things it had memorised. Splitting by template
instead drops accuracy to 83%, and that is the number I trust."]

Then the strictest test — 56 messages written by hand in unfamiliar phrasing:

```bash
python evaluate.py
```

[Say: "on phrasing the model has genuinely never seen, accuracy is 73% and it
misses seven urgent messages — things like 'my pee has completely stopped' and
'a heavy weight sitting on my chest'. The safety net misses them too, because it
matches keywords and the patient didn't use the expected words. That's a real
limitation and it's written up in VALIDATION.md, along with why I did *not* just
add those seven phrases to the rules — that would be tuning to the test set."]

**The number that defends the architecture:** on the held-out test set the model
alone catches 79% of urgent messages; with the safety net the system catches
**98.7%**. The rule layer rescued 31 of the 33 the model missed.

## 4. Full-stack end-to-end demo (the main event)

Start all three services per the root [README](../README.md), then open
http://localhost:5173.

**As the patient** (log in `01700000000` / `password123`):

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

**As the staff** (log out, log in `01800000000` / `password123`):

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
