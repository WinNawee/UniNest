import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePair, isEligible, rankMatches, validateProfile } from '../src/matching.js';

const base = {
  cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2,
  culturalOpenness: 4, budgetMin: 4000, budgetMax: 7000, smoking: 'no',
  food: 'any', gender: 'female', genderPref: 'any', languages: ['Thai', 'English'], campus: 'AIT',
};
const p = (userId, over = {}) => ({ userId, ...base, ...over });

test('identical profiles score close to 100', () => {
  const { score } = scorePair(p('a'), p('b'));
  assert.ok(score >= 95, `got ${score}`);
});

test('opposite lifestyles score much lower than similar ones', () => {
  const similar = scorePair(p('a'), p('b', { cleanliness: 5 })).score;
  const opposite = scorePair(
    p('a'),
    p('c', { cleanliness: 1, sleep: 5, noise: 5, social: 5, study: 5, guests: 5, smoking: 'yes' })
  ).score;
  assert.ok(similar > opposite + 30, `similar ${similar}, opposite ${opposite}`);
});

test('score is symmetric', () => {
  const a = p('a', { sleep: 1, budgetMax: 9000 });
  const b = p('b', { sleep: 4, cleanliness: 2 });
  assert.equal(scorePair(a, b).score, scorePair(b, a).score);
});

test('non-overlapping budgets lower the budget component', () => {
  const near = scorePair(p('a'), p('b')).breakdown.budget;
  const far = scorePair(p('a'), p('c', { budgetMin: 12000, budgetMax: 15000 })).breakdown.budget;
  assert.ok(near > far);
});

test('smoker with strict non-smoker is penalised', () => {
  const ok = scorePair(p('a'), p('b')).score;
  const clash = scorePair(p('a'), p('c', { smoking: 'yes' })).score;
  assert.ok(ok - clash >= 25, `ok ${ok}, clash ${clash}`);
});

test('same-gender preference removes other genders', () => {
  const a = p('a', { genderPref: 'same' });
  assert.equal(isEligible(a, p('b', { gender: 'male' })), false);
  assert.equal(isEligible(a, p('c', { gender: 'female' })), true);
});

test('different campuses are not matched, and users do not match themselves', () => {
  assert.equal(isEligible(p('a'), p('b', { campus: 'KMITL' })), false);
  assert.equal(isEligible(p('a'), p('a')), false);
});

test('rankMatches returns best first', () => {
  const me = p('me');
  const out = rankMatches(me, [
    p('far', { cleanliness: 1, sleep: 5, noise: 5 }),
    p('close', { cleanliness: 4 }),
    p('mid', { cleanliness: 3, sleep: 3 }),
  ]);
  assert.deepEqual(out.map((x) => x.userId), ['close', 'mid', 'far']);
});

test('validateProfile accepts good input and rejects bad input', () => {
  assert.equal(validateProfile(base).errors.length, 0);
  const bad = validateProfile({ ...base, cleanliness: 9, budgetMin: 9000, budgetMax: 1000, languages: [] });
  assert.ok(bad.errors.length >= 3);
});
