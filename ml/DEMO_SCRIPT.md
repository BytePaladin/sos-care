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

## 3. This week's finding — dataset v2 / error analysis

Show the *before* state was a real gap, then the *after* fix:

| Message | v1 (before) | v2 (now, after this week's work) |
|---|---|---|
| `sudden severe headache, worst one of my life` | GREEN (model missed it, safety net didn't cover it) | **RED** — now caught by a new safety-net pattern (`thunderclap_headache`) |
| `my urine smells strange` | RED (spurious) | **YELLOW** (correct) |
| `i have a headache` / `i am feeling high headache` / `i am feeling very high headache` | flipped GREEN/YELLOW/YELLOW across near-identical phrasings | stable **YELLOW** across all three |

[Say: "we probed the live model with phrasings the training data never
covered and found a genuine safety gap — a thunderclap headache, a classic
stroke/hemorrhage red flag, was coming back GREEN. We traced it to zero
headache templates in the dataset, fixed it two ways: added a safety-net
pattern so it's caught deterministically, and expanded the dataset (v1 → v2,
630 → 772 rows) so the classifier itself learns the symptom. See
[models/VALIDATION.md](models/VALIDATION.md) for the full before/after
metrics and the reproduction steps."]

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
