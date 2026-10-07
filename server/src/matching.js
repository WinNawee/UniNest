// Weighted similarity matching for roommates.
// Every component returns a score between 0 and 1. The final score is the
// weighted average, scaled to 0-100.

export const WEIGHTS = {
  cleanliness: 0.2,
  sleep: 0.17,
  budget: 0.15,
  noise: 0.1,
  social: 0.08,
  study: 0.1,
  guests: 0.05,
  culture: 0.1,
  smoking: 0.05,
};

// Two answers on a 1-5 scale: identical = 1, opposite ends = 0.
const scale = (a, b) => 1 - Math.abs(a - b) / 4;

// How much two budget ranges overlap, relative to the smaller range.
function budgetScore(a, b) {
  const lo = Math.max(a.budgetMin, b.budgetMin);
  const hi = Math.min(a.budgetMax, b.budgetMax);
  if (hi < lo) {
    // No overlap: decay with the gap, relative to the higher budget.
    const gap = lo - hi;
    return Math.max(0, 0.4 - gap / Math.max(a.budgetMax, b.budgetMax));
  }
  const overlap = hi - lo;
  const smaller = Math.max(1, Math.min(a.budgetMax - a.budgetMin, b.budgetMax - b.budgetMin));
  return 0.5 + 0.5 * Math.min(1, overlap / smaller);
}

// Shared languages count most, then openness to other cultures, then food.
function cultureScore(a, b) {
  const la = new Set((a.languages || []).map((x) => x.toLowerCase()));
  const lb = new Set((b.languages || []).map((x) => x.toLowerCase()));
  const shared = [...la].filter((x) => lb.has(x)).length;
  const language = shared > 0 ? 1 : 0.2;
  const openness = scale(a.culturalOpenness, b.culturalOpenness);
  const foodClash =
    (a.food === 'halal' && b.food === 'any_with_pork') ||
    (b.food === 'halal' && a.food === 'any_with_pork');
  const food = foodClash ? 0.3 : 1;
  return 0.5 * language + 0.3 * openness + 0.2 * food;
}

function smokingScore(a, b) {
  const order = { no: 0, outside: 1, yes: 2 };
  const d = Math.abs(order[a.smoking] - order[b.smoking]);
  return d === 0 ? 1 : d === 1 ? 0.5 : 0;
}

// Hard filters that remove a candidate completely.
export function isEligible(a, b) {
  if (a.userId === b.userId) return false;
  if ((a.genderPref === 'same' || b.genderPref === 'same') && a.gender !== b.gender) return false;
  if (a.campus && b.campus && a.campus !== b.campus) return false;
  return true;
}

export function scorePair(a, b) {
  const parts = {
    cleanliness: scale(a.cleanliness, b.cleanliness),
    sleep: scale(a.sleep, b.sleep),
    budget: budgetScore(a, b),
    noise: scale(a.noise, b.noise),
    social: scale(a.social, b.social),
    study: scale(a.study, b.study),
    guests: scale(a.guests, b.guests),
    culture: cultureScore(a, b),
    smoking: smokingScore(a, b),
  };
  let total = 0;
  for (const key of Object.keys(WEIGHTS)) total += WEIGHTS[key] * parts[key];

  // A smoker with a strict non-smoker is a dealbreaker for most people.
  if (smokingScore(a, b) === 0) total *= 0.7;

  const breakdown = Object.fromEntries(
    Object.entries(parts).map(([k, v]) => [k, Math.round(v * 100)])
  );
  return { score: Math.round(total * 100), breakdown };
}

export function rankMatches(me, candidates, limit = 20) {
  return candidates
    .filter((c) => isEligible(me, c))
    .map((c) => ({ userId: c.userId, ...scorePair(me, c) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

// Validate and normalise a questionnaire submission.
export function validateProfile(input) {
  const errors = [];
  const num = (k, min, max) => {
    const v = Number(input[k]);
    if (!Number.isFinite(v) || v < min || v > max) errors.push(`${k} must be ${min}-${max}`);
    return v;
  };
  const oneOf = (k, list) => {
    if (!list.includes(input[k])) errors.push(`${k} must be one of ${list.join(', ')}`);
    return input[k];
  };

  const profile = {
    cleanliness: num('cleanliness', 1, 5),
    sleep: num('sleep', 1, 5), // 1 = early bird, 5 = night owl
    noise: num('noise', 1, 5), // 1 = needs silence, 5 = fine with noise
    social: num('social', 1, 5), // 1 = homebody, 5 = very social
    study: num('study', 1, 5), // 1 = quiet and alone, 5 = group study
    guests: num('guests', 1, 5), // 1 = never, 5 = often
    culturalOpenness: num('culturalOpenness', 1, 5),
    budgetMin: num('budgetMin', 0, 1000000),
    budgetMax: num('budgetMax', 0, 1000000),
    smoking: oneOf('smoking', ['no', 'outside', 'yes']),
    food: oneOf('food', ['any', 'any_with_pork', 'halal', 'vegetarian']),
    gender: oneOf('gender', ['female', 'male', 'other']),
    genderPref: oneOf('genderPref', ['same', 'any']),
    languages: Array.isArray(input.languages)
      ? input.languages.map(String).slice(0, 6)
      : [],
    campus: input.campus ? String(input.campus) : '',
  };
  if (profile.budgetMin > profile.budgetMax) errors.push('budgetMin must not exceed budgetMax');
  if (profile.languages.length === 0) errors.push('languages needs at least one entry');
  return { profile, errors };
}
