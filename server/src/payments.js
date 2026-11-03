// Two things can be paid for, both by PromptPay QR + transfer slip, checked by an admin:
//   - students: Semester Match Pass (Premium)
//   - landlords: Featured Listing (room shown first in Housing)
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { db } from './db/index.js';

export const PLAN = {
  id: 'semester_pass',
  name: 'Semester Match Pass',
  amount: Number(process.env.PREMIUM_PRICE) || 199, // THB
  days: 150, // about one semester
};

export const FEATURED_PLAN = {
  id: 'featured_30',
  name: 'Featured Listing',
  amount: Number(process.env.FEATURED_PRICE) || 99, // THB
  days: 30,
};

// Free students see this many matches. Premium students see all of them.
export const FREE_MATCH_LIMIT = 3;

// Real PromptPay number (10-digit phone or 13-digit ID) from .env.
// Without it, a clearly labelled test QR is shown and nobody should pay it.
const TEST_PROMPTPAY_ID = '0000000000';
const MAX_SLIP_LENGTH = 2_500_000; // about 1.8 MB image as a data URL
const SLIP_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const DAY = 24 * 3600 * 1000;

export const isPremium = (user) =>
  Boolean(user?.premiumUntil) && new Date(user.premiumUntil) > new Date();

export const isFeatured = (listing) =>
  Boolean(listing?.featuredUntil) && new Date(listing.featuredUntil) > new Date();

// Adds days to an end date. If the old end date is still in the future,
// the new days are added after it, so nobody loses time they already have.
export function extendDate(currentEnd, days) {
  const now = new Date();
  const start = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
  return new Date(start.getTime() + days * DAY).toISOString();
}

export async function extendPremium(user, days) {
  const premiumUntil = extendDate(user.premiumUntil, days);
  await db.users.update(user.id, { premiumUntil });
  return premiumUntil;
}

function promptPayId() {
  const id = String(process.env.PROMPTPAY_ID || '').replace(/[^0-9]/g, '');
  return id.length === 10 || id.length === 13 ? id : null;
}

export async function makeQr(amount = PLAN.amount) {
  const id = promptPayId();
  const payload = generatePayload(id || TEST_PROMPTPAY_ID, { amount });
  const image = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  return { image, payload, testMode: !id };
}

async function qrInfo(amount) {
  const qr = await makeQr(amount);
  return {
    qr: qr.image,
    testMode: qr.testMode,
    payTo: qr.testMode ? null : (process.env.PROMPTPAY_NAME || 'UniNest'),
  };
}

function checkSlip(slip) {
  if (!SLIP_PATTERN.test(slip)) return 'Please upload a photo of your slip (PNG, JPG or WebP).';
  if (slip.length > MAX_SLIP_LENGTH) return 'The slip image is too large. Please use a smaller photo.';
  return null;
}

// Older payments were made before "type" existed. They were all Premium.
const typeOf = (p) => p.type || 'premium';

// Payment as shown to the person who paid (the slip is not sent back each time).
const summary = (p) => ({
  id: p.id,
  type: typeOf(p),
  listingId: p.listingId || null,
  amount: p.amount,
  status: p.status,
  rejectReason: p.rejectReason || null,
  createdAt: p.createdAt,
  reviewedAt: p.reviewedAt || null,
});

