import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db/index.js';
import { createMailer } from './mailer.js';
import { rankMatches, scorePair, isEligible, validateProfile } from './matching.js';
import { addPaymentRoutes, isPremium, FREE_MATCH_LIMIT } from './payments.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@uninest.example')
  .split(',')
  .map((s) => s.trim().toLowerCase());

// Where the confirmation link in the email points to (the web app).
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const VERIFY_LINK_HOURS = 24;
const RESEND_WAIT_SECONDS = 60;

// Student sign-up needs a university address. Known domains are listed here,
// and anything ending in .edu or .ac.xx is accepted too.
const EXTRA_DOMAINS = (process.env.UNI_DOMAINS || 'ait.asia')
  .split(',')
  .map((s) => s.trim().toLowerCase());

export function isUniversityEmail(email) {
  const m = /^[^@\s]+@([^@\s]+)$/.exec(String(email).toLowerCase());
  if (!m) return false;
  const domain = m[1];
  return (
    /\.edu$/.test(domain) ||
    /\.ac\.[a-z]{2}$/.test(domain) ||
    EXTRA_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))
  );
}

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// Returns the user for a login token, or null.
export async function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  return db.users.findById(payload.sub);
}

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  verified: u.verified,
  premium: isPremium(u),
  premiumUntil: isPremium(u) ? u.premiumUntil : null,
});

// Email confirmation tokens: the link carries the raw token, the database only
// keeps its SHA-256 hash, so a leaked database cannot be used to confirm accounts.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function newVerifyToken() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    fields: {
      verifyTokenHash: hashToken(token),
      verifyTokenExpires: new Date(Date.now() + VERIFY_LINK_HOURS * 3600 * 1000).toISOString(),
      verifyTokenSentAt: new Date().toISOString(),
    },
  };
}

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  let user;
  try {
    user = await verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (!user) return res.status(401).json({ error: 'Unknown user' });
  req.user = user;
  next();
}

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: `Requires ${role}` });

const isAdmin = (user) => user.role === 'admin' || ADMIN_EMAILS.includes(user.email);

