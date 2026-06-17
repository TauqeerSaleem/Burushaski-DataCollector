// src/utils/randomizer.js

/**
 * Standard weighted random pick from a pool.
 * Each item must already have an `effectiveWeight` property.
 */
export function weightedRandomPick(pool) {
  if (!pool || pool.length === 0) return null;

  const weights = pool.map((item) => {
    const w = Number(item.effectiveWeight);
    return Number.isFinite(w) && w > 0 ? w : 0.0001; // avoid zero/negative weight
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }

  return pool[pool.length - 1];
}

/**
 * Build the pool for a volunteer:
 * - only active sentences matching their dialect
 * - excluding sentences this volunteer has already recorded
 * - each item gets an `effectiveWeight` = base_weight / (1 + global recording count)
 *   so prompts with fewer recordings (across ALL participants) are favored.
 */
export function buildPool(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect) {
  const recordedSet = new Set(recordedIdsByUser);

  return allSentences
    .filter((s) => {
      if (!s.active) return false;
      if (s.dialect !== dialect) return false;
      if (recordedSet.has(s.prompt_id)) return false;
      return true;
    })
    .map((s) => {
      const baseWeight = Number(s.weight) > 0 ? Number(s.weight) : 1;
      const globalCount = globalCountsByPromptId[s.prompt_id] || 0;
      return {
        ...s,
        effectiveWeight: baseWeight / (1 + globalCount),
      };
    });
}