import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { verificationHtml, verificationText, createMailer } from '../src/mailer.js';
import { startTestServer, fakeMailer, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

const register = (body) => ctx.call('/api/auth/register', { method: 'POST', body });
const verify = (token) => ctx.call('/api/auth/verify-email', { method: 'POST', body: { token } });
const resend = (email) => ctx.call('/api/auth/resend-verification', { method: 'POST', body: { email } });

test('sign-up sends a confirmation link and gives no login token yet', async () => {
  const r = await register({ name: 'Nida', email: 'nida@ait.ac.th', password: 'password1' });
  assert.equal(r.status, 201);
  assert.equal(r.data.token, undefined);
  assert.equal(r.data.emailSent, true);
  assert.equal(r.data.devVerifyUrl, undefined);

  const mail = ctx.mailer.sent.at(-1);
  assert.equal(mail.to, 'nida@ait.ac.th');
  assert.equal(mail.name, 'Nida');
  assert.match(mail.link, /\/verify-email\?token=[0-9a-f]{64}$/);
});

test('cannot log in before confirming', async () => {
  const r = await login(ctx, 'nida@ait.ac.th', 'password1');
  assert.equal(r.status, 403);
  assert.equal(r.data.needsVerification, true);
});

test('a wrong token is rejected', async () => {
  const r = await verify('f'.repeat(64));
  assert.equal(r.status, 400);
  const empty = await verify('');
  assert.equal(empty.status, 400);
});

test('the link confirms the account, logs in, and works only once', async () => {
  const token = ctx.mailer.lastToken();
  const ok = await verify(token);
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  assert.equal(ok.data.user.verified, true);

  const me = await ctx.call('/api/me', { token: ok.data.token });
  assert.equal(me.status, 200);

  const again = await verify(token);
  assert.equal(again.status, 400);

  const r = await login(ctx, 'nida@ait.ac.th', 'password1');
  assert.equal(r.status, 200);
});

test('the database stores only a hash of the token', async () => {
  await register({ name: 'Hash Check', email: 'hash@ait.ac.th', password: 'password1' });
  const token = ctx.mailer.lastToken();
  const user = await db.users.findByEmail('hash@ait.ac.th');
  assert.ok(user.verifyTokenHash);
  assert.notEqual(user.verifyTokenHash, token);
  assert.equal(JSON.stringify(user).includes(token), false);
});

test('resend makes a new link, the old one stops working, and it is rate limited', async () => {
  await register({ name: 'Ploy', email: 'ploy@ait.ac.th', password: 'password1' });
  const oldToken = ctx.mailer.lastToken();

  const tooSoon = await resend('ploy@ait.ac.th');
  assert.equal(tooSoon.status, 429);

  // Pretend the first email was sent two minutes ago.
  const user = await db.users.findByEmail('ploy@ait.ac.th');
  await db.users.update(user.id, { verifyTokenSentAt: new Date(Date.now() - 120000).toISOString() });

  const r = await resend('ploy@ait.ac.th');
  assert.equal(r.status, 200);
  const newToken = ctx.mailer.lastToken();
  assert.notEqual(newToken, oldToken);

  assert.equal((await verify(oldToken)).status, 400);
  assert.equal((await verify(newToken)).status, 200);
});

test('resend gives the same answer for unknown or confirmed emails', async () => {
  const count = ctx.mailer.sent.length;
  const unknown = await resend('nobody@ait.ac.th');
  const confirmed = await resend('mali@ait.ac.th');
  assert.equal(unknown.status, 200);
  assert.equal(confirmed.status, 200);
  assert.equal(unknown.data.message, confirmed.data.message);
  assert.equal(ctx.mailer.sent.length, count);
});

test('an expired link is rejected', async () => {
  await register({ name: 'Old Link', email: 'old@ait.ac.th', password: 'password1' });
  const token = ctx.mailer.lastToken();
  const user = await db.users.findByEmail('old@ait.ac.th');
  await db.users.update(user.id, { verifyTokenExpires: new Date(Date.now() - 1000).toISOString() });
  const r = await verify(token);
  assert.equal(r.status, 400);
  assert.equal(r.data.expired, true);
});

test('landlords also confirm their email', async () => {
  const r = await register({ name: 'Dorm Owner', email: 'dorm@example.com', password: 'password1', role: 'landlord' });
  assert.equal(r.status, 201);
  assert.equal((await login(ctx, 'dorm@example.com', 'password1')).status, 403);
});

test('the email contains the link and escapes the name', () => {
  const link = 'http://localhost:5173/verify-email?token=abc';
  assert.ok(verificationText('Mali', link).includes(link));
  const html = verificationHtml('<b>Eve</b>', link);
  assert.ok(html.includes(link));
  assert.ok(html.includes('&lt;b&gt;Eve&lt;/b&gt;'));
  assert.equal(html.includes('<b>Eve</b>'), false);
});

test('without SMTP settings the mailer does not send and reports it', async () => {
  const mailer = createMailer({});
  assert.equal(mailer.configured, false);
  const original = console.log;
  console.log = () => {};
  try {
    const r = await mailer.sendVerification({ to: 'a@ait.ac.th', name: 'A', link: 'http://x/verify-email?token=1' });
    assert.equal(r.delivered, false);
  } finally {
    console.log = original;
  }
  assert.equal(createMailer({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'u', SMTP_PASS: 'p' }).configured, true);
});

test('when email is not set up, sign-up returns the link for local use', async () => {
  const local = await startTestServer({ mailer: fakeMailer({ delivered: false }) });
  try {
    const r = await local.call('/api/auth/register', { method: 'POST', body: { name: 'Dev', email: 'dev@ait.ac.th', password: 'password1' } });
    assert.equal(r.status, 201);
    assert.equal(r.data.emailSent, false);
    assert.match(r.data.devVerifyUrl, /\/verify-email\?token=/);
  } finally {
    await local.stop();
  }
});
