import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniversityEmail } from '../src/app.js';
import { startTestServer, registerAndConfirm, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

const profile = {
  cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2, culturalOpenness: 4,
  budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female',
  genderPref: 'any', languages: ['Thai', 'English'], campus: 'AIT',
};

test('university email check', () => {
  assert.equal(isUniversityEmail('a@ait.ac.th'), true);
  assert.equal(isUniversityEmail('a@ait.asia'), true);
  assert.equal(isUniversityEmail('a@mit.edu'), true);
  assert.equal(isUniversityEmail('a@gmail.com'), false);
  assert.equal(isUniversityEmail('not-an-email'), false);
});

test('students cannot register with a personal email', async () => {
  const r = await ctx.call('/api/auth/register', { method: 'POST', body: { name: 'X', email: 'x@gmail.com', password: 'password1' } });
  assert.equal(r.status, 400);
});

test('student flow: register, confirm, questionnaire, matches, listings', async () => {
  const { token } = await registerAndConfirm(ctx, { name: 'Tester', email: 'tester@ait.ac.th', password: 'password1' });

  const early = await ctx.call('/api/matches', { token });
  assert.equal(early.status, 400);

  const put = await ctx.call('/api/me/profile', { method: 'PUT', token, body: profile });
  assert.equal(put.status, 200);

  const me = await ctx.call('/api/me', { token });
  assert.equal(me.data.profile.cleanliness, 4);
  assert.deepEqual(me.data.profile.languages, ['Thai', 'English']);

  const m = await ctx.call('/api/matches', { token });
  assert.equal(m.status, 200);
  assert.ok(m.data.matches.length > 0);
  const scores = m.data.matches.map((x) => x.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.ok(m.data.matches.every((x) => x.campus === 'AIT' && x.name));

  const one = await ctx.call(`/api/matches/${m.data.matches[0].userId}`, { token });
  assert.equal(one.status, 200);
  assert.equal(one.data.score, m.data.matches[0].score);

  const l = await ctx.call('/api/listings', { token });
  assert.ok(l.data.listings.length > 0);
  assert.ok(l.data.listings.every((x) => x.verified));
  const cheap = await ctx.call('/api/listings?maxPrice=3000', { token });
  assert.ok(cheap.data.listings.every((x) => x.price <= 3000));
});

test('login rejects a wrong password', async () => {
  const r = await login(ctx, 'mali@ait.ac.th', 'nope');
  assert.equal(r.status, 401);
});

test('landlord listing stays hidden until an admin verifies it', async () => {
  const { token: lt } = await registerAndConfirm(ctx, { name: 'Owner', email: 'owner2@example.com', password: 'password1', role: 'landlord' });
  const created = await ctx.call('/api/listings', { method: 'POST', token: lt, body: { title: 'Test room', type: 'dorm', price: 3000, beds: 1, distanceKm: 0.5, campus: 'AIT' } });
  assert.equal(created.status, 201);
  const id = created.data.listing.id;

  const mine = await ctx.call('/api/listings/mine', { token: lt });
  assert.equal(mine.data.listings.length, 1);

  const stu = await login(ctx, 'mali@ait.ac.th');
  const before = await ctx.call('/api/listings', { token: stu.data.token });
  assert.equal(before.data.listings.some((x) => x.id === id), false);

  const notAdmin = await ctx.call(`/api/admin/listings/${id}/verify`, { method: 'PUT', token: stu.data.token });
  assert.equal(notAdmin.status, 403);

  const admin = await login(ctx, 'admin@uninest.example');
  assert.equal(admin.data.user.role, 'admin');
  const me = await ctx.call('/api/me', { token: admin.data.token });
  assert.equal(me.data.isAdmin, true);
  const pending = await ctx.call('/api/admin/listings/pending', { token: admin.data.token });
  assert.ok(pending.data.listings.some((x) => x.id === id));
  const ok = await ctx.call(`/api/admin/listings/${id}/verify`, { method: 'PUT', token: admin.data.token });
  assert.equal(ok.status, 200);
  const missing = await ctx.call('/api/admin/listings/not-a-real-id/verify', { method: 'PUT', token: admin.data.token });
  assert.equal(missing.status, 404);

  const after = await ctx.call('/api/listings', { token: stu.data.token });
  assert.equal(after.data.listings.some((x) => x.id === id), true);
});

test('reviews on a listing', async () => {
  const stu = await login(ctx, 'mali@ait.ac.th');
  const [listing] = (await ctx.call('/api/listings', { token: stu.data.token })).data.listings;
  const bad = await ctx.call(`/api/listings/${listing.id}/reviews`, { method: 'POST', token: stu.data.token, body: { rating: 9 } });
  assert.equal(bad.status, 400);
  await ctx.call(`/api/listings/${listing.id}/reviews`, { method: 'POST', token: stu.data.token, body: { rating: 4, text: 'Clean' } });
  await ctx.call(`/api/listings/${listing.id}/reviews`, { method: 'POST', token: stu.data.token, body: { rating: 2 } });
  const r = await ctx.call(`/api/listings/${listing.id}/reviews`, { token: stu.data.token });
  assert.equal(r.data.reviews.length, 2);
  assert.equal(r.data.average, 3);
});

test('students cannot create listings and requests need a token', async () => {
  const stu = await login(ctx, 'mali@ait.ac.th');
  const r = await ctx.call('/api/listings', { method: 'POST', token: stu.data.token, body: { title: 'x', type: 'dorm', price: 1, beds: 1 } });
  assert.equal(r.status, 403);
  const noToken = await ctx.call('/api/listings');
  assert.equal(noToken.status, 401);
});

test('chat over REST: send, inbox with unread count, reading clears it', async () => {
  const mali = await login(ctx, 'mali@ait.ac.th');
  const ken = await login(ctx, 'ken@ait.ac.th');
  const kenId = ken.data.user.id;
  const maliId = mali.data.user.id;

  const sent = await ctx.call(`/api/chats/${kenId}`, { method: 'POST', token: mali.data.token, body: { text: 'Hi Ken' } });
  assert.equal(sent.status, 201);

  const empty = await ctx.call(`/api/chats/${kenId}`, { method: 'POST', token: mali.data.token, body: { text: '   ' } });
  assert.equal(empty.status, 400);
  const self = await ctx.call(`/api/chats/${maliId}`, { method: 'POST', token: mali.data.token, body: { text: 'me' } });
  assert.equal(self.status, 400);
  const nobody = await ctx.call('/api/chats/does-not-exist', { method: 'POST', token: mali.data.token, body: { text: 'hi' } });
  assert.equal(nobody.status, 404);

  const inbox = await ctx.call('/api/chats', { token: ken.data.token });
  const row = inbox.data.chats.find((c) => c.userId === maliId);
  assert.equal(row.name, 'Mali');
  assert.equal(row.unread, 1);
  assert.equal(row.last.text, 'Hi Ken');
  assert.equal(inbox.data.unread, 1);

  const history = await ctx.call(`/api/chats/${maliId}`, { token: ken.data.token });
  assert.equal(history.data.partner.name, 'Mali');
  assert.equal(history.data.messages.length, 1);

  const after = await ctx.call('/api/chats', { token: ken.data.token });
  assert.equal(after.data.chats.find((c) => c.userId === maliId).unread, 0);
});
