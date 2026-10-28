// Picks the data store. With a MongoDB connection string the app uses MongoDB,
// otherwise it falls back to the in-memory store (handy for tests and demos).
import { memoryStore } from './memory.js';
import { mongoStore } from './mongo.js';

// Other files import { db } and always see the store chosen here.
export let db = memoryStore;

export async function connectDb(uri, options = {}) {
  db = uri ? mongoStore : memoryStore;
  await db.connect(uri, options);
  return db;
}

export async function disconnectDb() {
  await db.disconnect();
}
