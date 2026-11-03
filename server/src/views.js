// "Who viewed my profile": a view is recorded when a student opens
// "Why this match?" on someone. Free students see how many people viewed
// them, Premium students see who.
import { db } from './db/index.js';
import { isPremium } from './payments.js';

const DAY = 24 * 3600 * 1000;
const SHOW_DAYS = 30; // views older than this are not shown

export function addViewRoutes(app, { auth, requireRole }) {
  app.post('/api/profile-views/:userId', auth, requireRole('student'), async (req, res) => {
    const target = await db.users.findById(req.params.userId);
    if (!target || target.role !== 'student') return res.status(404).json({ error: 'Student not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'That is you.' });
    await db.views.record(req.user.id, target.id);
    res.json({ ok: true });
  });

  app.get('/api/profile-views', auth, requireRole('student'), async (req, res) => {
    const since = Date.now() - SHOW_DAYS * DAY;
    const rows = (await db.views.forViewed(req.user.id)).filter((v) => new Date(v.at).getTime() >= since);
    const thisWeek = rows.filter((v) => new Date(v.at).getTime() >= Date.now() - 7 * DAY).length;
    const premium = isPremium(req.user);

    let viewers = [];
    if (premium) {
      const people = await db.users.findByIds(rows.map((v) => v.viewerId));
      const nameOf = new Map(people.map((u) => [u.id, u.name]));
      viewers = rows
        .filter((v) => nameOf.has(v.viewerId))
        .map((v) => ({ userId: v.viewerId, name: nameOf.get(v.viewerId), at: v.at }));
    }
    res.json({ count: rows.length, thisWeek, days: SHOW_DAYS, locked: !premium, viewers });
  });
}
