// Demo accounts and listings. Added only when the database is empty,
// so restarting the server never creates duplicates.
import bcrypt from 'bcryptjs';
import { db } from './db/index.js';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ADMIN_EMAIL = 'admin@uninest.example';
export const DEMO_LANDLORD_EMAIL = 'owner@baansuan.example';

const base = { cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2 };

const STUDENTS = [
  ['Mali', 'mali@ait.ac.th', { ...base, cleanliness: 5, budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 5, campus: 'AIT' }],
  ['Aisha', 'aisha@ait.ac.th', { ...base, sleep: 3, social: 4, budgetMin: 5000, budgetMax: 8000, smoking: 'no', food: 'halal', gender: 'female', genderPref: 'same', languages: ['English', 'Urdu'], culturalOpenness: 4, campus: 'AIT' }],
  ['Rin', 'rin@ait.ac.th', { ...base, cleanliness: 3, sleep: 5, noise: 4, social: 5, study: 4, guests: 4, budgetMin: 3500, budgetMax: 6000, smoking: 'outside', food: 'any_with_pork', gender: 'female', genderPref: 'any', languages: ['Thai', 'Japanese'], culturalOpenness: 5, campus: 'AIT' }],
  ['Ken', 'ken@ait.ac.th', { ...base, cleanliness: 3, sleep: 4, noise: 4, social: 4, study: 3, guests: 3, budgetMin: 4500, budgetMax: 7500, smoking: 'outside', food: 'any_with_pork', gender: 'male', genderPref: 'any', languages: ['English', 'Thai'], culturalOpenness: 4, campus: 'AIT' }],
  ['Anan', 'anan@ait.ac.th', { ...base, cleanliness: 4, sleep: 2, noise: 2, social: 2, budgetMin: 4000, budgetMax: 6500, smoking: 'no', food: 'vegetarian', gender: 'male', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 3, campus: 'AIT' }],
  ['Sara', 'sara@kmitl.ac.th', { ...base, budgetMin: 4000, budgetMax: 6000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'any', languages: ['Thai'], culturalOpenness: 3, campus: 'KMITL' }],
];

// Added later. These are also added to an existing database if missing,
// so Mali has more than 3 matches and the free limit is visible in demos.
const EXTRA_STUDENTS = [
  ['Ploy', 'ploy.demo@ait.ac.th', { ...base, cleanliness: 5, sleep: 2, budgetMin: 4500, budgetMax: 7500, smoking: 'no', food: 'any', gender: 'female', genderPref: 'any', languages: ['Thai', 'English'], culturalOpenness: 4, campus: 'AIT' }],
  ['Nina', 'nina.demo@ait.ac.th', { ...base, cleanliness: 4, sleep: 3, social: 4, budgetMin: 3500, budgetMax: 6000, smoking: 'no', food: 'vegetarian', gender: 'female', genderPref: 'any', languages: ['English', 'Nepali'], culturalOpenness: 5, campus: 'AIT' }],
  ['Hana', 'hana.demo@ait.ac.th', { ...base, cleanliness: 3, sleep: 4, noise: 3, budgetMin: 5000, budgetMax: 9000, smoking: 'outside', food: 'any', gender: 'female', genderPref: 'any', languages: ['English', 'Japanese'], culturalOpenness: 4, campus: 'AIT' }],
];

const ROOMS = [
  { title: 'Twin room near AIT main gate', type: 'dorm', price: 4500, beds: 2, distanceKm: 0.6, amenities: ['aircon', 'wifi', 'laundry'], campus: 'AIT' },
  { title: 'Studio condo, Rangsit', type: 'condo', price: 8500, beds: 2, distanceKm: 3.2, amenities: ['aircon', 'wifi', 'pool', 'gym'], campus: 'AIT' },
  { title: 'Budget fan room', type: 'dorm', price: 2800, beds: 1, distanceKm: 1.1, amenities: ['fan', 'wifi'], campus: 'AIT' },
  { title: 'Two-bedroom apartment near KMITL', type: 'apartment', price: 9000, beds: 3, distanceKm: 0.9, amenities: ['aircon', 'wifi', 'kitchen'], campus: 'KMITL' },
];

