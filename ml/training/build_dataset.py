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

# ── Bengali (added in v3) ──────────────────────────────────────────────────
# Patients at a Bangladeshi kidney hospital write in Bengali. The safety net
# gained Bengali rules in Week 5, but the classifier had never seen the script,
# so any Bengali message without an explicit critical phrase was being labelled
# on essentially no evidence. These templates give the model real Bengali to
# learn from.
#
# Bengali is verb-final, so the time expression goes at the FRONT of the
# sentence rather than the end -- hence "{t} " prefixed templates below rather
# than the " {t}" suffix used for English.
BN_CONTEXTS = [
    "",
    "আমার কিডনি রোগ আছে, ",
    "আমি ডায়ালাইসিস নিচ্ছি, ",
    "কিডনি রোগী হিসেবে বলছি, ",
    "আমার কিডনির কার্যক্ষমতা কমে গেছে, ",
]

BN_TIMES = [
    "",
    "গতকাল থেকে ",
    "আজ সকাল থেকে ",
    "দুই দিন ধরে ",
    "কাল রাত থেকে ",
    "কয়েকদিন ধরে ",
]

BN_GREENERS = ["", "আসসালামু আলাইকুম, ", "একটা প্রশ্ন ছিল - ", "দয়া করে জানাবেন, "]

BN_RED = [
    "{t}প্রস্রাব হচ্ছে না",
    "{t}প্রস্রাব একদম বন্ধ হয়ে গেছে",
    "{t}প্রস্রাব করতে পারছি না",
    "{t}শ্বাস নিতে খুব কষ্ট হচ্ছে",
    "{t}শ্বাসকষ্ট হচ্ছে",
    "{t}দম বন্ধ হয়ে আসছে",
    "{t}বুকে ব্যথা করছে",
    "{t}বুকে চাপ লাগছে",
    "{t}প্রস্রাবে রক্ত যাচ্ছে",
    "{t}প্রস্রাবের সাথে রক্ত যাচ্ছে",
    "{t}রক্ত বমি হচ্ছে",
    "{t}আমি জ্ঞান হারিয়ে ফেলেছিলাম",
    "{t}অজ্ঞান হয়ে গিয়েছিলাম",
    "{t}খিঁচুনি হয়েছে",
    "{t}হঠাৎ তীব্র মাথাব্যথা শুরু হয়েছে",
    "এটা আমার জীবনের সবচেয়ে তীব্র মাথাব্যথা",
]

BN_YELLOW = [
    "{t}পা ফুলে যাচ্ছে",
    "{t}পা ও গোড়ালি ফুলে আছে",
    "{t}মুখ ফুলে গেছে",
    "{t}খুব দুর্বল লাগছে",
    "{t}খুব ক্লান্ত লাগছে",
    "{t}বমি বমি ভাব লাগছে",
    "{t}খেতে ইচ্ছে করছে না",
    "{t}প্রস্রাব কম হচ্ছে",
    "{t}আগের চেয়ে কম প্রস্রাব হচ্ছে",
    "{t}প্রস্রাবে ফেনা হচ্ছে",
    "{t}সারা শরীর চুলকাচ্ছে",
    "{t}হালকা মাথাব্যথা করছে",
    "{t}কিডনির জায়গায় হালকা ব্যথা",
    "{t}কোমরে ব্যথা করছে",
    "{t}হালকা জ্বর এসেছে",
    "{t}পায়ে খিল ধরছে",
    "{t}মাথা ঘোরাচ্ছে",
    "{t}মুখে ধাতব স্বাদ লাগছে",
    "{t}রক্তচাপ স্বাভাবিকের চেয়ে বেশি",
    "{t}পেটে হালকা ব্যথা",
]

BN_GREEN = [
    "কলা খেতে পারব কি?",
    "ভাত কতটুকু খাওয়া যাবে?",
    "দিনে কতটুকু লবণ খাওয়া নিরাপদ?",
    "দিনে কতটুকু পানি খাব?",
    "পরের সপ্তাহে অ্যাপয়েন্টমেন্ট পরিবর্তন করতে চাই",
    "আমার রিপোর্ট কি চলে এসেছে?",
    "ডায়ালাইসিসের সময় কখন?",
    "ওষুধ খাওয়ার নিয়ম কী?",
    "ওষুধ কি খাবারের আগে না পরে খাব?",
    "পরের ভিজিট কবে?",
    "ক্লিনিক কি শুক্রবার খোলা থাকে?",
    "রক্ত পরীক্ষার আগে কি খালি পেটে থাকতে হবে?",
    "আমি কি বিমানে ভ্রমণ করতে পারব?",
    "ব্যায়াম করা কি আমার জন্য নিরাপদ?",
    "প্রেসক্রিপশনের একটি কপি পাঠাতে পারবেন?",
    "বিল কি অনলাইনে দেওয়া যাবে?",
    "গত ভিজিটে সাহায্যের জন্য ধন্যবাদ",
    "টমেটো খাওয়া যাবে কি?",
]

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

