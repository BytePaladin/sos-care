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
    ("no_urine", r"\bno urine\b|\bno pee\b|can'?t (?:pass|make) (?:urine|water)|"
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
