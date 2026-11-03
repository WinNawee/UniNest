import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { startTestServer, registerAndConfirm, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

const forgot = (email) => ctx.call('/api/auth/forgot-password', { method: 'POST', body: { email } });
const reset = (token, password) => ctx.call('/api/auth/reset-password', { method: 'POST', body: { token, password } });

test('forgot password: email link sets a new password and logs in', async () => {
  const first = await registerAndConfirm(ctx, { name: 'Ploy Test', email: 'ploy.reset@ait.ac.th', password: 'old-password' });

  const r = await forgot('ploy.reset@ait.ac.th');
  assert.equal(r.status, 200);
  const mail = ctx.mailer.sent.at(-1);
  assert.equal(mail.kind, 'reset');
  assert.equal(mail.to, 'ploy.reset@ait.ac.th');
  assert.match(mail.link, /\/reset-password\?token=/);

  // Too short a password is refused, and the link still works afterwards.
  assert.equal((await reset(ctx.mailer.lastToken(), 'short')).status, 400);

  const ok = await reset(ctx.mailer.lastToken(), 'new-password-1');
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);

  assert.equal((await login(ctx, 'ploy.reset@ait.ac.th', 'old-password')).status, 401);
  assert.equal((await login(ctx, 'ploy.reset@ait.ac.th', 'new-password-1')).status, 200);

  // The link works once only.
  assert.equal((await reset(ctx.mailer.lastToken(), 'another-password')).status, 400);

  // Logins made before the reset stop working; the new one works.
  assert.equal((await ctx.call('/api/me', { token: first.token })).status, 401);
  assert.equal((await ctx.call('/api/me', { token: ok.data.token })).status, 200);
});

test('forgot password gives the same answer for unknown emails and limits repeats', async () => {
  const sentBefore = ctx.mailer.sent.length;
  const unknown = await forgot('nobody@ait.ac.th');
  assert.equal(unknown.status, 200);
  assert.equal(ctx.mailer.sent.length, sentBefore); // nothing sent

  assert.equal((await forgot('rin@ait.ac.th')).status, 200);
  const again = await forgot('rin@ait.ac.th');
  assert.equal(again.status, 429);
  assert.match(again.data.error, /wait/);
});

test('expired and made-up reset links are refused', async () => {
  assert.equal((await reset('made-up-token', 'new-password-1')).status, 400);

  await forgot('ken@ait.ac.th');
  const ken = await db.users.findByEmail('ken@ait.ac.th');
  await db.users.update(ken.id, { resetTokenExpires: new Date(Date.now() - 1000).toISOString() });
  const r = await reset(ctx.mailer.lastToken(), 'new-password-1');
  assert.equal(r.status, 400);
  assert.equal(r.data.expired, true);
});

test('resetting also confirms an account that was never confirmed', async () => {
  await ctx.call('/api/auth/register', { method: 'POST', body: { name: 'Late Confirm', email: 'late.confirm@ait.ac.th', password: 'password123' } });
  assert.equal((await login(ctx, 'late.confirm@ait.ac.th', 'password123')).status, 403);

  // Wait out the resend limit by moving the "sent at" time back.
  const u = await db.users.findByEmail('late.confirm@ait.ac.th');
  await db.users.update(u.id, { resetTokenSentAt: null });
  await forgot('late.confirm@ait.ac.th');
  assert.equal((await reset(ctx.mailer.lastToken(), 'password456')).status, 200);
  assert.equal((await login(ctx, 'late.confirm@ait.ac.th', 'password456')).status, 200);
});
