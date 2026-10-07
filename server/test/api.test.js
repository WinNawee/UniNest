import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildApp, isUniversityEmail } from '../src/app.js';

let server;
let base;

test.before(async () => {
  server = http.createServer(buildApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

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
  const r = await call('/api/auth/register', { method: 'POST', body: { name: 'X', email: 'x@gmail.com', password: 'password1' } });
  assert.equal(r.status, 400);
});

test('student flow: register, questionnaire, matches, listings', async () => {
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: 'Tester', email: 'tester@ait.ac.th', password: 'password1' } });
  assert.equal(reg.status, 201);
  const token = reg.data.token;

  const early = await call('/api/matches', { token });
  assert.equal(early.status, 400);

  const put = await call('/api/me/profile', { method: 'PUT', token, body: profile });
  assert.equal(put.status, 200);

  const m = await call('/api/matches', { token });
  assert.equal(m.status, 200);
  assert.ok(m.data.matches.length > 0);
  const scores = m.data.matches.map((x) => x.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.ok(m.data.matches.every((x) => x.campus === 'AIT'));

  const l = await call('/api/listings', { token });
  assert.ok(l.data.listings.length > 0);
  assert.ok(l.data.listings.every((x) => x.verified));
});

test('login rejects a wrong password', async () => {
  const r = await call('/api/auth/login', { method: 'POST', body: { email: 'mali@ait.ac.th', password: 'nope' } });
  assert.equal(r.status, 401);
});

test('landlord listing stays hidden until an admin verifies it', async () => {
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: 'Owner', email: 'owner2@example.com', password: 'password1', role: 'landlord' } });
  const lt = reg.data.token;
  const created = await call('/api/listings', { method: 'POST', token: lt, body: { title: 'Test room', type: 'dorm', price: 3000, beds: 1, distanceKm: 0.5, campus: 'AIT' } });
  assert.equal(created.status, 201);
  const id = created.data.listing.id;

  const stu = await call('/api/auth/register', { method: 'POST', body: { name: 'S', email: 's2@ait.ac.th', password: 'password1' } });
  const before = await call('/api/listings', { token: stu.data.token });
  assert.equal(before.data.listings.some((x) => x.id === id), false);

  const notAdmin = await call(`/api/admin/listings/${id}/verify`, { method: 'PUT', token: stu.data.token });
  assert.equal(notAdmin.status, 403);

  const admin = await call('/api/auth/register', { method: 'POST', body: { name: 'Admin', email: 'admin@uninest.example', password: 'password1', role: 'landlord' } });
  const ok = await call(`/api/admin/listings/${id}/verify`, { method: 'PUT', token: admin.data.token });
  assert.equal(ok.status, 200);

  const after = await call('/api/listings', { token: stu.data.token });
  assert.equal(after.data.listings.some((x) => x.id === id), true);
});

test('students cannot create listings and requests need a token', async () => {
  const stu = await call('/api/auth/login', { method: 'POST', body: { email: 'mali@ait.ac.th', password: 'demo1234' } });
  const r = await call('/api/listings', { method: 'POST', token: stu.data.token, body: { title: 'x', type: 'dorm', price: 1, beds: 1 } });
  assert.equal(r.status, 403);
  const noToken = await call('/api/listings');
  assert.equal(noToken.status, 401);
});

test('chat over REST: send, inbox with unread count, reading clears it', async () => {
  const mali = await call('/api/auth/login', { method: 'POST', body: { email: 'mali@ait.ac.th', password: 'demo1234' } });
  const ken = await call('/api/auth/login', { method: 'POST', body: { email: 'ken@ait.ac.th', password: 'demo1234' } });
  const kenId = ken.data.user.id;
  const maliId = mali.data.user.id;

  const sent = await call(`/api/chats/${kenId}`, { method: 'POST', token: mali.data.token, body: { text: 'Hi Ken' } });
  assert.equal(sent.status, 201);

  const empty = await call(`/api/chats/${kenId}`, { method: 'POST', token: mali.data.token, body: { text: '   ' } });
  assert.equal(empty.status, 400);
  const self = await call(`/api/chats/${maliId}`, { method: 'POST', token: mali.data.token, body: { text: 'me' } });
  assert.equal(self.status, 400);

  const inbox = await call('/api/chats', { token: ken.data.token });
  const row = inbox.data.chats.find((c) => c.userId === maliId);
  assert.equal(row.name, 'Mali');
  assert.equal(row.unread, 1);
  assert.equal(row.last.text, 'Hi Ken');

  const history = await call(`/api/chats/${maliId}`, { token: ken.data.token });
  assert.equal(history.data.partner.name, 'Mali');
  assert.equal(history.data.messages.length, 1);

  const after = await call('/api/chats', { token: ken.data.token });
  assert.equal(after.data.chats.find((c) => c.userId === maliId).unread, 0);
});
