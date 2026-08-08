"""Parity tests between the two safety-net implementations (Week 5).

The project deliberately has two safety nets:

    ml/safety_net.py             -- used by the standalone ML tools/CLI
    server/services/safetyNet.js -- the one that actually runs in the app

Keeping them separate is intentional (the backend must be able to escalate even
if the ML service is down), but it means they can drift apart silently. That
already happened once: the `thunderclap_headache` rule was added to the Python
layer in Week 3 and was missing from the JavaScript layer, so the fix was never
live in the running system.

These tests pin both implementations to one shared corpus
(`safety_net_corpus.json`) and fail if they ever disagree.

The JavaScript side is queried through `server/scripts/safety-net-probe.js`, so
the real rules are tested rather than a Python translation of them.

Node is required. If it isn't on PATH the parity tests skip (rather than fail),
so the Python-only test suite still runs on a machine without Node.
"""

import json
import os
import shutil
import subprocess

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ML_ROOT = os.path.dirname(_HERE)
_REPO_ROOT = os.path.dirname(_ML_ROOT)
_SERVER_DIR = os.path.join(_REPO_ROOT, "server")
_PROBE = os.path.join(_SERVER_DIR, "scripts", "safety-net-probe.js")
_CORPUS = os.path.join(_HERE, "safety_net_corpus.json")

import sys  # noqa: E402

sys.path.insert(0, _ML_ROOT)
import safety_net  # noqa: E402


def _load_corpus():
    with open(_CORPUS, encoding="utf-8") as f:
        data = json.load(f)
    return data["critical"], data["non_critical"]


CRITICAL, NON_CRITICAL = _load_corpus()
ALL_MESSAGES = CRITICAL + NON_CRITICAL


def _node_available():
    if shutil.which("node"):
        return True
    # Common Windows install location -- winget puts node here and it is not
    # always on PATH inside an already-open shell.
    return os.path.exists(r"C:\Program Files\nodejs\node.exe")


def _node_binary():
    return shutil.which("node") or r"C:\Program Files\nodejs\node.exe"


requires_node = pytest.mark.skipif(
    not _node_available() or not os.path.exists(_PROBE),
    reason="Node.js or the safety-net probe script is unavailable",
)


@pytest.fixture(scope="module")
def js_results():
    """Run the whole corpus through the JavaScript safety net once."""
    proc = subprocess.run(
        [_node_binary(), _PROBE],
        input=json.dumps(ALL_MESSAGES),
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=_SERVER_DIR,
    )
    if proc.returncode != 0:
        pytest.fail(f"safety-net-probe failed: {proc.stderr.strip()}")
    return {row["text"]: row for row in json.loads(proc.stdout)}


# --------------------------------------------------------------------------
# The corpus itself must hold for the Python layer (fast, no Node needed).
# --------------------------------------------------------------------------

@pytest.mark.parametrize("msg", CRITICAL)
def test_python_escalates_critical(msg):
    assert safety_net.is_critical(msg), f"python layer missed: {msg!r}"


@pytest.mark.parametrize("msg", NON_CRITICAL)
def test_python_ignores_non_critical(msg):
    assert not safety_net.is_critical(msg), f"python layer over-escalated: {msg!r}"


# --------------------------------------------------------------------------
# The same corpus must hold for the JavaScript layer that runs in production.
# --------------------------------------------------------------------------

@requires_node
@pytest.mark.parametrize("msg", CRITICAL)
def test_backend_escalates_critical(msg, js_results):
    assert js_results[msg]["triggered"], (
        f"backend safety net missed a critical message: {msg!r}. "
        "The app would NOT have escalated this."
    )


@requires_node
@pytest.mark.parametrize("msg", NON_CRITICAL)
def test_backend_ignores_non_critical(msg, js_results):
    assert not js_results[msg]["triggered"], (
        f"backend safety net over-escalated: {msg!r} "
        f"(matched {js_results[msg]['matchedKeywords']}). "
        "False REDs crowd out genuine emergencies in the queue."
    )


# --------------------------------------------------------------------------
# And the two must agree with each other on every message, which is the check
# that actually catches drift.
# --------------------------------------------------------------------------

@requires_node
@pytest.mark.parametrize("msg", ALL_MESSAGES)
def test_both_layers_agree(msg, js_results):
    python_triggered = safety_net.is_critical(msg)
    node_triggered = js_results[msg]["triggered"]
    assert python_triggered == node_triggered, (
        f"safety nets disagree on {msg!r}: "
        f"ml/safety_net.py={python_triggered}, "
        f"server/services/safetyNet.js={node_triggered}"
    )
