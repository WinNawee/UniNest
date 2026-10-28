// In-memory store. Used by the tests and when no MONGODB_URI is set.
// Data is lost when the server stops.
// It has exactly the same functions as mongo.js, so the rest of the app
// does not care which one is in use.
import { randomUUID } from 'node:crypto';

let users = new Map();
let profiles = new Map(); // userId -> profile
let listings = new Map();
let messages = [];
let reviews = [];
let payments = new Map();

const now = () => new Date().toISOString();
const copy = (x) => (x ? structuredClone(x) : null);

export const memoryStore = {
  name: 'memory',

  async connect() {},
  dbName: 'memory',
  async disconnect() {},

  async reset() {
    users = new Map();
    profiles = new Map();
    listings = new Map();
    messages = [];
    reviews = [];
    payments = new Map();
  },

  users: {
    async count() {
      return users.size;
    },
    async create(data) {
      const user = { id: randomUUID(), createdAt: now(), ...data, email: data.email.toLowerCase() };
      users.set(user.id, user);
      return copy(user);
    },
    async findById(id) {
      return copy(users.get(id));
    },
    async findByEmail(email) {
      const e = String(email).toLowerCase();
      return copy([...users.values()].find((u) => u.email === e));
    },
    async findByIds(ids) {
      return ids.map((id) => users.get(id)).filter(Boolean).map(copy);
    },
    async findByVerifyTokenHash(hash) {
      return copy([...users.values()].find((u) => u.verifyTokenHash === hash));
    },
    async update(id, fields) {
      const user = users.get(id);
      if (!user) return null;
      Object.assign(user, fields);
      return copy(user);
    },
  },

  profiles: {
    async get(userId) {
      return copy(profiles.get(userId));
    },
    async save(userId, profile) {
      const saved = { ...profile, userId };
      profiles.set(userId, saved);
      return copy(saved);
    },
    async all() {
      return [...profiles.values()].map(copy);
    },
  },

  listings: {
    async create(data) {
      const listing = { id: randomUUID(), createdAt: now(), ...data };
      listings.set(listing.id, listing);
      return copy(listing);
    },
    async get(id) {
      return copy(listings.get(id));
    },
    // filter can contain verified and/or ownerId
    async find(filter = {}) {
      return [...listings.values()]
        .filter((l) => Object.entries(filter).every(([k, v]) => l[k] === v))
        .map(copy);
    },
    async update(id, fields) {
      const listing = listings.get(id);
      if (!listing) return null;
      Object.assign(listing, fields);
      return copy(listing);
    },
  },

  messages: {
    async create({ from, to, text }) {
      const m = { id: randomUUID(), from, to, text, read: false, at: now() };
      messages.push(m);
      return copy(m);
    },
    // Every message sent or received by this user, oldest first.
    async forUser(userId) {
      return messages.filter((m) => m.from === userId || m.to === userId).map(copy);
    },
    async between(a, b) {
      return messages
        .filter((m) => (m.from === a && m.to === b) || (m.from === b && m.to === a))
        .map(copy);
    },
    async markRead(from, to) {
      for (const m of messages) if (m.from === from && m.to === to) m.read = true;
    },
  },

  payments: {
    async create(data) {
      const p = { id: randomUUID(), createdAt: now(), ...data };
      payments.set(p.id, p);
      return copy(p);
    },
    async get(id) {
      return copy(payments.get(id));
    },
    // Newest first. filter can contain userId and/or status.
    async find(filter = {}) {
      return [...payments.values()]
        .filter((p) => Object.entries(filter).every(([k, v]) => p[k] === v))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(copy);
    },
    async update(id, fields) {
      const p = payments.get(id);
      if (!p) return null;
      Object.assign(p, fields);
      return copy(p);
    },
  },

  reviews: {
    async create(data) {
      const r = { id: randomUUID(), at: now(), ...data };
      reviews.push(r);
      return copy(r);
    },
    async forListing(listingId) {
      return reviews.filter((r) => r.listingId === listingId).map(copy);
    },
  },
};
