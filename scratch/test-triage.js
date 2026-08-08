import { evaluateMessage } from '../server/services/triageEngine.js';

async function runTests() {
  const cases = [
    "I have severe chest pain",
    "I haven't passed any urine today",
    "I can't breathe",
    "uncontrolled bleeding",
    "asdfa",
    "swelling and fatigue"
  ];

  for (const text of cases) {
    const res = await evaluateMessage(text);
    console.log(`Text: "${text}"`);
    console.log(`Result: ${JSON.stringify(res)}\n`);
  }
}

runTests().catch(console.error);
