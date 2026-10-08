import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  users, profiles, listings, messages, reviews,
  createUser, findUserByEmail, publicUser, addListing,
} from './store.js';
import { rankMatches, scorePair, isEligible, validateProfile } from './matching.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@uninest.example')
  .split(',')
  .map((s) => s.trim().toLowerCase());

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

export function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  return users.get(payload.sub) || null;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Unknown user' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: `Requires ${role}` });

const isAdmin = (user) => user.role === 'admin' || ADMIN_EMAILS.includes(user.email);

// onMessage is called whenever a message is saved through REST, so the socket
// layer can push it live to both people.
export function buildApp({ onMessage = () => {} } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ---------- Auth ----------
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role = 'student' } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!['student', 'landlord'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (role === 'student' && !isUniversityEmail(email)) {
      return res.status(400).json({ error: 'Students must register with a university email (.edu, .ac.xx or a listed domain)' });
    }
    if (findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    // Student emails count as verified by domain. A real build would also send a confirmation link.
    const user = createUser({ name, email, password, role, verified: role === 'student' });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = email && findUserByEmail(email);
    if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  });

  app.get('/api/me', auth, (req, res) => {
    res.json({
      user: publicUser(req.user),
      profile: profiles.get(req.user.id) || null,
      isAdmin: isAdmin(req.user),
    });
  });

  // ---------- Questionnaire ----------
  app.put('/api/me/profile', auth, requireRole('student'), (req, res) => {
    const { profile, errors } = validateProfile(req.body || {});
    if (errors.length) return res.status(400).json({ errors });
    const saved = { userId: req.user.id, ...profile };
    profiles.set(req.user.id, saved);
    res.json({ profile: saved });
  });

  // ---------- Matching ----------
  app.get('/api/matches', auth, requireRole('student'), (req, res) => {
    const me = profiles.get(req.user.id);
    if (!me) return res.status(400).json({ error: 'Complete the questionnaire first' });
    const ranked = rankMatches(me, [...profiles.values()]);
    res.json({
      matches: ranked.map((m) => ({ ...m, name: users.get(m.userId).name, campus: profiles.get(m.userId).campus })),
    });
  });

  app.get('/api/matches/:userId', auth, requireRole('student'), (req, res) => {
    const me = profiles.get(req.user.id);
    const other = profiles.get(req.params.userId);
    if (!me || !other) return res.status(404).json({ error: 'Profile not found' });
    if (!isEligible(me, other)) return res.status(403).json({ error: 'Not a possible match' });
    res.json({ userId: other.userId, name: users.get(other.userId).name, ...scorePair(me, other) });
  });

  // ---------- Listings ----------
  app.get('/api/listings', auth, (req, res) => {
    const { maxPrice, type, campus, maxDistance } = req.query;
    let rows = [...listings.values()].filter((l) => l.verified);
    if (maxPrice) rows = rows.filter((l) => l.price <= Number(maxPrice));
    if (type) rows = rows.filter((l) => l.type === type);
    if (campus) rows = rows.filter((l) => l.campus === campus);
    if (maxDistance) rows = rows.filter((l) => l.distanceKm <= Number(maxDistance));
    res.json({ listings: rows.sort((a, b) => a.price - b.price) });
  });

  app.post('/api/listings', auth, requireRole('landlord'), (req, res) => {
    const { title, type, price, beds, distanceKm, amenities = [], campus = '' } = req.body || {};
    if (!title || !['dorm', 'condo', 'apartment'].includes(type) || !(price > 0) || !(beds > 0)) {
      return res.status(400).json({ error: 'title, type (dorm|condo|apartment), price and beds are required' });
    }
    // New listings wait for a team check before students can see them.
    const l = addListing({ title, type, price: Number(price), beds: Number(beds), distanceKm: Number(distanceKm) || 0, amenities, campus }, req.user.id, false);
    res.status(201).json({ listing: l });
  });

  app.get('/api/listings/mine', auth, requireRole('landlord'), (req, res) => {
    res.json({ listings: [...listings.values()].filter((l) => l.ownerId === req.user.id) });
  });

  app.get('/api/admin/listings/pending', auth, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    res.json({ listings: [...listings.values()].filter((l) => !l.verified) });
  });

  app.put('/api/admin/listings/:id/verify', auth, (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const l = listings.get(req.params.id);
    if (!l) return res.status(404).json({ error: 'Listing not found' });
    l.verified = true;
    res.json({ listing: l });
  });

  // ---------- Two-way reviews ----------
  app.post('/api/listings/:id/reviews', auth, (req, res) => {
    const l = listings.get(req.params.id);
    if (!l || !l.verified) return res.status(404).json({ error: 'Listing not found' });
    const { rating, text = '' } = req.body || {};
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'rating must be 1-5' });
    reviews.push({ id: randomUUID(), listingId: l.id, authorId: req.user.id, rating: Number(rating), text: String(text).slice(0, 500), at: new Date().toISOString() });
    res.status(201).json({ ok: true });
  });

  app.get('/api/listings/:id/reviews', auth, (req, res) => {
    const rows = reviews.filter((r) => r.listingId === req.params.id);
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    res.json({ average: avg, reviews: rows });
  });

  // ---------- Chat ----------
  // Live delivery goes through Socket.IO. These REST routes give the history,
  // the inbox, and a fallback way to send when the socket cannot connect.

  // Inbox: one row per conversation partner, newest first.
  app.get('/api/chats', auth, (req, res) => {
    const me = req.user.id;
    const byPartner = new Map();
    for (const m of messages) {
      if (m.from !== me && m.to !== me) continue;
      const partner = m.from === me ? m.to : m.from;
      const row = byPartner.get(partner) || { userId: partner, unread: 0, last: null };
      row.last = m;
      if (m.to === me && !m.read) row.unread += 1;
      byPartner.set(partner, row);
    }
    const chats = [...byPartner.values()]
      .filter((r) => users.has(r.userId))
      .map((r) => ({ ...r, name: users.get(r.userId).name }))
      .sort((x, y) => y.last.at.localeCompare(x.last.at));
    res.json({ chats, unread: chats.reduce((s, c) => s + c.unread, 0) });
  });

  // History with one person. Opening it marks their messages to me as read.
  app.get('/api/chats/:userId', auth, (req, res) => {
    const a = req.user.id;
    const b = req.params.userId;
    const partner = users.get(b);
    if (!partner) return res.status(404).json({ error: 'User not found' });
    const rows = messages.filter((m) => (m.from === a && m.to === b) || (m.from === b && m.to === a));
    for (const m of rows) if (m.to === a) m.read = true;
    res.json({ partner: { id: partner.id, name: partner.name, role: partner.role }, messages: rows });
  });

  app.post('/api/chats/:userId', auth, (req, res) => {
    const to = req.params.userId;
    const text = String(req.body?.text || '').trim();
    if (!users.has(to)) return res.status(404).json({ error: 'User not found' });
    if (to === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });
    if (!text) return res.status(400).json({ error: 'text required' });
    const msg = saveMessage(req.user.id, to, text);
    onMessage(msg);
    res.status(201).json({ message: msg });
  });

  return app;
}

export function saveMessage(from, to, text) {
  const m = { id: randomUUID(), from, to, text: String(text).slice(0, 1000), at: new Date().toISOString(), read: false };
  messages.push(m);
  return m;
}
