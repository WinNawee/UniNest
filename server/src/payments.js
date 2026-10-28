// Semester Match Pass: pay by PromptPay QR, upload the transfer slip,
// an admin checks the slip and approves or rejects it.
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { db } from './db/index.js';

export const PLAN = {
  id: 'semester_pass',
  name: 'Semester Match Pass',
  amount: Number(process.env.PREMIUM_PRICE) || 199, // THB
  days: 150, // about one semester
};

// Free students see this many matches. Premium students see all of them.
export const FREE_MATCH_LIMIT = 3;

// Real PromptPay number (10-digit phone or 13-digit ID) from .env.
// Without it, a clearly labelled test QR is shown and nobody should pay it.
const TEST_PROMPTPAY_ID = '0000000000';
const MAX_SLIP_LENGTH = 2_500_000; // about 1.8 MB image as a data URL
const SLIP_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export const isPremium = (user) =>
  Boolean(user?.premiumUntil) && new Date(user.premiumUntil) > new Date();

function promptPayId() {
  const id = String(process.env.PROMPTPAY_ID || '').replace(/[^0-9]/g, '');
  return id.length === 10 || id.length === 13 ? id : null;
}

export async function makeQr() {
  const id = promptPayId();
  const payload = generatePayload(id || TEST_PROMPTPAY_ID, { amount: PLAN.amount });
  const image = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  return { image, payload, testMode: !id };
}

// Payment as shown to the student (no need to send the slip back each time).
const summary = (p) => ({
  id: p.id,
  amount: p.amount,
  status: p.status,
  rejectReason: p.rejectReason || null,
  createdAt: p.createdAt,
  reviewedAt: p.reviewedAt || null,
});

export function addPaymentRoutes(app, { auth, requireRole, isAdmin }) {
  const adminOnly = (req, res, next) =>
    isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admin only' });

  // Everything the Premium page needs.
  app.get('/api/premium', auth, requireRole('student'), async (req, res) => {
    const mine = await db.payments.find({ userId: req.user.id });
    const qr = await makeQr();
    res.json({
      plan: PLAN,
      freeMatchLimit: FREE_MATCH_LIMIT,
      isPremium: isPremium(req.user),
      premiumUntil: req.user.premiumUntil || null,
      payTo: qr.testMode ? null : (process.env.PROMPTPAY_NAME || 'UniNest'),
      qr: qr.image,
      testMode: qr.testMode,
      payments: mine.map(summary),
    });
  });

  // Student uploads the transfer slip.
  app.post('/api/premium/payments', auth, requireRole('student'), async (req, res) => {
    if (isPremium(req.user)) return res.status(400).json({ error: 'You already have Premium.' });
    const pending = await db.payments.find({ userId: req.user.id, status: 'pending' });
    if (pending.length) return res.status(409).json({ error: 'Your last slip is still being checked.' });

    const slip = String(req.body?.slip || '');
    if (!SLIP_PATTERN.test(slip)) return res.status(400).json({ error: 'Please upload a photo of your slip (PNG, JPG or WebP).' });
    if (slip.length > MAX_SLIP_LENGTH) return res.status(400).json({ error: 'The slip image is too large. Please use a smaller photo.' });

    const payment = await db.payments.create({
      userId: req.user.id,
      plan: PLAN.id,
      amount: PLAN.amount,
      slip,
      status: 'pending',
    });
    res.status(201).json({ payment: summary(payment) });
  });

  // Admin: slips to check (newest first). ?status=pending|approved|rejected
  app.get('/api/admin/payments', auth, adminOnly, async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const rows = await db.payments.find({ status });
    const people = await db.users.findByIds([...new Set(rows.map((p) => p.userId))]);
    const byId = new Map(people.map((u) => [u.id, u]));
    res.json({
      payments: rows.map((p) => ({
        ...summary(p),
        slip: p.slip,
        user: byId.has(p.userId)
          ? { id: p.userId, name: byId.get(p.userId).name, email: byId.get(p.userId).email }
          : { id: p.userId, name: 'Deleted user', email: '' },
      })),
    });
  });

  app.put('/api/admin/payments/:id/approve', auth, adminOnly, async (req, res) => {
    const payment = await db.payments.get(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(409).json({ error: `This payment is already ${payment.status}.` });

    const user = await db.users.findById(payment.userId);
    if (!user) return res.status(404).json({ error: 'Student not found' });
    // Start from today, or from the current end date if they still have Premium.
    const start = isPremium(user) ? new Date(user.premiumUntil) : new Date();
    const premiumUntil = new Date(start.getTime() + PLAN.days * 24 * 3600 * 1000).toISOString();

    await db.users.update(user.id, { premiumUntil });
    const updated = await db.payments.update(payment.id, {
      status: 'approved',
      reviewedBy: req.user.id,
      reviewedAt: new Date().toISOString(),
    });
    res.json({ payment: summary(updated), premiumUntil });
  });

  app.put('/api/admin/payments/:id/reject', auth, adminOnly, async (req, res) => {
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'Please give a reason so the student knows what to fix.' });
    const payment = await db.payments.get(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(409).json({ error: `This payment is already ${payment.status}.` });

    const updated = await db.payments.update(payment.id, {
      status: 'rejected',
      rejectReason: reason,
      reviewedBy: req.user.id,
      reviewedAt: new Date().toISOString(),
    });
    res.json({ payment: summary(updated) });
  });
}
