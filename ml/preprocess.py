"""Shared text preprocessing for the S.O.S. severity classifier.

The SAME cleaning must run at training time and at serving time, otherwise the
model sees differently-shaped text in production than it was trained on. To
guarantee that, `clean_text` is wired into the vectorizer as its `preprocessor`
(see training/train.py), so it travels inside the serialized model and is applied
identically whenever the model runs.

Design note: cleaning is intentionally light. Negations ("no", "not", "can't")
carry clinical signal ("no urine" is the whole point), so they are preserved --
we only lowercase, strip URLs, and normalize whitespace, and let the TF-IDF
vectorizer handle tokenization.
"""

import re

_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_WS_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    """Normalize a raw patient message for vectorization.

    Lowercases, removes URLs, and collapses whitespace. Punctuation and
    negations are left intact for the vectorizer to tokenize.
    """
    if text is None:
        return ""
    text = str(text).lower()
    text = _URL_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text)
    return text.strip()
