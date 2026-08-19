import weights from '../assets/severity_model_weights.json' with { type: 'json' };
import { runSafetyNet } from './safetyNet.js';

// Preprocessor
function cleanText(text) {
  if (!text) return '';
  let str = String(text).toLowerCase();
  str = str.replace(/https?:\/\/\S+|www\.\S+/g, ' ');
  str = str.replace(/\s+/g, ' ');
  return str.trim();
}

// Tokenize words (matches Python's (?u)\b\w\w+\b)
function tokenizeWords(text) {
  // \p{L} = letters, \p{M} = marks (vowels in Bengali), \p{N} = numbers
  const regex = /[\p{L}\p{M}\p{N}_]{2,}/gu;
  return text.match(regex) || [];
}

// Generate word n-grams (1, 2)
function getWordNgrams(words) {
  const ngrams = [];
  for (let i = 0; i < words.length; i++) {
    ngrams.push(words[i]); // unigram
    if (i < words.length - 1) {
      ngrams.push(words[i] + ' ' + words[i + 1]); // bigram
    }
  }
  return ngrams;
}

// Generate char_wb n-grams (3, 4, 5)
function getCharWbNgrams(text) {
  const ngrams = [];
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  
  for (const word of words) {
    const padded = ' ' + word + ' ';
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i <= padded.length - n; i++) {
        ngrams.push(padded.slice(i, i + n));
      }
    }
  }
  return ngrams;
}

// Extract TF-IDF vector for a specific vocabulary and IDF array
function getTfidfVector(ngrams, vocab, idfArray) {
  const counts = {};
  for (const token of ngrams) {
    if (vocab.hasOwnProperty(token)) {
      const idx = vocab[token];
      counts[idx] = (counts[idx] || 0) + 1;
    }
  }

  const vec = {};
  let sumSq = 0;
  
  for (const idx in counts) {
    // sublinear_tf = True: 1 + log(tf)
    const tf = 1 + Math.log(counts[idx]);
    const idf = idfArray[idx];
    const tfidf = tf * idf;
    vec[idx] = tfidf;
    sumSq += tfidf * tfidf;
  }
  
  // L2 normalization
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (const idx in vec) {
      vec[idx] /= norm;
    }
  }
  
  return vec;
}

// Main ML evaluation
function predictML(text) {
  const cleaned = cleanText(text);
  
  // 1. Extract Words & Word TF-IDF
  const words = tokenizeWords(cleaned);
  const wordNgrams = getWordNgrams(words);
  const wordVec = getTfidfVector(wordNgrams, weights.word_vocab, weights.word_idf);
  
  // 2. Extract Char & Char TF-IDF
  const charNgrams = getCharWbNgrams(cleaned);
  const charVec = getTfidfVector(charNgrams, weights.char_vocab, weights.char_idf);
  
  // 3. Concat vectors (Word first, then Char)
  // Scikit-Learn FeatureUnion concatenates in the order passed: Word, Char.
  const wordOffset = Object.keys(weights.word_vocab).length;
  
  // We can just compute the dot product directly without building the full array.
  // scores = intercept + sum(feature_value * coef)
  const scores = [...weights.intercept]; // copy intercept [GREEN, RED, YELLOW]
  
  // Add word features dot product
  for (const idxStr in wordVec) {
    const idx = parseInt(idxStr, 10);
    const val = wordVec[idx];
    for (let c = 0; c < 3; c++) {
      scores[c] += val * weights.coef[c][idx];
    }
  }
  
  // Add char features dot product
  for (const idxStr in charVec) {
    const idx = parseInt(idxStr, 10);
    const val = charVec[idx];
    const concatIdx = wordOffset + idx;
    for (let c = 0; c < 3; c++) {
      scores[c] += val * weights.coef[c][concatIdx];
    }
  }
  
  // 4. Argmax
  let bestClassIdx = 0;
  let maxScore = -Infinity;
  for (let c = 0; c < 3; c++) {
    if (scores[c] > maxScore) {
      maxScore = scores[c];
      bestClassIdx = c;
    }
  }
  
  const predictedLabel = weights.classes[bestClassIdx].toLowerCase();
  
  // Calculate a pseudo-confidence (Softmax of margins)
  const maxScoreExp = Math.exp(scores[bestClassIdx]);
  let sumExp = 0;
  for (let c = 0; c < 3; c++) {
    sumExp += Math.exp(scores[c]);
  }
  const confidence = maxScoreExp / sumExp;

  // Extract top features for audit
  const topFeatures = [];
  
  // Find top contributing features for the predicted class
  const classCoef = weights.coef[bestClassIdx];
  
  // Map index back to words/chars
  const idxToWord = {};
  for (const w in weights.word_vocab) idxToWord[weights.word_vocab[w]] = w;
  const idxToChar = {};
  for (const c in weights.char_vocab) idxToChar[weights.char_vocab[c]] = c;

  for (const idxStr in wordVec) {
    const idx = parseInt(idxStr, 10);
    const val = wordVec[idx];
    const weight = val * classCoef[idx];
    if (weight > 0) topFeatures.push({ term: idxToWord[idx], weight });
  }
  
  for (const idxStr in charVec) {
    const idx = parseInt(idxStr, 10);
    const val = charVec[idx];
    const concatIdx = wordOffset + idx;
    const weight = val * classCoef[concatIdx];
    if (weight > 0) topFeatures.push({ term: idxToChar[idx], weight });
  }
  
  // Sort and take top 5
  topFeatures.sort((a, b) => b.weight - a.weight);
  
  return {
    label: predictedLabel,
    confidence: confidence,
    source: 'frontend-js-model',
    topFeatures: topFeatures.slice(0, 5)
  };
}

export async function evaluateMessage(text) {
  const cleanText = String(text || '').trim();

  // Run ML and Safety net in parallel
  const [mlResult, safetyResult] = await Promise.all([
    Promise.resolve(predictML(cleanText)),
    Promise.resolve(runSafetyNet(cleanText))
  ]);

  const finalLabel = safetyResult.triggered ? 'red' : mlResult.label;

  return {
    mlLabel: mlResult.label,
    confidence: mlResult.confidence,
    modelSource: mlResult.source,
    topFeatures: mlResult.topFeatures || [],
    ruleOverride: safetyResult.triggered,
    matchedKeywords: safetyResult.matchedKeywords,
    finalLabel
  };
}
