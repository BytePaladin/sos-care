"""Rule-based safety-net layer (spec.md 6.3.4).

A deterministic keyword/phrase matcher that runs INDEPENDENTLY of the ML
classifier. If a message contains an explicitly dangerous phrase, the final
label is forced to RED regardless of what the model predicted -- this is the
project's core safety guarantee: classifier error can never suppress an
explicitly critical message.

The layer is intentionally biased toward escalation (a false RED is a wasted
staff glance; a missed RED is a patient harmed), consistent with NFR1
(RED recall is the priority).
"""

import re

# Each entry is a human-readable name and a regex tolerant to missing
# apostrophes and minor spacing. Patterns match against lowercased text.
# The core set is drawn from spec.md 6.3.4 (proposal Appendix B); a few
# unambiguously life-threatening phrases are added and marked below.
_CRITICAL_PATTERNS = [
    # --- Anuria / no urine output ---
    # "cannot urinate" was added in Week 5 -- the parity test found the backend
    # caught it and this layer did not.
    ("no_urine", r"\bno urine\b|\bno pee\b|can'?t (?:pass|make) (?:urine|water)|"
                 r"cannot (?:pass|urinate)|"
                 r"haven'?t (?:passed|made) (?:any )?(?:urine|water)|"
                 r"not (?:passed|passing) (?:any )?urine|haven'?t urinated|"
                 r"unable to (?:pass|pee)"),
    # --- Breathing ---
    ("difficulty_breathing", r"can'?t breathe|cannot breathe|difficulty breathing|"
                             r"short(?:ness)? of breath|struggling to breathe|"
                             r"can'?t catch my breath|gasping for (?:air|breath)"),
    # --- Chest ---
    ("chest_pain", r"chest pain|pain in my chest|chest tightness|"
                   r"pressure in my chest|crushing (?:feeling|pain) in my chest"),
    # --- Uncontrolled bleeding ---
    ("uncontrolled_bleeding", r"uncontrolled bleeding|won'?t stop bleeding|"
                              r"can'?t stop (?:the )?bleeding|bleeding (?:that )?won'?t stop|"
                              r"heavy bleeding"),
    # --- Visible blood in urine (gross hematuria) --- any mention is treated
    # as critical for a kidney patient, not only when explicitly "won't stop"
    # (proposal Appendix A gives the won't-stop case as RED; we escalate the
    # broader symptom too, consistent with the safety net's bias toward
    # over-escalation rather than under-escalation, NFR1).
    ("blood_in_urine", r"blood (?:is |was )?(?:in|through|coming through|coming out (?:of|with)) "
                       r"(?:my )?(?:urine|pee)|"
                       r"(?:urine|pee) (?:has|had|with|that has) blood|"
                       r"(?:peeing|urinating) blood"),
    # --- Loss of consciousness ---
    ("loss_of_consciousness", r"\bfainted\b|passed out|blacked out|black(?:ing)? out|"
                              r"lost consciousness|collaps(?:e|ed|ing)"),
    # --- Severe confusion ---
    ("severe_confusion", r"severe(?:ly)? confus|very confused|"
                         r"confused and disorient|suddenly confused"),
    # --- Added: unambiguously life-threatening (not in the proposal's
    #     illustrative list, but clinically clear escalations) ---
    ("coughing_or_vomiting_blood", r"coughing up blood|vomiting blood|"
                                   r"throwing up blood|blood in my vomit"),
    ("seizure", r"\bseizure\b|convuls|having a fit"),
    # --- Added (dataset v2 error analysis): thunderclap headache -- a classic
    # red flag for subarachnoid hemorrhage / hypertensive emergency, which the
    # v1 model alone misclassified as GREEN. ---
    ("thunderclap_headache", r"worst headache (?:of|in) my life|"
                             r"sudden(?:ly)? severe headache|thunderclap headache|"
                             r"worst headache i'?ve ever had"),
    # --- Bengali (Week 5) ---
    # Patients at a Bangladeshi kidney hospital write in Bengali, and an
    # English-only safety net would silently fail to escalate them. These
    # mirror the English rules above; the same tags are used on the backend
    # (server/services/safetyNet.js) and pinned by the parity test.
    ("no_urine_bn", r"প্রস্রাব হচ্ছে না|প্রস্রাব হয়নি|প্রস্রাব বন্ধ|"
                    r"প্রস্রাব করতে পারছি না|পেশাব হচ্ছে না"),
    ("difficulty_breathing_bn", r"শ্বাস নিতে কষ্ট|শ্বাসকষ্ট|দম বন্ধ|"
                                r"নিঃশ্বাস নিতে পারছি না"),
    ("chest_pain_bn", r"বুকে ব্যথা|বুকে চাপ|বুক ব্যথা"),
    ("bleeding_bn", r"প্রস্রাবে রক্ত|প্রস্রাবের সাথে রক্ত|রক্ত যাচ্ছে|"
                    r"রক্ত বমি|রক্তপাত বন্ধ হচ্ছে না"),
    ("loss_of_consciousness_bn", r"জ্ঞান হারি|অজ্ঞান|সংজ্ঞা হারি"),
    ("seizure_bn", r"খিঁচুনি"),
    ("thunderclap_headache_bn", r"জীবনের সবচেয়ে (?:তীব্র|খারাপ) মাথাব্যথা|"
                                r"হঠাৎ তীব্র মাথাব্যথা"),
]

_COMPILED = [(name, re.compile(pat)) for name, pat in _CRITICAL_PATTERNS]


def check(text: str) -> dict:
    """Scan a message for critical phrases.

    Returns {"triggered": bool, "matches": [names...]}. `triggered` is True if
    any critical phrase is present.
    """
    if not text:
        return {"triggered": False, "matches": []}
    lowered = str(text).lower()
    matches = [name for name, rx in _COMPILED if rx.search(lowered)]
    return {"triggered": bool(matches), "matches": matches}


def is_critical(text: str) -> bool:
    """Convenience boolean wrapper around `check`."""
    return check(text)["triggered"]


if __name__ == "__main__":
    # Quick manual smoke test
    samples = [
        "I haven't passed any urine since yesterday",
        "I can't breathe properly",
        "Can I eat bananas on my current diet?",
        "My ankles are a bit swollen today",
    ]
    for s in samples:
        print(f"{check(s)['triggered']!s:5} | {s}")