export function addPaymentRoutes(app, { auth, requireRole, isAdmin }) {
  const adminOnly = (req, res, next) =>
    isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admin only' });

  // ---------- Student Premium ----------

  app.get('/api/premium', auth, requireRole('student'), async (req, res) => {
    const mine = (await db.payments.find({ userId: req.user.id })).filter((p) => typeOf(p) === 'premium');
    res.json({
      plan: PLAN,
      freeMatchLimit: FREE_MATCH_LIMIT,
      isPremium: isPremium(req.user),
      premiumUntil: req.user.premiumUntil || null,
      ...(await qrInfo(PLAN.amount)),
      payments: mine.map(summary),
    });
  });

  app.post('/api/premium/payments', auth, requireRole('student'), async (req, res) => {
    if (isPremium(req.user)) return res.status(400).json({ error: 'You already have Premium.' });
    const pending = await db.payments.find({ userId: req.user.id, status: 'pending' });
    if (pending.some((p) => typeOf(p) === 'premium')) {
      return res.status(409).json({ error: 'Your last slip is still being checked.' });
    }
    const slip = String(req.body?.slip || '');
    const problem = checkSlip(slip);
    if (problem) return res.status(400).json({ error: problem });

    const payment = await db.payments.create({
      userId: req.user.id, type: 'premium', plan: PLAN.id, amount: PLAN.amount, slip, status: 'pending',
    });
    res.status(201).json({ payment: summary(payment) });
  });

  // ---------- Landlord Featured Listing ----------

  async function ownListing(req, res) {
    const listing = await db.listings.get(req.params.listingId);
    if (!listing || listing.ownerId !== req.user.id) {
      res.status(404).json({ error: 'Listing not found' });
      return null;
    }
    return listing;
  }

  app.get('/api/featured/:listingId', auth, requireRole('landlord'), async (req, res) => {
    const listing = await ownListing(req, res);
    if (!listing) return;
    const mine = (await db.payments.find({ userId: req.user.id })).filter((p) => p.listingId === listing.id);
    res.json({
      plan: FEATURED_PLAN,
      listing: { id: listing.id, title: listing.title, verified: listing.verified, featuredUntil: isFeatured(listing) ? listing.featuredUntil : null },
      ...(await qrInfo(FEATURED_PLAN.amount)),
      payments: mine.map(summary),
    });
  });

  app.post('/api/featured/:listingId/payments', auth, requireRole('landlord'), async (req, res) => {
    const listing = await ownListing(req, res);
    if (!listing) return;
    if (!listing.verified) return res.status(400).json({ error: 'A room can be featured after our team has verified it.' });
    const pending = await db.payments.find({ userId: req.user.id, status: 'pending' });
    if (pending.some((p) => p.listingId === listing.id)) {
      return res.status(409).json({ error: 'The slip for this room is still being checked.' });
    }
    const slip = String(req.body?.slip || '');
    const problem = checkSlip(slip);
    if (problem) return res.status(400).json({ error: problem });

    const payment = await db.payments.create({
      userId: req.user.id, type: 'featured', listingId: listing.id,
      plan: FEATURED_PLAN.id, amount: FEATURED_PLAN.amount, slip, status: 'pending',
    });
    res.status(201).json({ payment: summary(payment) });
  });

  // ---------- Admin: check slips ----------

  // Newest first. ?status=pending|approved|rejected
  app.get('/api/admin/payments', auth, adminOnly, async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const rows = await db.payments.find({ status });
    const people = await db.users.findByIds([...new Set(rows.map((p) => p.userId))]);
    const byId = new Map(people.map((u) => [u.id, u]));
    const titles = new Map();
    for (const p of rows) {
      if (p.listingId && !titles.has(p.listingId)) titles.set(p.listingId, (await db.listings.get(p.listingId))?.title || 'Deleted room');
    }
    res.json({
      payments: rows.map((p) => ({
        ...summary(p),
        slip: p.slip,
        listingTitle: p.listingId ? titles.get(p.listingId) : null,
        user: byId.has(p.userId)
          ? { id: p.userId, name: byId.get(p.userId).name, email: byId.get(p.userId).email, role: byId.get(p.userId).role }
          : { id: p.userId, name: 'Deleted user', email: '', role: '' },
      })),
    });
  });

  app.put('/api/admin/payments/:id/approve', auth, adminOnly, async (req, res) => {
    const payment = await db.payments.get(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(409).json({ error: `This payment is already ${payment.status}.` });

    const result = {};
    if (typeOf(payment) === 'featured') {
      const listing = await db.listings.get(payment.listingId);
      if (!listing) return res.status(404).json({ error: 'Room not found' });
      result.featuredUntil = extendDate(listing.featuredUntil, FEATURED_PLAN.days);
      await db.listings.update(listing.id, { featuredUntil: result.featuredUntil });
    } else {
      const user = await db.users.findById(payment.userId);
      if (!user) return res.status(404).json({ error: 'Student not found' });
      result.premiumUntil = await extendPremium(user, PLAN.days);
    }
    const updated = await db.payments.update(payment.id, {
      status: 'approved',
      reviewedBy: req.user.id,
      reviewedAt: new Date().toISOString(),
    });
    res.json({ payment: summary(updated), ...result });
  });

  app.put('/api/admin/payments/:id/reject', auth, adminOnly, async (req, res) => {
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'Please give a reason so they know what to fix.' });
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
