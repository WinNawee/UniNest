import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { REFERRAL_DAYS, MAX_REWARDED_FRIENDS } from '../src/referrals.js';
import { FEATURED_PLAN } from '../src/payments.js';
import { startTestServer, registerAndConfirm, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

const SLIP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const DAY = 86400000;
const makePremium = async (email) => {
  const u = await db.users.findByEmail(email);
  await db.users.update(u.id, { premiumUntil: new Date(Date.now() + 30 * DAY).toISOString() });
};
const daysLeft = (iso) => (new Date(iso) - Date.now()) / DAY;

// ---------- Advanced filters ----------

test('match filters work for Premium and are ignored for free students', async () => {
  const ken = await login(ctx, 'ken@ait.ac.th');
  const q = '/api/matches?smoking=no&food=vegetarian';

  const free = await ctx.call(q, { token: ken.data.token });
  assert.equal(free.data.filtersLocked, true);
  assert.deepEqual(free.data.filtersApplied, {});

  await makePremium('ken@ait.ac.th');
  const paid = await ctx.call(q, { token: ken.data.token });
  assert.equal(paid.data.filtersLocked, false);
  assert.deepEqual(paid.data.filtersApplied, { smoking: 'no', food: 'vegetarian' });
  const all = await db.profiles.all();
  for (const m of paid.data.matches) {
    const p = all.find((x) => x.userId === m.userId);
    assert.equal(p.smoking, 'no');
    assert.equal(p.food, 'vegetarian');
  }
  assert.ok(paid.data.matches.length < (await ctx.call('/api/matches', { token: ken.data.token })).data.matches.length);

  const scored = await ctx.call('/api/matches?minScore=70&language=japanese', { token: ken.data.token });
  assert.ok(scored.data.matches.every((m) => m.score >= 70));
  const late = await ctx.call('/api/matches?sleep=late&gender=female&maxBudget=4000', { token: ken.data.token });
  for (const m of late.data.matches) {
    const p = all.find((x) => x.userId === m.userId);
    assert.ok(p.sleep >= 4 && p.gender === 'female' && p.budgetMin <= 4000);
  }
  // Nonsense values are ignored.
  const junk = await ctx.call('/api/matches?gender=robot&minScore=-5', { token: ken.data.token });
  assert.deepEqual(junk.data.filtersApplied, {});
});

// ---------- Who viewed me ----------

test('profile views: free students see the count, Premium see names', async () => {
  const aisha = await login(ctx, 'aisha@ait.ac.th');
  const rin = await login(ctx, 'rin@ait.ac.th');
  const mali = await login(ctx, 'mali@ait.ac.th');
  const maliId = mali.data.user.id;

  await ctx.call(`/api/profile-views/${maliId}`, { method: 'POST', token: aisha.data.token });
  await ctx.call(`/api/profile-views/${maliId}`, { method: 'POST', token: aisha.data.token }); // counted once
  await ctx.call(`/api/profile-views/${maliId}`, { method: 'POST', token: rin.data.token });
  assert.equal((await ctx.call(`/api/profile-views/${maliId}`, { method: 'POST', token: mali.data.token })).status, 400);
  const owner = await login(ctx, 'owner@baansuan.example');
  assert.equal((await ctx.call(`/api/profile-views/${owner.data.user.id}`, { method: 'POST', token: aisha.data.token })).status, 404);

  const free = await ctx.call('/api/profile-views', { token: mali.data.token });
  assert.equal(free.data.count, 2);
  assert.equal(free.data.thisWeek, 2);
  assert.equal(free.data.locked, true);
  assert.deepEqual(free.data.viewers, []);

  await makePremium('mali@ait.ac.th');
  const paid = await ctx.call('/api/profile-views', { token: mali.data.token });
  assert.equal(paid.data.locked, false);
  assert.deepEqual(paid.data.viewers.map((v) => v.name).sort(), ['Aisha', 'Rin']);
});

// ---------- Referral program ----------

test('invite link: both students get Premium days when the friend confirms', async () => {
  const anan = await login(ctx, 'anan@ait.ac.th');
  const before = await db.users.findByEmail('anan@ait.ac.th');
  assert.equal(before.premiumUntil, undefined);

  const info = await ctx.call('/api/referral', { token: anan.data.token });
  assert.match(info.data.code, /^[A-Z0-9]{6}$/);
  assert.ok(info.data.link.endsWith(`?ref=${info.data.code}`));
  assert.equal(info.data.friendsJoined, 0);
  // Same code every time.
  assert.equal((await ctx.call('/api/referral', { token: anan.data.token })).data.code, info.data.code);

  const pub = await ctx.call(`/api/referral/${info.data.code}`);
  assert.equal(pub.data.name, 'Anan');
  assert.equal((await ctx.call('/api/referral/NOPE12')).status, 404);

  // Friend signs up with the code: nothing yet until they confirm.
  await ctx.call('/api/auth/register', { method: 'POST', body: { name: 'Friend', email: 'friend1@ait.ac.th', password: 'password1', ref: info.data.code.toLowerCase() } });
  assert.equal((await ctx.call('/api/referral', { token: anan.data.token })).data.friendsWaiting, 1);
  assert.equal((await db.users.findByEmail('anan@ait.ac.th')).premiumUntil, undefined);

  const confirmed = await ctx.call('/api/auth/verify-email', { method: 'POST', body: { token: ctx.mailer.lastToken() } });
  assert.equal(confirmed.data.referralReward, true);
  assert.equal(confirmed.data.user.premium, true);
  assert.ok(Math.abs(daysLeft(confirmed.data.user.premiumUntil) - REFERRAL_DAYS) < 0.01);

  const after = await db.users.findByEmail('anan@ait.ac.th');
  assert.ok(Math.abs(daysLeft(after.premiumUntil) - REFERRAL_DAYS) < 0.01);
  const stats = await ctx.call('/api/referral', { token: anan.data.token });
  assert.equal(stats.data.friendsJoined, 1);
  assert.equal(stats.data.daysEarned, REFERRAL_DAYS);
});

test('the inviter is rewarded at most for the limit, and bad codes are ignored', async () => {
  const sara = await login(ctx, 'sara@kmitl.ac.th');
  const { code } = (await ctx.call('/api/referral', { token: sara.data.token })).data;
  for (let i = 0; i < MAX_REWARDED_FRIENDS + 1; i++) {
    await registerAndConfirm(ctx, { name: `Mate ${i}`, email: `mate${i}@kmitl.ac.th`, password: 'password1', ref: code });
  }
  const s = await db.users.findByEmail('sara@kmitl.ac.th');
  const expected = MAX_REWARDED_FRIENDS * REFERRAL_DAYS;
  assert.ok(Math.abs(daysLeft(s.premiumUntil) - expected) < 0.05, `got ${daysLeft(s.premiumUntil)} days`);

  // A wrong code just signs up normally.
  const plain = await registerAndConfirm(ctx, { name: 'No Code', email: 'nocode@ait.ac.th', password: 'password1', ref: 'ZZZZZZ' });
  assert.equal(plain.user.premium, false);
  // Landlords cannot use invite codes.
  await registerAndConfirm(ctx, { name: 'Land Lord', email: 'll@example.com', password: 'password1', role: 'landlord', ref: code });
  assert.equal((await db.users.findByEmail('ll@example.com')).referredBy, undefined);
});

// ---------- Featured listings ----------

test('landlord pays to feature a verified room, admin approves, room goes first', async () => {
  const owner = await login(ctx, 'owner@baansuan.example');
  const mine = (await ctx.call('/api/listings/mine', { token: owner.data.token })).data.listings;
  const room = mine.find((l) => l.title === 'Budget fan room');
  const pendingRoom = mine.find((l) => !l.verified);

  const page = await ctx.call(`/api/featured/${room.id}`, { token: owner.data.token });
  assert.equal(page.data.plan.amount, FEATURED_PLAN.amount);
  assert.match(page.data.qr, /^data:image\/png/);

  // Not verified yet, someone else's room, or a student: refused.
  assert.equal((await ctx.call(`/api/featured/${pendingRoom.id}/payments`, { method: 'POST', token: owner.data.token, body: { slip: SLIP } })).status, 400);
  const other = await registerAndConfirm(ctx, { name: 'Other Owner', email: 'other@example.com', password: 'password1', role: 'landlord' });
  assert.equal((await ctx.call(`/api/featured/${room.id}`, { token: other.token })).status, 404);
  const stu = await login(ctx, 'rin@ait.ac.th');
  assert.equal((await ctx.call(`/api/featured/${room.id}`, { token: stu.data.token })).status, 403);

  const paid = await ctx.call(`/api/featured/${room.id}/payments`, { method: 'POST', token: owner.data.token, body: { slip: SLIP } });
  assert.equal(paid.status, 201);
  assert.equal(paid.data.payment.type, 'featured');
  assert.equal((await ctx.call(`/api/featured/${room.id}/payments`, { method: 'POST', token: owner.data.token, body: { slip: SLIP } })).status, 409);
  const listed = (await ctx.call('/api/listings/mine', { token: owner.data.token })).data.listings.find((l) => l.id === room.id);
  assert.equal(listed.featurePending, true);

  const admin = await login(ctx, 'admin@uninest.example');
  const queue = (await ctx.call('/api/admin/payments', { token: admin.data.token })).data.payments;
  const row = queue.find((p) => p.id === paid.data.payment.id);
  assert.equal(row.type, 'featured');
  assert.equal(row.listingTitle, 'Budget fan room');
  assert.equal(row.user.role, 'landlord');

  const ok = await ctx.call(`/api/admin/payments/${row.id}/approve`, { method: 'PUT', token: admin.data.token });
  assert.equal(ok.status, 200);
  assert.ok(Math.abs(daysLeft(ok.data.featuredUntil) - FEATURED_PLAN.days) < 0.01);

  // Landlord is not given Premium by a featured payment.
  assert.equal((await db.users.findByEmail('owner@baansuan.example')).premiumUntil, undefined);
  const housing = (await ctx.call('/api/listings', { token: stu.data.token })).data.listings;
  const featuredTitles = housing.filter((l) => l.featured).map((l) => l.title);
  assert.ok(featuredTitles.includes('Budget fan room'));
  assert.ok(housing.slice(0, featuredTitles.length).every((l) => l.featured));
});

// ---------- Dashboard ----------

test('dashboard counts real users only by default, with a funnel and revenue', async () => {
  const admin = await login(ctx, 'admin@uninest.example');
  const stu = await login(ctx, 'mali@ait.ac.th');
  assert.equal((await ctx.call('/api/admin/stats', { token: stu.data.token })).status, 403);

  const real = (await ctx.call('/api/admin/stats', { token: admin.data.token })).data;
  assert.equal(real.includeDemo, false);
  const steps = real.funnel.map((s) => s.count);
  assert.deepEqual(real.funnel.map((s) => s.label), ['Signed up', 'Confirmed email', 'Completed profile', 'Started a chat', 'Paid for Premium']);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] <= steps[i - 1]);
  // Sign-ups made in these tests are real (not demo), demo students are not counted.
  assert.ok(real.users.students >= 8);
  assert.equal(real.signups.length, 14);
  assert.ok(real.signups.at(-1).count >= 1);
  assert.equal(real.revenue.featured, 0); // the featured payment came from the demo landlord

  const demo = (await ctx.call('/api/admin/stats?includeDemo=1', { token: admin.data.token })).data;
  assert.ok(demo.users.students > real.users.students);
  assert.equal(demo.revenue.featured, FEATURED_PLAN.amount);
  assert.equal(demo.revenue.featuredCount, 1);
  assert.ok(demo.listings.featuredNow >= 2);
  assert.ok(demo.reviews.count >= 3);
  assert.ok(demo.referrals.friendsJoined >= 1);
});
