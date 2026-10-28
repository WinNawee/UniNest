import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/index.js';
import { makeQr, isPremium, FREE_MATCH_LIMIT, PLAN } from '../src/payments.js';
import { startTestServer, registerAndConfirm, login } from './helpers.js';

let ctx;
test.before(async () => { ctx = await startTestServer(); });
test.after(() => ctx.stop());

// A tiny valid PNG, standing in for a slip photo.
const SLIP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const asAdmin = async () => (await login(ctx, 'admin@uninest.example')).data.token;
const upload = (token, slip = SLIP) => ctx.call('/api/premium/payments', { method: 'POST', token, body: { slip } });

test('QR follows the Thai PromptPay format and is a test QR without a PromptPay number', async () => {
  const saved = process.env.PROMPTPAY_ID;
  delete process.env.PROMPTPAY_ID;
  const testQr = await makeQr();
  assert.equal(testQr.testMode, true);
  assert.match(testQr.image, /^data:image\/png;base64,/);

  process.env.PROMPTPAY_ID = '081-234-5678';
  const real = await makeQr();
  assert.equal(real.testMode, false);
  assert.ok(real.payload.startsWith('000201'));
  assert.ok(real.payload.includes('A000000677010111')); // PromptPay
  assert.ok(real.payload.includes('0066812345678')); // the phone number
  assert.ok(real.payload.includes(`54${String(PLAN.amount.toFixed(2).length).padStart(2, '0')}${PLAN.amount.toFixed(2)}`));
  if (saved === undefined) delete process.env.PROMPTPAY_ID;
  else process.env.PROMPTPAY_ID = saved;
});

test('premium page shows the plan and only students can open it', async () => {
  const mali = await login(ctx, 'mali@ait.ac.th');
  const r = await ctx.call('/api/premium', { token: mali.data.token });
  assert.equal(r.status, 200);
  assert.equal(r.data.plan.amount, PLAN.amount);
  assert.equal(r.data.isPremium, false);
  assert.match(r.data.qr, /^data:image\/png;base64,/);
  assert.deepEqual(r.data.payments, []);

  const owner = await login(ctx, 'owner@baansuan.example');
  assert.equal((await ctx.call('/api/premium', { token: owner.data.token })).status, 403);
});

test('slip upload checks the file', async () => {
  const { token } = await registerAndConfirm(ctx, { name: 'Bad Slip', email: 'badslip@ait.ac.th', password: 'password1' });
  assert.equal((await upload(token, 'not an image')).status, 400);
  assert.equal((await upload(token, 'data:text/html;base64,PGgxPg==')).status, 400);
  const huge = 'data:image/png;base64,' + 'A'.repeat(2_600_000);
  assert.equal((await upload(token, huge)).status, 400);
});

test('full flow: upload, admin approves, student becomes premium', async () => {
  const { token } = await registerAndConfirm(ctx, { name: 'Payer', email: 'payer@ait.ac.th', password: 'password1' });

  const r = await upload(token);
  assert.equal(r.status, 201);
  assert.equal(r.data.payment.status, 'pending');
  assert.equal(r.data.payment.amount, PLAN.amount);

  // Only one slip at a time.
  assert.equal((await upload(token)).status, 409);

  // Students cannot see the admin list or approve.
  assert.equal((await ctx.call('/api/admin/payments', { token })).status, 403);
  assert.equal((await ctx.call(`/api/admin/payments/${r.data.payment.id}/approve`, { method: 'PUT', token })).status, 403);

  const admin = await asAdmin();
  const list = await ctx.call('/api/admin/payments', { token: admin });
  const row = list.data.payments.find((p) => p.id === r.data.payment.id);
  assert.equal(row.user.name, 'Payer');
  assert.equal(row.slip, SLIP);

  const ok = await ctx.call(`/api/admin/payments/${row.id}/approve`, { method: 'PUT', token: admin });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.payment.status, 'approved');
  const days = (new Date(ok.data.premiumUntil) - Date.now()) / 86400000;
  assert.ok(days > PLAN.days - 1 && days <= PLAN.days);

  // Approving twice is refused.
  assert.equal((await ctx.call(`/api/admin/payments/${row.id}/approve`, { method: 'PUT', token: admin })).status, 409);

  const me = await ctx.call('/api/me', { token });
  assert.equal(me.data.user.premium, true);
  const page = await ctx.call('/api/premium', { token });
  assert.equal(page.data.isPremium, true);
  assert.equal(page.data.payments[0].status, 'approved');

  // Already premium: no new upload needed.
  assert.equal((await upload(token)).status, 400);

  const pendingNow = await ctx.call('/api/admin/payments', { token: admin });
  assert.equal(pendingNow.data.payments.some((p) => p.id === row.id), false);
  const approvedList = await ctx.call('/api/admin/payments?status=approved', { token: admin });
  assert.ok(approvedList.data.payments.some((p) => p.id === row.id));
});

test('rejected slip shows the reason and the student can try again', async () => {
  const { token } = await registerAndConfirm(ctx, { name: 'Blurry', email: 'blurry@ait.ac.th', password: 'password1' });
  const first = await upload(token);
  const admin = await asAdmin();

  const noReason = await ctx.call(`/api/admin/payments/${first.data.payment.id}/reject`, { method: 'PUT', token: admin, body: {} });
  assert.equal(noReason.status, 400);

  const rej = await ctx.call(`/api/admin/payments/${first.data.payment.id}/reject`, { method: 'PUT', token: admin, body: { reason: 'Slip is blurry' } });
  assert.equal(rej.status, 200);

  const page = await ctx.call('/api/premium', { token });
  assert.equal(page.data.isPremium, false);
  assert.equal(page.data.payments[0].status, 'rejected');
  assert.equal(page.data.payments[0].rejectReason, 'Slip is blurry');

  assert.equal((await upload(token)).status, 201);
  assert.equal((await ctx.call('/api/admin/payments/nope/approve', { method: 'PUT', token: admin })).status, 404);
});

test('free students see the top matches, premium students see all', async () => {
  // Add extra AIT students so there are more matches than the free limit.
  for (let i = 0; i < 4; i++) {
    const u = await db.users.create({ name: `Extra ${i}`, email: `extra${i}@ait.ac.th`, role: 'student', passwordHash: 'x', verified: true });
    await db.profiles.save(u.id, {
      cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2, culturalOpenness: 4,
      budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'male',
      genderPref: 'any', languages: ['Thai'], campus: 'AIT',
    });
  }
  const ken = await login(ctx, 'ken@ait.ac.th');
  const free = await ctx.call('/api/matches', { token: ken.data.token });
  assert.equal(free.data.matches.length, FREE_MATCH_LIMIT);
  assert.equal(free.data.limited, true);
  assert.ok(free.data.total > FREE_MATCH_LIMIT);

  const user = await db.users.findByEmail('ken@ait.ac.th');
  await db.users.update(user.id, { premiumUntil: new Date(Date.now() + 86400000).toISOString() });
  const paid = await ctx.call('/api/matches', { token: ken.data.token });
  assert.equal(paid.data.matches.length, paid.data.total);
  assert.equal(paid.data.limited, false);
});

test('premium ends after its end date', () => {
  assert.equal(isPremium({ premiumUntil: new Date(Date.now() - 1000).toISOString() }), false);
  assert.equal(isPremium({ premiumUntil: new Date(Date.now() + 1000).toISOString() }), true);
  assert.equal(isPremium({}), false);
});
