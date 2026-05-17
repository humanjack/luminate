// Deterministic CTR (click-through rate) heuristic for YouTube titles.
// Returns 0-100 where higher = more likely to be clicked.
//
// Signals come from creator-side rules-of-thumb that map well to
// real CTR data, not from any ML model:
//   - 45-60 chars hits a sweet spot for desktop + mobile rendering.
//   - Numbers and digits frame specificity ("7 things…").
//   - Curiosity, emotion, and power words boost open rate.
//   - Title case and proper capitalization signal effort.
//   - Brackets, [tags], (parens) are a YouTube convention that lift CTR.
//   - ALL CAPS or excessive punctuation are penalized as spammy.

const POWER_WORDS = new Set([
  "ultimate", "secret", "best", "worst", "free", "new", "proven", "instant",
  "shocking", "surprising", "exposed", "truth", "hidden", "untold", "wrong",
  "unbelievable", "easy", "fast", "definitive", "essential", "killer",
  "amazing", "warning", "stop", "never", "always", "must", "real",
]);

const CURIOSITY_WORDS = new Set([
  "why", "how", "what", "who", "when", "this", "these", "that",
  "actually", "really", "nobody", "everyone", "almost",
]);

const EMOTION_WORDS = new Set([
  "love", "hate", "fear", "joy", "anger", "wonderful", "terrible",
  "incredible", "horrible", "beautiful", "shocking", "stunning",
]);

export interface TitleSignals {
  length: number;
  hasNumber: boolean;
  hasBrackets: boolean;
  powerWordCount: number;
  curiosityWordCount: number;
  emotionWordCount: number;
  allCapsRatio: number;
  excessivePunctuation: boolean;
  titleCase: boolean;
}

export function analyzeTitle(title: string): TitleSignals {
  const trimmed = title.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lowerWords = words.map((w) => w.replace(/[^a-z]/gi, "").toLowerCase());

  const upperLetters = trimmed.replace(/[^A-Z]/g, "").length;
  const totalLetters = trimmed.replace(/[^A-Za-z]/g, "").length || 1;

  const capitalizedWords = words.filter((w) => /^[A-Z]/.test(w)).length;

  return {
    length: trimmed.length,
    hasNumber: /\d/.test(trimmed),
    hasBrackets: /[\[\](){}]/.test(trimmed),
    powerWordCount: lowerWords.filter((w) => POWER_WORDS.has(w)).length,
    curiosityWordCount: lowerWords.filter((w) => CURIOSITY_WORDS.has(w)).length,
    emotionWordCount: lowerWords.filter((w) => EMOTION_WORDS.has(w)).length,
    allCapsRatio: upperLetters / totalLetters,
    excessivePunctuation: /[!?]{2,}/.test(trimmed),
    titleCase: words.length >= 3 && capitalizedWords / words.length >= 0.6,
  };
}

export function ctrScoreFromSignals(signals: TitleSignals): number {
  let score = 50;

  // Length sweet spot 45-60 chars; soft penalty outside.
  if (signals.length >= 45 && signals.length <= 60) score += 10;
  else if (signals.length >= 30 && signals.length <= 70) score += 4;
  else if (signals.length > 90) score -= 12;
  else if (signals.length < 20) score -= 8;

  if (signals.hasNumber) score += 8;
  if (signals.hasBrackets) score += 4;
  score += Math.min(15, signals.powerWordCount * 5);
  score += Math.min(10, signals.curiosityWordCount * 3);
  score += Math.min(8, signals.emotionWordCount * 4);
  if (signals.titleCase) score += 4;

  // Penalties for spammy patterns
  if (signals.allCapsRatio > 0.4) score -= 15;
  if (signals.excessivePunctuation) score -= 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreTitle(title: string): number {
  return ctrScoreFromSignals(analyzeTitle(title));
}

// Average two scores (LLM-judged + heuristic) for the final UI display.
export function combineScores(llmScore: number, heuristicScore: number): number {
  const clamped = (n: number) => Math.max(0, Math.min(100, n));
  return Math.round((clamped(llmScore) + clamped(heuristicScore)) / 2);
}
