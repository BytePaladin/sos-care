"""Interactive terminal demo for the S.O.S. severity classifier.

Type a patient-style message and press Enter to see the hybrid decision live:
the raw model prediction, whether the safety net fired, and the final label.
No Flask server needed -- this calls predict.py directly.

Run from the `ml/` directory:  python try_it.py
Type 'quit' or 'exit' (or Ctrl+C) to stop.
"""

import predict

COLORS = {"GREEN": "\033[92m", "YELLOW": "\033[93m", "RED": "\033[91m"}
RESET = "\033[0m"


def format_result(text, result):
    label = result["finalLabel"]
    color = COLORS.get(label, "")
    lines = [f"{color}FINAL: {label}{RESET}"]
    lines.append(f"  model predicted : {result['mlLabel']}")
    if result["ruleOverride"]:
        lines.append(f"  {color}safety net      : TRIGGERED -> forced RED{RESET}")
    else:
        lines.append("  safety net      : not triggered")
    return "\n".join(lines)


def main():
    print("Loading model...")
    predict.load_model()
    print("Ready. Type a patient message and press Enter (type 'quit' to stop).\n")

    while True:
        try:
            text = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not text:
            continue
        if text.lower() in ("quit", "exit"):
            print("Bye.")
            break

        result = predict.predict_label(text)
        print(format_result(text, result))
        print()


if __name__ == "__main__":
    main()