# --- RED (colloquial, added in v4) -----------------------------------------
# Evaluation on hand-written messages showed the model failing on ordinary
# patient language: it recognised "I have not passed urine" but not "my pee has
# stopped", and "chest pain" but not "a weight on my chest". Clinical wording was
# over-represented in v1-v3 and lay wording barely appeared at all.
#
# These teach the everyday vocabulary for the same emergencies. They are written
# independently of the evaluation sets -- the point is to cover the *register*,
# not to memorise the test sentences.
RED_COLLOQUIAL = [
    "I have not been able to pee {t}",
    "nothing comes out when I try to pee {t}",
    "my bladder feels full but nothing will come {t}",
    "I cannot empty my bladder {t}",
    "I am badly out of breath {t}",
    "I get breathless just walking across the room {t}",
    "I cannot get a full breath in {t}",
    "my chest feels squeezed {t}",
    "there is pressure across my chest {t}",
    "my chest feels tight and heavy {t}",
    "there is red in the toilet after I pee {t}",
    "I am passing dark red urine {t}",
    "my urine is the colour of blood {t}",
    "I collapsed {t}",
    "my family said I was unresponsive {t}",
    "I brought up blood {t}",
    "I have the most severe headache I have ever felt {t}",
    "I am so swollen that I cannot sleep lying down {t}",
    "I am too weak to stand up {t}",
]

# --- YELLOW (colloquial, added in v4) ---
# The same register problem applied to watch-level symptoms, and RED/YELLOW
# confusion was the largest error in v3. These give the model everyday phrasing
# for symptoms that are concerning but not emergencies, so the boundary is
# learned from language patients actually use.
YELLOW_COLLOQUIAL = [
    "my ankles puff up by the evening {t}",
    "I have had no energy at all {t}",
    "food does not taste right {t}",
    "I have gone off my food {t}",
    "I pass water less often than I used to {t}",
    "there is froth in my urine {t}",
    "my skin itches badly {t}",
    "I have a nagging ache in my side {t}",
    "my blood pressure readings are higher than normal {t}",
    "I get cramp in my legs at night {t}",
    "I have felt feverish {t}",
    "I go lightheaded when I stand up {t}",
    "my face is puffy in the mornings {t}",
    "my stomach feels bloated after meals {t}",
    "I have been sleeping badly {t}",
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


def _gen_symptom(templates, contexts, times, lang="en"):
    """Expand symptom templates. Returns {message: template} so every row can be
    traced back to the template that produced it -- see `build` for why."""
    out = {}
    for tpl in templates:
        for ctx in contexts:
            times_iter = times if "{t}" in tpl else [""]
            for t in times_iter:
                out.setdefault(_fill(tpl, ctx, t), f"{lang}:{tpl}")
    return out


def _gen_green(templates, openers, lang="en"):
    out = {}
    for tpl in templates:
        for op in openers:
            text = (op + tpl) if op else (tpl[0].upper() + tpl[1:])
            out.setdefault(text.strip(), f"{lang}:{tpl}")
    return out


def build(out_path, target_per_class):
    rng = random.Random(SEED)

    red = _gen_symptom(RED_CORE + RED_SUBTLE + RED_COLLOQUIAL, CONTEXTS, TIMES)
    yellow = _gen_symptom(YELLOW + YELLOW_COLLOQUIAL, CONTEXTS, TIMES)
    green = _gen_green(GREEN, GREENERS)

    # Bengali pools (v3). Merged into the same tiers so the model learns one
    # bilingual decision boundary rather than needing language detection first.
    red.update(_gen_symptom(BN_RED, BN_CONTEXTS, BN_TIMES, lang="bn"))
    yellow.update(_gen_symptom(BN_YELLOW, BN_CONTEXTS, BN_TIMES, lang="bn"))
    green.update(_gen_green(BN_GREEN, BN_GREENERS, lang="bn"))

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
        items = sorted(pool)  # pool is {message: template}
        rng.shuffle(items)
        chosen = items[:target_per_class]
        rows.extend((m, label, pool[m]) for m in chosen)
        n_bn = sum(1 for m in chosen if pool[m].startswith("bn:"))
        print(f"{label:6}: pool={len(pool):4d}  used={len(chosen):4d}  "
              f"(bengali {n_bn}, english {len(chosen) - n_bn})")

    print(f"RED messages without a safety-net phrase (classifier must learn): "
          f"{red_no_trigger}/{len(red)}")

    rng.shuffle(rows)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        # `template` is written so evaluation can group by it. Every row from one
        # template is a near-duplicate of its siblings (same sentence, different
        # context prefix or time phrase), so a random train/test split leaks:
        # the model sees a variant in training and is then tested on its twin.
        # Grouping by template is what makes the reported score honest.
        w.writerow(["text", "label", "template"])
        w.writerows(rows)

    n_templates = len({r[2] for r in rows})
    print(f"\nWrote {len(rows)} rows ({n_templates} distinct templates) to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="1", help="dataset version suffix, e.g. 1 or 2")
    parser.add_argument("--target-per-class", type=int, default=210)
    args = parser.parse_args()
    out_path = os.path.join(_ML_ROOT, "data", f"dataset_v{args.version}.csv")
    build(out_path, args.target_per_class)
