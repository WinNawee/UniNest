// In-memory data store with seed data.
// This is a stand-in for MongoDB Atlas. Every function here is the only place
// that touches data, so swapping to Mongoose later means changing this file only.
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

export const users = new Map(); // id -> { id, name, email, role, passwordHash, verified }
export const profiles = new Map(); // userId -> questionnaire profile
export const listings = new Map(); // id -> listing
export const messages = []; // { id, from, to, text, at }
export const reviews = []; // { id, listingId, authorId, rating, text, at }

const DEMO_PASSWORD = 'demo1234';

export function createUser({ name, email, role = 'student', password, verified = false }) {
  const id = randomUUID();
  const user = {
    id,
    name,
    email: email.toLowerCase(),
    role,
    verified,
    passwordHash: bcrypt.hashSync(password, 8),
    createdAt: new Date().toISOString(),
  };
  users.set(id, user);
  return user;
}

export const findUserByEmail = (email) =>
  [...users.values()].find((u) => u.email === email.toLowerCase());

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  verified: u.verified,
});

export function addListing(data, ownerId, verified = false) {
  const id = randomUUID();
  const listing = {
    id,
    ownerId,
    verified,
    createdAt: new Date().toISOString(),
    ...data,
  };
  listings.set(id, listing);
  return listing;
}

function seed() {
  const base = { cleanliness: 4, sleep: 2, noise: 2, social: 3, study: 2, guests: 2 };
  const people = [
    ['Mali', 'mali@ait.ac.th', { ...base, cleanliness: 5, budgetMin: 4000, budgetMax: 7000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 5, campus: 'AIT' }],
    ['Aisha', 'aisha@ait.ac.th', { ...base, sleep: 3, social: 4, budgetMin: 5000, budgetMax: 8000, smoking: 'no', food: 'halal', gender: 'female', genderPref: 'same', languages: ['English', 'Urdu'], culturalOpenness: 4, campus: 'AIT' }],
    ['Rin', 'rin@ait.ac.th', { ...base, cleanliness: 3, sleep: 5, noise: 4, social: 5, study: 4, guests: 4, budgetMin: 3500, budgetMax: 6000, smoking: 'outside', food: 'any_with_pork', gender: 'female', genderPref: 'any', languages: ['Thai', 'Japanese'], culturalOpenness: 5, campus: 'AIT' }],
    ['Ken', 'ken@ait.ac.th', { ...base, cleanliness: 3, sleep: 4, noise: 4, social: 4, study: 3, guests: 3, budgetMin: 4500, budgetMax: 7500, smoking: 'outside', food: 'any_with_pork', gender: 'male', genderPref: 'any', languages: ['English', 'Thai'], culturalOpenness: 4, campus: 'AIT' }],
    ['Anan', 'anan@ait.ac.th', { ...base, cleanliness: 4, sleep: 2, noise: 2, social: 2, budgetMin: 4000, budgetMax: 6500, smoking: 'no', food: 'vegetarian', gender: 'male', genderPref: 'same', languages: ['Thai', 'English'], culturalOpenness: 3, campus: 'AIT' }],
    ['Sara', 'sara@kmitl.ac.th', { ...base, budgetMin: 4000, budgetMax: 6000, smoking: 'no', food: 'any', gender: 'female', genderPref: 'any', languages: ['Thai'], culturalOpenness: 3, campus: 'KMITL' }],
  ];
  for (const [name, email, profile] of people) {
    const u = createUser({ name, email, password: DEMO_PASSWORD, verified: true });
    profiles.set(u.id, { userId: u.id, ...profile });
  }

  // Platform admin who checks new listings. Has its own role, not a landlord.
  createUser({
    name: 'UniNest Admin',
    email: 'admin@uninest.example',
    role: 'admin',
    password: DEMO_PASSWORD,
    verified: true,
  });

  const landlord = createUser({
    name: 'Baan Suan Dorm',
    email: 'owner@baansuan.example',
    role: 'landlord',
    password: DEMO_PASSWORD,
    verified: true,
  });
  const rooms = [
    { title: 'Twin room near AIT main gate', type: 'dorm', price: 4500, beds: 2, distanceKm: 0.6, amenities: ['aircon', 'wifi', 'laundry'], campus: 'AIT' },
    { title: 'Studio condo, Rangsit', type: 'condo', price: 8500, beds: 2, distanceKm: 3.2, amenities: ['aircon', 'wifi', 'pool', 'gym'], campus: 'AIT' },
    { title: 'Budget fan room', type: 'dorm', price: 2800, beds: 1, distanceKm: 1.1, amenities: ['fan', 'wifi'], campus: 'AIT' },
    { title: 'Two-bedroom apartment near KMITL', type: 'apartment', price: 9000, beds: 3, distanceKm: 0.9, amenities: ['aircon', 'wifi', 'kitchen'], campus: 'KMITL' },
  ];
  for (const r of rooms) addListing(r, landlord.id, true);
  // One pending listing so the admin check can be demonstrated.
  addListing(
    { title: 'New room awaiting check', type: 'dorm', price: 3900, beds: 2, distanceKm: 2.0, amenities: ['wifi'], campus: 'AIT' },
    landlord.id,
    false
  );
}

seed();
export const DEMO = { password: DEMO_PASSWORD };
