// src/utils/randomizer.js

/**
 * Pick one item from a pool using weighted random selection.
 * Each item must already have an `effectiveWeight` property.
 */
export function weightedRandomPick(pool) {
  if (!pool || pool.length === 0) return null;

  const weights = pool.map((item) => {
    const w = Number(item.effectiveWeight);
    return Number.isFinite(w) && w > 0 ? w : 0.0001;
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
 * Assign effectiveWeight to each item:
 * effectiveWeight = base_weight / (1 + global recording count)
 * Less-recorded prompts get higher effective weight.
 */
function assignWeights(pool, globalCountsByPromptId) {
  return pool.map((s) => {
    const baseWeight = Number(s.weight) > 0 ? Number(s.weight) : 1;
    const globalCount = globalCountsByPromptId[s.prompt_id] || 0;
    return {
      ...s,
      effectiveWeight: baseWeight / (1 + globalCount),
    };
  });
}

/**
 * Split sentences into two filtered, weighted pools:
 * - textPool: active, matching dialect, not yet recorded by user, prompt_type != "picture_description"
 * - imagePool: active, matching dialect, not yet recorded by user, prompt_type == "picture_description"
 */
function splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect) {
  const recordedSet = new Set(recordedIdsByUser);

  const eligible = allSentences.filter((s) => {
    if (!s.active) return false;
    if (s.dialect !== dialect && s.dialect !== "all" && s.dialect !== null) return false;
    if (recordedSet.has(s.prompt_id)) return false;
    return true;
  });

  const textPool = assignWeights(
    eligible.filter((s) => s.prompt_type !== "picture_description"),
    globalCountsByPromptId
  );

  const imagePool = assignWeights(
    eligible.filter((s) => s.prompt_type === "picture_description"),
    globalCountsByPromptId
  );

  return { textPool, imagePool };
}

/**
 * Pick the next prompt using strict 1-in-4 image ratio.
 *
 * `pickCount` is the total number of prompts shown so far this session
 * (incremented after every pick, including skips).
 * Every 4th pick (pickCount % 4 === 3) tries to show an image prompt.
 * If no images are available, falls back to a text prompt.
 * If no text prompts are available on a non-image turn, tries image pool.
 * Returns null if both pools are empty.
 *
 * @param {Array} allSentences - full prompt_bank rows
 * @param {string[]} recordedIdsByUser - sentence_ids this volunteer already recorded
 * @param {Object} globalCountsByPromptId - { prompt_id: count } across all participants
 * @param {string} dialect - volunteer's dialect
 * @param {number} pickCount - how many prompts have been shown so far this session
 */
export function pickNextPrompt(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect, pickCount) {
  const { textPool, imagePool } = splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect);

  const bothEmpty = textPool.length === 0 && imagePool.length === 0;
  if (bothEmpty) return null;

  const isImageTurn = pickCount % 4 === 3; // every 4th pick (0-indexed: 3, 7, 11...)

  if (isImageTurn) {
    // try image pool first, fall back to text
    return weightedRandomPick(imagePool) || weightedRandomPick(textPool);
  } else {
    // try text pool first, fall back to image
    return weightedRandomPick(textPool) || weightedRandomPick(imagePool);
  }
}

/**
 * Kept for backward compatibility — wraps pickNextPrompt with pickCount = 0
 * (always picks from text pool). Use pickNextPrompt directly instead.
 */
export function buildPool(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect) {
  const { textPool } = splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect);
  return textPool;
}
