// Quick check that MONGODB_URI in .env works: npm run check-db
import './env.js';
import { connectDb, disconnectDb, db } from './db/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.log('MONGODB_URI is not set in server/.env, so the app uses in-memory data.');
  process.exit(0);
}
try {
  await connectDb(uri);
  console.log(`OK: connected to database "${db.dbName}".`);
  console.log(`Users: ${await db.users.count()}, listings: ${(await db.listings.find()).length}`);
  await disconnectDb();
} catch (err) {
  console.error('Could not connect:', err.message);
  console.error('Check the password in MONGODB_URI and that your IP is allowed in Atlas (Network Access).');
  process.exit(1);
}
