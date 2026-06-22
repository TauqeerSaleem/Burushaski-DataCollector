// src/utils/randomizer.js

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

function assignWeights(pool, countMap, idKey) {
  return pool.map((s) => {
    const baseWeight = Number(s.validationWeight || s.weight) > 0
      ? Number(s.validationWeight || s.weight)
      : 1;
    const globalCount = countMap[s[idKey]] || 0;
    return { ...s, effectiveWeight: baseWeight / (1 + globalCount) };
  });
}

function splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect) {
  const recordedSet = new Set(recordedIdsByUser);

  const eligible = allSentences.filter((s) => {
    if (!s.active) return false;
    if (s.dialect && s.dialect !== dialect && s.dialect !== "all") return false;
    if (recordedSet.has(s.prompt_id)) return false;
    return true;
  });

  const textPool = assignWeights(
    eligible.filter((s) => s.prompt_type !== "picture_description"),
    globalCountsByPromptId,
    "prompt_id"
  );

  const imagePool = assignWeights(
    eligible.filter((s) => s.prompt_type === "picture_description"),
    globalCountsByPromptId,
    "prompt_id"
  );

  return { textPool, imagePool };
}

function buildValidationPool(allTasks, validatedIds, globalValidationCounts) {
  const validatedSet = new Set(validatedIds);

  const eligible = allTasks.filter((t) => !validatedSet.has(t.id));

  return assignWeights(eligible, globalValidationCounts, "id");
}

export function pickNextPrompt(
  allSentences, recordedIdsByUser, globalCountsByPromptId, dialect,
  allValidationTasks, validatedIds, globalValidationCounts,
  pickCount
) {
  const { textPool, imagePool } = splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect);
  const validationPool = buildValidationPool(allValidationTasks, validatedIds, globalValidationCounts);

  const isSpecialTurn = pickCount % 4 === 3;

  if (!isSpecialTurn) {
    // Text turn — fall back to image or validation if text pool empty
    return weightedRandomPick(textPool)
      || weightedRandomPick(imagePool)
      || weightedRandomPick(validationPool)
      || null;
  }

  // Special turn — weighted random between image and validation pools
  const hasImage = imagePool.length > 0;
  const hasValidation = validationPool.length > 0;

  if (hasImage && hasValidation) {
    // Pick randomly between the two pools (each pool's total weight determines odds)
    const imageTotalWeight = imagePool.reduce((s, i) => s + i.effectiveWeight, 0);
    const validationTotalWeight = validationPool.reduce((s, i) => s + i.effectiveWeight, 0);
    const rand = Math.random() * (imageTotalWeight + validationTotalWeight);
    if (rand < imageTotalWeight) {
      return { ...weightedRandomPick(imagePool), _cardType: "image" };
    } else {
      return { ...weightedRandomPick(validationPool), _cardType: "validation" };
    }
  }

  if (hasImage) return { ...weightedRandomPick(imagePool), _cardType: "image" };
  if (hasValidation) return { ...weightedRandomPick(validationPool), _cardType: "validation" };

  // Fall back to text if neither available
  return weightedRandomPick(textPool) || null;
}

export function buildPool(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect) {
  const { textPool } = splitPools(allSentences, recordedIdsByUser, globalCountsByPromptId, dialect);
  return textPool;
}