// onMessage is called whenever a message is saved through REST, so the socket
// layer can push it live to both people.
// mailer can be swapped out in the tests.
export function buildApp({ onMessage = () => {}, mailer = createMailer() } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '3mb' })); // room for a payment slip photo

  // Without real email set up (and outside production), the API also returns
  // the confirmation link so the app can be used on a laptop.
  const showDevLink = (result) => !result.delivered && process.env.NODE_ENV !== 'production';

  async function sendVerifyEmail(user, token) {
    const link = `${APP_URL}/verify-email?token=${token}`;
    try {
      const result = await mailer.sendVerification({ to: user.email, name: user.name, link });
      return { emailSent: result.delivered, devVerifyUrl: showDevLink(result) ? link : undefined };
    } catch (err) {
      console.error('Could not send confirmation email:', err.message);
      return { emailSent: false };
    }
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, store: db.name }));

  // ---------- Auth ----------
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role = 'student' } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!['student', 'landlord'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (role === 'student' && !isUniversityEmail(email)) {
      return res.status(400).json({ error: 'Students must register with a university email (.edu, .ac.xx or a listed domain)' });
    }
    if (await db.users.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

    const { token, fields } = newVerifyToken();
    const user = await db.users.create({
      name: String(name).trim(),
      email,
      role,
      passwordHash: bcrypt.hashSync(String(password), 8),
      verified: false,
      ...fields,
    });
    const mail = await sendVerifyEmail(user, token);
    // No login token yet: the account works only after the email is confirmed.
    res.status(201).json({
      message: mail.emailSent
        ? `We sent a confirmation link to ${user.email}.`
        : 'Account created. Please confirm your email to log in.',
      email: user.email,
      ...mail,
    });
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const token = String(req.body?.token || '');
    const user = token && (await db.users.findByVerifyTokenHash(hashToken(token)));
    if (!user) return res.status(400).json({ error: 'This link is invalid or has already been used.' });
    if (new Date(user.verifyTokenExpires) < new Date()) {
      return res.status(400).json({ error: 'This link has expired. Please ask for a new one.', expired: true, email: user.email });
    }
    const updated = await db.users.update(user.id, {
      verified: true,
      verifyTokenHash: null,
      verifyTokenExpires: null,
    });
    // Confirming also logs the person in.
    res.json({ token: signToken(updated), user: publicUser(updated) });
  });

  app.post('/api/auth/resend-verification', async (req, res) => {
    const email = String(req.body?.email || '');
    const user = email && (await db.users.findByEmail(email));
    // Same answer whether or not the account exists, so this cannot be used
    // to find out who has an account.
    const generic = { message: 'If that account is waiting for confirmation, a new link is on its way.' };
    if (!user || user.verified) return res.json(generic);

    const waited = (Date.now() - new Date(user.verifyTokenSentAt || 0)) / 1000;
    if (waited < RESEND_WAIT_SECONDS) {
      return res.status(429).json({ error: `Please wait ${Math.ceil(RESEND_WAIT_SECONDS - waited)} seconds before asking again.` });
    }
    const { token, fields } = newVerifyToken();
    const updated = await db.users.update(user.id, fields);
    const mail = await sendVerifyEmail(updated, token);
    res.json({ ...generic, ...mail });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = email && (await db.users.findByEmail(email));
    if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    if (!user.verified) {
      return res.status(403).json({
        error: 'Please confirm your email first. Check your inbox for the link.',
        needsVerification: true,
        email: user.email,
      });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  app.get('/api/me', auth, async (req, res) => {
    res.json({
      user: publicUser(req.user),
      profile: await db.profiles.get(req.user.id),
      isAdmin: isAdmin(req.user),
    });
  });

  // ---------- Questionnaire ----------
  app.put('/api/me/profile', auth, requireRole('student'), async (req, res) => {
    const { profile, errors } = validateProfile(req.body || {});
    if (errors.length) return res.status(400).json({ errors });
    res.json({ profile: await db.profiles.save(req.user.id, profile) });
  });

  // ---------- Matching ----------
  app.get('/api/matches', auth, requireRole('student'), async (req, res) => {
    const me = await db.profiles.get(req.user.id);
    if (!me) return res.status(400).json({ error: 'Complete the questionnaire first' });
    const all = await db.profiles.all();
    const ranked = rankMatches(me, all);
    const people = await db.users.findByIds(ranked.map((m) => m.userId));
    const personOf = new Map(people.map((u) => [u.id, u]));
    const campusOf = new Map(all.map((p) => [p.userId, p.campus]));
    const matches = ranked
      .filter((m) => personOf.has(m.userId))
      .map((m) => ({
        ...m,
        name: personOf.get(m.userId).name,
        campus: campusOf.get(m.userId),
        premium: isPremium(personOf.get(m.userId)),
      }));
    // Free students see the best few matches, Premium students see all.
    const premium = isPremium(req.user);
    res.json({
      matches: premium ? matches : matches.slice(0, FREE_MATCH_LIMIT),
      total: matches.length,
      limited: !premium && matches.length > FREE_MATCH_LIMIT,
    });
  });

  app.get('/api/matches/:userId', auth, requireRole('student'), async (req, res) => {
    const me = await db.profiles.get(req.user.id);
    const other = await db.profiles.get(req.params.userId);
    if (!me || !other) return res.status(404).json({ error: 'Profile not found' });
    if (!isEligible(me, other)) return res.status(403).json({ error: 'Not a possible match' });
    const person = await db.users.findById(other.userId);
    res.json({ userId: other.userId, name: person?.name, ...scorePair(me, other) });
  });

  // ---------- Listings ----------
  app.get('/api/listings', auth, async (req, res) => {
    const { maxPrice, type, campus, maxDistance } = req.query;
    let rows = await db.listings.find({ verified: true });
    if (maxPrice) rows = rows.filter((l) => l.price <= Number(maxPrice));
    if (type) rows = rows.filter((l) => l.type === type);
    if (campus) rows = rows.filter((l) => l.campus === campus);
    if (maxDistance) rows = rows.filter((l) => l.distanceKm <= Number(maxDistance));
    res.json({ listings: rows.sort((a, b) => a.price - b.price) });
  });

  app.post('/api/listings', auth, requireRole('landlord'), async (req, res) => {
    const { title, type, price, beds, distanceKm, amenities = [], campus = '' } = req.body || {};
    if (!title || !['dorm', 'condo', 'apartment'].includes(type) || !(price > 0) || !(beds > 0)) {
      return res.status(400).json({ error: 'title, type (dorm|condo|apartment), price and beds are required' });
    }
    // New listings wait for a team check before students can see them.
    const listing = await db.listings.create({
      title: String(title),
      type,
      price: Number(price),
      beds: Number(beds),
      distanceKm: Number(distanceKm) || 0,
      amenities: Array.isArray(amenities) ? amenities.map(String) : [],
      campus: String(campus),
      ownerId: req.user.id,
      verified: false,
    });
    res.status(201).json({ listing });
  });

  app.get('/api/listings/mine', auth, requireRole('landlord'), async (req, res) => {
    res.json({ listings: await db.listings.find({ ownerId: req.user.id }) });
  });

  app.get('/api/admin/listings/pending', auth, async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    res.json({ listings: await db.listings.find({ verified: false }) });
  });

  app.put('/api/admin/listings/:id/verify', auth, async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const listing = await db.listings.update(req.params.id, { verified: true });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ listing });
  });

  // ---------- Two-way reviews ----------
  app.post('/api/listings/:id/reviews', auth, async (req, res) => {
    const listing = await db.listings.get(req.params.id);
    if (!listing || !listing.verified) return res.status(404).json({ error: 'Listing not found' });
    const { rating, text = '' } = req.body || {};
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'rating must be 1-5' });
    await db.reviews.create({ listingId: listing.id, authorId: req.user.id, rating: Number(rating), text: String(text).slice(0, 500) });
    res.status(201).json({ ok: true });
  });

  app.get('/api/listings/:id/reviews', auth, async (req, res) => {
    const rows = await db.reviews.forListing(req.params.id);
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    res.json({ average: avg, reviews: rows });
  });

  // ---------- Chat ----------
  // Live delivery goes through Socket.IO. These REST routes give the history,
  // the inbox, and a fallback way to send when the socket cannot connect.

  // Inbox: one row per conversation partner, newest first.
  app.get('/api/chats', auth, async (req, res) => {
    const me = req.user.id;
    const byPartner = new Map();
    for (const m of await db.messages.forUser(me)) {
      const partner = m.from === me ? m.to : m.from;
      const row = byPartner.get(partner) || { userId: partner, unread: 0, last: null };
      row.last = m;
      if (m.to === me && !m.read) row.unread += 1;
      byPartner.set(partner, row);
    }
    const people = await db.users.findByIds([...byPartner.keys()]);
    const nameOf = new Map(people.map((u) => [u.id, u.name]));
    const chats = [...byPartner.values()]
      .filter((r) => nameOf.has(r.userId))
      .map((r) => ({ ...r, name: nameOf.get(r.userId) }))
      .sort((x, y) => y.last.at.localeCompare(x.last.at));
    res.json({ chats, unread: chats.reduce((s, c) => s + c.unread, 0) });
  });

  // History with one person. Opening it marks their messages to me as read.
  app.get('/api/chats/:userId', auth, async (req, res) => {
    const partner = await db.users.findById(req.params.userId);
    if (!partner) return res.status(404).json({ error: 'User not found' });
    await db.messages.markRead(partner.id, req.user.id);
    const rows = await db.messages.between(req.user.id, partner.id);
    res.json({ partner: { id: partner.id, name: partner.name, role: partner.role }, messages: rows });
  });

  app.post('/api/chats/:userId', auth, async (req, res) => {
    const to = req.params.userId;
    const text = String(req.body?.text || '').trim();
    if (to === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });
    if (!(await db.users.findById(to))) return res.status(404).json({ error: 'User not found' });
    if (!text) return res.status(400).json({ error: 'text required' });
    const msg = await saveMessage(req.user.id, to, text);
    onMessage(msg);
    res.status(201).json({ message: msg });
  });

  // ---------- Premium (PromptPay slip check) ----------
  addPaymentRoutes(app, { auth, requireRole, isAdmin });

  // Any unexpected error (for example the database being unreachable).
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'That file is too large. Please use a smaller photo.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return app;
}

export function saveMessage(from, to, text) {
  return db.messages.create({ from, to, text: String(text).slice(0, 1000) });
}
