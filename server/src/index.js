import './env.js'; // reads settings from server/.env (must stay first)
import http from 'node:http';
import { buildApp } from './app.js';
import { connectDb, db } from './db/index.js';
import { attachChat } from './socket.js';
import { createMailer } from './mailer.js';
import { seedIfEmpty } from './seed.js';

const PORT = process.env.PORT || 4000;

async function start() {
  // 1. Database
  if (process.env.MONGODB_URI) {
    console.log('Connecting to MongoDB...');
    try {
      await connectDb(process.env.MONGODB_URI);
    } catch (err) {
      console.error('\nCould not connect to MongoDB:', err.message);
      console.error('Check MONGODB_URI in server/.env and that your IP is allowed in Atlas (Network Access).\n');
      process.exit(1);
    }
    console.log(`Connected to MongoDB (database "${db.dbName}").`);
  } else {
    await connectDb(null);
    console.log('No MONGODB_URI set: using in-memory data (lost when the server stops).');
  }
  if (await seedIfEmpty()) console.log('Added demo accounts and listings (password: demo1234).');

  // 2. Email
  const mailer = createMailer();
  console.log(mailer.configured
    ? 'Email: sending real confirmation emails.'
    : 'Email: not set up, confirmation links will be printed here.');

  // 3. Web server and live chat
  let chat;
  const app = buildApp({ onMessage: (msg) => chat.pushMessage(msg), mailer });
  const server = http.createServer(app);
  chat = attachChat(server);

  // Listening without a host accepts both IPv4 and IPv6, which avoids the
  // "localhost resolves to ::1" problem on some Windows machines.
  server.listen(PORT, () => console.log(`UniNest API on http://localhost:${PORT}`));
}

start();
