import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { MAX_PHOTOS } from '../src/photos.js';
import { applyAdminPassword, DEMO_ADMIN_EMAIL } from '../src/seed.js';
import { startTestServer, registerAndConfirm, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Runs fn as if on the live site (NODE_ENV=production).
async function asLiveSite(fn) {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await fn();
  } finally {
    process.env.NODE_ENV = before;
  }
}

// ---------- Room photos ----------

test('landlord adds and removes room photos; anyone can view them', async () => {
  const owner = (await login(ctx, 'owner@baansuan.example')).data.token;
  const [room] = (await ctx.call('/api/listings/mine', { token: owner })).data.listings;

  const added = await ctx.call(`/api/listings/${room.id}/photos`, { method: 'POST', token: owner, body: { photo: PHOTO } });
  assert.equal(added.status, 201);
  assert.equal(added.data.photoIds.length, 1);
  const photoId = added.data.photoIds[0];

  // The image is served as a real PNG, without logging in.
  const img = await fetch(`${ctx.base}/api/photos/${photoId}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.ok((await img.arrayBuffer()).byteLength > 0);

  // Students see the photo ids on the room.
  const mali = (await login(ctx, 'mali@ait.ac.th')).data.token;
  const shown = (await ctx.call('/api/listings', { token: mali })).data.listings.find((l) => l.id === room.id);
  assert.deepEqual(shown.photoIds, [photoId]);

  const removed = await ctx.call(`/api/listings/${room.id}/photos/${photoId}`, { method: 'DELETE', token: owner });
  assert.deepEqual(removed.data.photoIds, []);
  assert.equal((await fetch(`${ctx.base}/api/photos/${photoId}`)).status, 404);
});

test('photos: only the owner, only images, and a limit per room', async () => {
  const owner = (await login(ctx, 'owner@baansuan.example')).data.token;
  const [, room] = (await ctx.call('/api/listings/mine', { token: owner })).data.listings;
  const url = `/api/listings/${room.id}/photos`;

  const other = await registerAndConfirm(ctx, { name: 'Other Owner', email: 'other.owner@example.com', password: 'password123', role: 'landlord' });
  assert.equal((await ctx.call(url, { method: 'POST', token: other.token, body: { photo: PHOTO } })).status, 404);
  const mali = (await login(ctx, 'mali@ait.ac.th')).data.token;
  assert.equal((await ctx.call(url, { method: 'POST', token: mali, body: { photo: PHOTO } })).status, 403);
  assert.equal((await ctx.call(url, { method: 'POST', token: owner, body: { photo: 'data:text/html;base64,PGI+' } })).status, 400);

  for (let i = 0; i < MAX_PHOTOS; i++) {
    assert.equal((await ctx.call(url, { method: 'POST', token: owner, body: { photo: PHOTO } })).status, 201);
  }
  const tooMany = await ctx.call(url, { method: 'POST', token: owner, body: { photo: PHOTO } });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.data.error, /up to/);
});

// ---------- Live site safety ----------

test('on the live site demo accounts are switched off and hidden from matches', async () => {
  const real = await registerAndConfirm(ctx, { name: 'Real Student', email: 'real.student@ait.ac.th', password: 'password123' });
  await ctx.call('/api/me/profile', {
    method: 'PUT',
    token: real.token,
    body: {
      cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2, culturalOpenness: 4,
      budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'any',
      languages: ['Thai', 'English'], campus: 'AIT',
    },
  });
  const demoToken = (await login(ctx, 'mali@ait.ac.th')).data.token; // issued before going live

  await asLiveSite(async () => {
    // Demo students and the demo landlord cannot log in, and old tokens stop working.
    const r = await login(ctx, 'mali@ait.ac.th');
    assert.equal(r.status, 403);
    assert.match(r.data.error, /switched off/);
    assert.equal((await login(ctx, 'owner@baansuan.example')).status, 403);
    assert.equal((await ctx.call('/api/me', { token: demoToken })).status, 401);

    // The admin still works.
    assert.equal((await login(ctx, DEMO_ADMIN_EMAIL)).status, 200);

    // Real students only see real people, and demo rooms are marked as samples.
    const matches = (await ctx.call('/api/matches', { token: real.token })).data;
    const demoUsers = await db.users.find({ email: 'mali@ait.ac.th' });
    assert.ok(!matches.matches.some((m) => m.userId === demoUsers[0].id));
    const rooms = (await ctx.call('/api/listings', { token: real.token })).data.listings;
    assert.ok(rooms.length > 0 && rooms.every((l) => l.sample));
  });

  // Back on a laptop, everything works as before.
  assert.equal((await login(ctx, 'mali@ait.ac.th')).status, 200);
  const rooms = (await ctx.call('/api/listings', { token: real.token })).data.listings;
  assert.ok(rooms.every((l) => !l.sample));
});

test('DEMO_ACCOUNTS=on keeps demo accounts working on the live site', async () => {
  process.env.DEMO_ACCOUNTS = 'on';
  try {
    await asLiveSite(async () => {
      assert.equal((await login(ctx, 'mali@ait.ac.th')).status, 200);
    });
  } finally {
    delete process.env.DEMO_ACCOUNTS;
  }
});

test('the admin password can be replaced by ADMIN_PASSWORD', async () => {
  assert.equal(await applyAdminPassword('a-long-private-password'), true);
  assert.equal(await applyAdminPassword('a-long-private-password'), false); // already set
  assert.equal((await login(ctx, DEMO_ADMIN_EMAIL)).status, 401); // demo password no longer works
  assert.equal((await login(ctx, DEMO_ADMIN_EMAIL, 'a-long-private-password')).status, 200);
});
