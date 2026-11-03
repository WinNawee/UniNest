// "Invite a friend": each student has a code. When a friend signs up with it
// and confirms their email, both get free Premium days.
import { randomInt } from 'node:crypto';
import { db } from './db/index.js';
import { APP_URL } from './env.js';
import { extendPremium } from './payments.js';

export const REFERRAL_DAYS = 7;
export const MAX_REWARDED_FRIENDS = 5; // the inviter earns at most 5 x 7 = 35 days


const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, easier to read

function randomCode() {
  return Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
}

// Older accounts have no code yet, so it is made the first time it is needed.
export async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  let code = randomCode();
  while ((await db.users.find({ referralCode: code })).length) code = randomCode();
  await db.users.update(user.id, { referralCode: code });
  return code;
}

// The student who owns this code, or null.
export async function findReferrer(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(clean)) return null;
  const [user] = await db.users.find({ referralCode: clean });
  return user && user.role === 'student' ? user : null;
}

// Called once, right after a referred student confirms their email.
export async function rewardReferral(newUser) {
  if (!newUser.referredBy || newUser.referralRewarded) return null;
  await db.users.update(newUser.id, { referralRewarded: true });
  await extendPremium(newUser, REFERRAL_DAYS);

  const referrer = await db.users.findById(newUser.referredBy);
  if (!referrer) return { friend: true, referrer: false };
  const rewarded = await db.users.find({ referredBy: referrer.id, referralRewarded: true });
  // "rewarded" already includes the new user, so this checks the limit after counting them.
  if (rewarded.length > MAX_REWARDED_FRIENDS) return { friend: true, referrer: false };
  await extendPremium(referrer, REFERRAL_DAYS);
  return { friend: true, referrer: true };
}

export function addReferralRoutes(app, { auth, requireRole }) {
  app.get('/api/referral', auth, requireRole('student'), async (req, res) => {
    const code = await ensureReferralCode(req.user);
    const invited = await db.users.find({ referredBy: req.user.id });
    const joined = invited.filter((u) => u.referralRewarded).length;
    res.json({
      code,
      link: `${APP_URL}/?ref=${code}`,
      rewardDays: REFERRAL_DAYS,
      maxFriends: MAX_REWARDED_FRIENDS,
      friendsJoined: joined,
      friendsWaiting: invited.length - joined, // signed up but not confirmed yet
      daysEarned: Math.min(joined, MAX_REWARDED_FRIENDS) * REFERRAL_DAYS,
    });
  });

  // Lets the sign-up page show "Invited by Mali".
  app.get('/api/referral/:code', async (req, res) => {
    const referrer = await findReferrer(req.params.code);
    if (!referrer) return res.status(404).json({ error: 'This invite code is not valid.' });
    res.json({ name: referrer.name.split(' ')[0], rewardDays: REFERRAL_DAYS });
  });
}