function demoUser(name, email, role) {
  // Demo accounts are already confirmed so you can log in straight away.
  return db.users.create({ name, email, role, passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 8), verified: true });
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();

// Adds any demo student from the list that is not in the database yet.
async function addMissingStudents(list) {
  let added = 0;
  for (const [name, email, profile] of list) {
    if (await db.users.findByEmail(email)) continue;
    const u = await demoUser(name, email, 'student');
    await db.profiles.save(u.id, profile);
    added += 1;
  }
  return added;
}

// For databases created before the extra demo students existed.
export async function addDemoExtras() {
  return addMissingStudents(EXTRA_STUDENTS);
}

export async function seedIfEmpty() {
  if ((await db.users.count()) > 0) return false;

  await addMissingStudents([...STUDENTS, ...EXTRA_STUDENTS]);

  // Platform admin who checks new listings.
  await demoUser('UniNest Admin', DEMO_ADMIN_EMAIL, 'admin');

  const landlord = await demoUser('Baan Suan Dorm', DEMO_LANDLORD_EMAIL, 'landlord');
  const rooms = [];
  for (const room of ROOMS) {
    rooms.push(await db.listings.create({ ...room, ownerId: landlord.id, verified: true, verifiedAt: daysAgo(7) }));
  }
  // One paid Featured Listing, so the badge and ordering show in demos.
  await db.listings.update(rooms[0].id, { featuredUntil: daysAhead(30) });
  // A few reviews, so ratings show in demos.
  const aisha = await db.users.findByEmail('aisha@ait.ac.th');
  const rin = await db.users.findByEmail('rin@ait.ac.th');
  await db.reviews.create({ listingId: rooms[0].id, authorId: aisha.id, rating: 5, text: 'Clean room and a very kind owner. Short walk to class.' });
  await db.reviews.create({ listingId: rooms[0].id, authorId: rin.id, rating: 4, text: 'Good value. Wifi can be slow in the evening.' });
  await db.reviews.create({ listingId: rooms[1].id, authorId: rin.id, rating: 4, text: 'Nice pool and gym, but you need a motorbike or Grab.' });
  // One listing waiting for a check, so the admin page has something to show.
  await db.listings.create({
    title: 'New room awaiting check', type: 'dorm', price: 3900, beds: 2, distanceKm: 2.0,
    amenities: ['wifi'], campus: 'AIT', ownerId: landlord.id, verified: false,
  });
  return true;
}

// Emails of all demo accounts, so the dashboard can leave them out
// and show only real pilot users.
export const DEMO_EMAILS = new Set([
  ...STUDENTS.map(([, email]) => email),
  ...EXTRA_STUDENTS.map(([, email]) => email),
  DEMO_ADMIN_EMAIL,
  DEMO_LANDLORD_EMAIL,
]);

// The demo password is public on GitHub, so on the live site
// (NODE_ENV=production) demo students and the demo landlord are switched off:
// they cannot log in and are hidden from real students' matches.
// Set DEMO_ACCOUNTS=on to allow them anyway, for example on presentation day.
export const demoAccountsOff = () =>
  process.env.NODE_ENV === 'production' && process.env.DEMO_ACCOUNTS !== 'on';

// The admin is not counted here: on the live site it keeps working, with its own password.
export const isDemoAccount = (user) =>
  Boolean(user) && DEMO_EMAILS.has(user.email) && user.email !== DEMO_ADMIN_EMAIL;

// On the live site the admin password comes from ADMIN_PASSWORD in .env
// instead of the public demo password. Returns true if it was changed.
export async function applyAdminPassword(password) {
  const admin = await db.users.findByEmail(DEMO_ADMIN_EMAIL);
  if (!admin || bcrypt.compareSync(password, admin.passwordHash)) return false;
  await db.users.update(admin.id, { passwordHash: bcrypt.hashSync(password, 10) });
  return true;
}
