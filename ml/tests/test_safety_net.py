"""Tests for the rule-based safety net (spec.md 6.3.4).

The safety net is the project's hard guarantee, so its behavior is pinned by
tests: every critical phrase must trigger, and routine/watch messages must not.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import safety_net  # noqa: E402

# Messages that MUST escalate to RED.
CRITICAL = [
    "I haven't passed any urine since yesterday",
    "I have no urine output today",
    "I can't pass urine at all",
    "I can't breathe properly",
    "I've been having difficulty breathing",
    "I feel short of breath",
    "I'm having chest pain",
    "There's blood in my urine and it won't stop",
    "blood is coming through my urine",
    "I noticed blood in my urine this morning",
    "I've been peeing blood",
    "I have uncontrolled bleeding",
    "I fainted this morning",
    "I passed out earlier",
    "I feel severely confused",
    "I've been vomiting blood",
    "I think I had a seizure",
]

# Messages that MUST NOT trigger the safety net (routine or watch-level).
NON_CRITICAL = [
    "Can I eat bananas on my current diet?",
    "I need to reschedule my appointment next week",
    "My legs and ankles have been swelling for two days",
    "I've felt very tired and a bit nauseous",
    "My urine output seems lower than normal",
    "I have a mild fever since last night",
    "There's a metallic taste in my mouth",
    "How much salt is safe for me per day?",
]


@pytest.mark.parametrize("msg", CRITICAL)
def test_critical_messages_trigger(msg):
    assert safety_net.is_critical(msg), f"should have escalated: {msg!r}"


@pytest.mark.parametrize("msg", NON_CRITICAL)
def test_non_critical_messages_do_not_trigger(msg):
    assert not safety_net.is_critical(msg), f"should NOT have escalated: {msg!r}"


def test_empty_and_none_are_safe():
    assert not safety_net.is_critical("")
    assert not safety_net.is_critical(None)


def test_check_reports_matches():
    result = safety_net.check("I have chest pain and can't breathe")
    assert result["triggered"] is True
    assert "chest_pain" in result["matches"]
    assert "difficulty_breathing" in result["matches"]
