"""Build the S.O.S. kidney-symptom-to-urgency dataset (v1).

No public dataset maps patient-style kidney-symptom chat text to urgency levels,
so we construct one (a stated contribution of the project, spec.md 6.3.1). This
script generates a reproducible, balanced corpus of patient-style messages
labeled GREEN / YELLOW / RED from clinically grounded templates, then writes
`ml/data/dataset_v1.csv` (columns: text,label).

Clinical grounding: the tier assignments follow the proposal's illustrative
symptom-to-severity mapping and National Kidney Foundation guidance on AKI/CKD
warning signs. Messages are synthetic (template-generated with natural
variation) -- they are illustrative patient phrasings, not real patient data.

Integrity check: every generated GREEN/YELLOW message is verified NOT to contain
a safety-net critical phrase, so the two layers never contradict each other on
the training data.

Run from the `ml/` directory:  python training/build_dataset.py
"""

import argparse
import csv
import os
import random
import sys

# Make the ml/ root importable so we can reuse the real safety-net layer.
_ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ML_ROOT)
import safety_net  # noqa: E402

SEED = 42

# Patient-context prefixes reflecting the kidney-care population.
CONTEXTS = [
    "",
    "I have CKD and ",
    "I'm on dialysis and ",
    "As a kidney patient, ",
    "I had a kidney transplant last year and ",
    "I have stage 3 kidney disease and ",
    "Since my kidney stone, ",
    "My doctor said I have reduced kidney function and ",
]

# Time / duration expressions for symptom messages.
TIMES = [
    "since yesterday",
    "for the last two days",
    "this morning",
    "since last night",
    "for a few days now",
    "over the past week",
    "since this afternoon",
]

# Polite openers for routine (GREEN) messages.
GREENERS = ["", "Hi, ", "Hello, ", "Quick question - ", "Good morning, ", "Please, "]

# --- RED: explicitly dangerous. Many contain a safety-net phrase (the layer and
#     the classifier then agree); {t} is a time expression. ---
RED_CORE = [
    "I haven't passed any urine {t}",
    "I have no urine output {t}",
    "I can't breathe properly {t}",
    "I've been short of breath {t}",
    "I'm having chest pain {t}",
    "there's blood in my urine and it won't stop",
    "I have heavy bleeding that won't stop {t}",
    "blood is coming through my urine {t}",
    "I noticed blood in my urine {t}",
    "I've been peeing blood {t}",
    "there's blood when I pee {t}",
    "I fainted {t}",
    "I passed out {t}",
    "I feel severely confused {t}",
    "I've been vomiting blood {t}",
    "I think I had a seizure {t}",
    "I can't catch my breath and my chest feels tight",
    "I have a sudden severe headache, the worst one of my life {t}",
    "this is the worst headache I've ever had {t}",
]

# --- RED (subtle): genuinely urgent but WITHOUT an exact safety-net phrase, so
#     the classifier itself must learn to escalate these. ---
RED_SUBTLE = [
    "my whole body is swelling and I feel like I'm drowning when I lie down",
    "I've been throwing up nonstop and can't keep any water down {t}",
    "my heartbeat feels irregular and I'm very weak and dizzy {t}",
    "I have severe pain in my side with a high fever and shaking chills {t}",
    "my legs are hugely swollen and now it's hard to lie flat {t}",
    "my blood pressure reads dangerously high with a pounding headache and blurry vision",
    "I'm extremely drowsy and can barely stay awake {t}",
    "I have crushing pain spreading to my arm and jaw",
    "my urine has turned dark like cola and I feel terrible {t}",
    "my abdominal pain is severe and I also have a high fever {t}",
    "I have severe abdominal pain that won't go away {t}",
]

# --- YELLOW: context-dependent kidney warning signs; must NOT contain a
#     safety-net phrase. ---
YELLOW = [
    "my legs and ankles have been swelling {t}",
    "my face looks puffy {t}",
    "I've been feeling very tired and weak {t}",
    "I feel nauseous and have lost my appetite {t}",
    "my urine looks foamy {t}",
    "I've been really itchy all over {t}",
    "I've gained a few kilos {t} and feel bloated",
    "my blood pressure has been higher than usual {t}",
    "I've had muscle cramps {t}",
    "my urine output seems lower than normal {t}",
    "I've been urinating less than usual {t}",
    "I'm peeing much less than before {t}",
    "I haven't been going to the bathroom as much {t}",
    "my urination has decreased {t}",
    "I'm not urinating as much as I used to {t}",
    "I'm going to the bathroom less often {t}",
    "not peeing much lately, is that normal?",
    "I haven't been peeing much lately",
    "barely peeing today, should I be worried?",
    "hardly went to the bathroom today",
    "is it normal that I'm peeing so little lately?",
    "I have pain near my kidneys {t}",
    "I have flank pain {t}",
    "my side hurts near where my kidney is {t}",
    "I have a dull ache in my kidney area {t}",
    "my back is hurting near my kidneys {t}",
    "I have some discomfort around my kidneys {t}",
    "I have a mild fever {t}",
    "I feel dizzy when I stand up {t}",
    "there's a metallic taste in my mouth {t}",
    "my eyes are puffy in the mornings {t}",
    "I've had trouble concentrating and feel foggy {t}",
    "my hands and feet feel swollen {t}",
    "I've had a dull headache and feel a bit off {t}",
    "I've been sleeping badly and feel restless {t}",
    "my ankles leave a dent when I press them {t}",
    "I have a headache {t}",
    "I have a mild headache {t}",
    "I've had a headache on and off {t}",
    "I have a bit of a headache today, nothing too bad",
    "I have some abdominal pain {t}",
    "I have mild abdominal discomfort {t}",
    "my stomach has been hurting a little {t}",
    "I have some abdominal cramping {t}",
    "my urine has an unusual smell {t}",
    "my urine smells different than usual {t}",
    "I've noticed a strange odor in my urine {t}",
]

