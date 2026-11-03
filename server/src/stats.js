// Business dashboard for the admin: the numbers an e-business tracks.
// By default demo accounts are left out, so the numbers show real pilot users.
import { db } from './db/index.js';
import { isPremium, isFeatured } from './payments.js';
import { DEMO_EMAILS } from './seed.js';

const DAY = 24 * 3600 * 1000;
const TIMEZONE = 'Asia/Bangkok';

// "2026-11-03" in Thailand time.
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
const percent = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export function addStatsRoutes(app, { auth, isAdmin }) {
  app.get('/api/admin/stats', auth, async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    const includeDemo = req.query.includeDemo === '1';

    const allUsers = await db.users.all();
    const users = includeDemo ? allUsers : allUsers.filter((u) => !DEMO_EMAILS.has(u.email));
    const ids = new Set(users.map((u) => u.id));
    const students = users.filter((u) => u.role === 'student');
    const landlords = users.filter((u) => u.role === 'landlord');

    const profiles = new Set((await db.profiles.all()).map((p) => p.userId));
    const senders = new Set(await db.messages.senders());
    const payments = (await db.payments.find()).filter((p) => ids.has(p.userId));
    const approved = payments.filter((p) => p.status === 'approved');
    const premiumPaid = approved.filter((p) => (p.type || 'premium') === 'premium');
    const featuredPaid = approved.filter((p) => p.type === 'featured');
    const paidStudents = new Set(premiumPaid.map((p) => p.userId));

    const listings = (await db.listings.find()).filter((l) => ids.has(l.ownerId));
    const reviews = (await db.reviews.find()).filter((r) => ids.has(r.authorId));

    // The student journey, step by step.
    const confirmed = students.filter((u) => u.verified);
    const withProfile = confirmed.filter((u) => profiles.has(u.id));
    const chatted = withProfile.filter((u) => senders.has(u.id));
    const paid = students.filter((u) => paidStudents.has(u.id));
    const steps = [
      ['Signed up', students.length],
      ['Confirmed email', confirmed.length],
      ['Completed profile', withProfile.length],
      ['Started a chat', chatted.length],
      ['Paid for Premium', paid.length],
    ];
    const funnel = steps.map(([label, count], i) => ({
      label,
      count,
      ofSignups: percent(count, students.length),
      fromPrevious: i === 0 ? 100 : percent(count, steps[i - 1][1]),
    }));

    // Sign-ups per day for the last 14 days (Thailand time).
    const signups = [];
    for (let i = 13; i >= 0; i--) {
      const key = dayKey(new Date(Date.now() - i * DAY).toISOString());
      signups.push({ day: key, count: 0 });
    }
    const byDay = new Map(signups.map((d) => [d.day, d]));
    for (const u of users) if (u.createdAt && byDay.has(dayKey(u.createdAt))) byDay.get(dayKey(u.createdAt)).count += 1;

    const sum = (rows) => rows.reduce((s, p) => s + (p.amount || 0), 0);
    res.json({
      includeDemo,
      users: { students: students.length, landlords: landlords.length, premiumNow: students.filter(isPremium).length },
      funnel,
      revenue: {
        total: sum(approved),
        premium: sum(premiumPaid),
        featured: sum(featuredPaid),
        premiumCount: premiumPaid.length,
        featuredCount: featuredPaid.length,
        pendingSlips: payments.filter((p) => p.status === 'pending').length,
      },
      conversionRate: percent(paid.length, students.length), // students who paid
      listings: {
        total: listings.length,
        verified: listings.filter((l) => l.verified).length,
        waiting: listings.filter((l) => !l.verified).length,
        featuredNow: listings.filter(isFeatured).length,
      },
      reviews: {
        count: reviews.length,
        average: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null,
      },
      referrals: { friendsJoined: students.filter((u) => u.referralRewarded).length },
      signups,
    });
  });
}
