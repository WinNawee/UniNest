// Demo accounts and listings. Added only when the database is empty,
// so restarting the server never creates duplicates.
import bcrypt from 'bcryptjs';
import { db } from './db/index.js';

export const DEMO_PASSWORD = 'demo1234';

const base = { cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2 };

const STUDENTS = [
  ['Mali', 'mali@ait.ac.th', { ...base, cleanliness: 5, budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 5, campus: 'AIT' }],
  ['Aisha', 'aisha@ait.ac.th', { ...base, sleep: 3, social: 4, budgetMin: 5000, budgetMax: 8000, smoking: 'no', food: 'halal', gender: 'female', genderPref: 'same', languages: ['English', 'Urdu'], culturalOpenness: 4, campus: 'AIT' }],
  ['Rin', 'rin@ait.ac.th', { ...base, cleanliness: 3, sleep: 5, noise: 4, social: 5, study: 4, guests: 4, budgetMin: 3500, budgetMax: 6000, smoking: 'outside', food: 'any_with_pork', gender: 'female', genderPref: 'any', languages: ['Thai', 'Japanese'], culturalOpenness: 5, campus: 'AIT' }],
  ['Ken', 'ken@ait.ac.th', { ...base, cleanliness: 3, sleep: 4, noise: 4, social: 4, study: 3, guests: 3, budgetMin: 4500, budgetMax: 7500, smoking: 'outside', food: 'any_with_pork', gender: 'male', genderPref: 'any', languages: ['English', 'Thai'], culturalOpenness: 4, campus: 'AIT' }],
  ['Anan', 'anan@ait.ac.th', { ...base, cleanliness: 4, sleep: 2, noise: 2, social: 2, budgetMin: 4000, budgetMax: 6500, smoking: 'no', food: 'vegetarian', gender: 'male', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 3, campus: 'AIT' }],
  ['Sara', 'sara@kmitl.ac.th', { ...base, budgetMin: 4000, budgetMax: 6000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'any', languages: ['Thai'], culturalOpenness: 3, campus: 'KMITL' }],
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

export async function seedIfEmpty() {
  if ((await db.users.count()) > 0) return false;

  for (const [name, email, profile] of STUDENTS) {
    const u = await demoUser(name, email, 'student');
    await db.profiles.save(u.id, profile);
  }

  // Platform admin who checks new listings.
  await demoUser('UniNest Admin', 'admin@uninest.example', 'admin');

  const landlord = await demoUser('Baan Suan Dorm', 'owner@baansuan.example', 'landlord');
  for (const room of ROOMS) await db.listings.create({ ...room, ownerId: landlord.id, verified: true });
  // One listing waiting for a check, so the admin page has something to show.
  await db.listings.create({
    title: 'New room awaiting check', type: 'dorm', price: 3900, beds: 2, distanceKm: 2.0,
    amenities: ['wifi'], campus: 'AIT', ownerId: landlord.id, verified: false,
  });
  return true;
}