# --- GREEN: routine dietary / administrative / general questions. ---
GREEN = [
    "can I eat bananas on my current diet?",
    "is it okay to have oranges with my potassium levels?",
    "how much salt is safe for me per day?",
    "can I drink coffee on my dialysis days?",
    "I need to reschedule my appointment next week",
    "can I book an appointment for next Monday?",
    "what time is my dialysis session tomorrow?",
    "I'd like to request a refill of my blood pressure medication",
    "should I take my phosphate binder before or after meals?",
    "are my last lab results available yet?",
    "can I travel by plane next month?",
    "is it safe for me to exercise at the gym?",
    "thank you for the help during my last visit",
    "which foods are high in potassium that I should avoid?",
    "do I need to fast before my blood test?",
    "can I take paracetamol for a mild headache?",
    "how do I update my address in your records?",
    "is there parking available at the clinic?",
    "what should my daily water intake be?",
    "can you send me a copy of my prescription?",
    "is it fine to have yogurt on my diet?",
    "when is my next follow-up scheduled?",
    "can I get a medical certificate for work?",
    "does the clinic open on weekends?",
    "can I eat tomatoes with my condition?",
    "is brown rice okay for my diet?",
    "how many cups of fluid can I have daily?",
    "can I reschedule my lab test to the morning?",
    "what documents do I need for my next visit?",
    "can I get my flu vaccination at the clinic?",
    "how do I sign up for the patient portal?",
    "can my family member pick up my medication?",
    "is the pharmacy open after 6 pm?",
    "should I bring my previous reports to the appointment?",
    "can I switch to an evening dialysis slot?",
    "how long does a routine checkup usually take?",
    "is there wheelchair access at the entrance?",
    "can I pay my bill online?",
    "is it normal to get an occasional mild headache?",
    "I get a mild headache sometimes, is that anything to worry about?",
    "I have a mild stomach ache after eating spicy food, is that normal?",
    "is a bit of an upset stomach after meals normal for my condition?",
]


def _fill(template: str, ctx: str, t: str) -> str:
    """Apply a context prefix and time expression, and fix capitalization."""
    body = template.format(t=t) if "{t}" in template else template
    if ctx:
        text = ctx + body
    else:
        text = body[0].upper() + body[1:]
    return text.strip()


def _gen_symptom(templates, contexts, times):
    out = set()
    for tpl in templates:
        for ctx in contexts:
            times_iter = times if "{t}" in tpl else [""]
            for t in times_iter:
                out.add(_fill(tpl, ctx, t))
    return out


def _gen_green(templates, openers):
    out = set()
    for tpl in templates:
        for op in openers:
            text = (op + tpl) if op else (tpl[0].upper() + tpl[1:])
            out.add(text.strip())
    return out


def build(out_path, target_per_class):
    rng = random.Random(SEED)

    red = _gen_symptom(RED_CORE + RED_SUBTLE, CONTEXTS, TIMES)
    yellow = _gen_symptom(YELLOW, CONTEXTS, TIMES)
    green = _gen_green(GREEN, GREENERS)

    # Integrity: no GREEN/YELLOW message may contain a safety-net critical phrase.
    for label, pool in (("YELLOW", yellow), ("GREEN", green)):
        bad = [m for m in pool if safety_net.is_critical(m)]
        if bad:
            raise SystemExit(
                f"{len(bad)} {label} message(s) unexpectedly trigger the safety "
                f"net, e.g. {bad[:3]!r}. Fix the templates so tiers never conflict."
            )

    # Report how many RED are caught by the classifier alone vs the safety net.
    red_no_trigger = sum(1 for m in red if not safety_net.is_critical(m))

    rows = []
    for label, pool in (("RED", red), ("YELLOW", yellow), ("GREEN", green)):
        items = sorted(pool)
        rng.shuffle(items)
        chosen = items[:target_per_class]
        rows.extend((m, label) for m in chosen)
        print(f"{label:6}: pool={len(pool):4d}  used={len(chosen)}")

    print(f"RED messages without a safety-net phrase (classifier must learn): "
          f"{red_no_trigger}/{len(red)}")

    rng.shuffle(rows)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "label"])
        w.writerows(rows)

    print(f"\nWrote {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="1", help="dataset version suffix, e.g. 1 or 2")
    parser.add_argument("--target-per-class", type=int, default=210)
    args = parser.parse_args()
    out_path = os.path.join(_ML_ROOT, "data", f"dataset_v{args.version}.csv")
    build(out_path, args.target_per_class)
