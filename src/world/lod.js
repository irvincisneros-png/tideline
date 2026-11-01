// Level of detail for the procedural habitat builders: generators scale their segment counts by LOD.k
// (1 = full detail; reef.js rebuilds each variant at a lower k for distant tiles).
export const LOD = { k: 1 };
/** Segment count n scaled by the current detail level (never below min). */
export const seg = (n, min = 3) => Math.max(min, Math.round(n * LOD.k));
