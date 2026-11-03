import './env.js'; // reads settings from server/.env (must stay first)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { buildApp } from './app.js';
import { connectDb, db } from './db/index.js';
import { attachChat } from './socket.js';
import { createMailer } from './mailer.js';
import { seedIfEmpty, addDemoExtras, applyAdminPassword, demoAccountsOff } from './seed.js';

const PORT = process.env.PORT || 4000;
const LIVE = process.env.NODE_ENV === 'production';
const WEB_APP = path.resolve(import.meta.dirname, '../../client/dist'); // made by "npm run build"

// The live site must not use the default secret or the demo admin password,
// because both are public on GitHub.
function checkLiveSettings() {
  const missing = [];
  if ((process.env.JWT_SECRET || '').length < 32) missing.push('JWT_SECRET (at least 32 random characters)');
  if ((process.env.ADMIN_PASSWORD || '').length < 10) missing.push('ADMIN_PASSWORD (at least 10 characters)');
  if (missing.length) {
    console.error('\nThe live site needs these settings first:\n  - ' + missing.join('\n  - ') + '\n');
    process.exit(1);
  }
}

async function start() {
  if (LIVE) checkLiveSettings();

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
  else {
    const added = await addDemoExtras();
    if (added) console.log(`Added ${added} new demo students (password: demo1234).`);
  }
  if (LIVE) {
    if (await applyAdminPassword(process.env.ADMIN_PASSWORD)) console.log('Admin password set from ADMIN_PASSWORD.');
    if (demoAccountsOff()) console.log('Demo students and the demo landlord are switched off on the live site.');
  }

  // 2. Email
  const mailer = createMailer();
  console.log(mailer.configured
    ? 'Email: sending real confirmation emails.'
    : 'Email: not set up, confirmation links will be printed here.');
  if (LIVE && !mailer.configured) console.warn('WARNING: on the live site nobody can confirm their email until SMTP settings are added.');

  // 3. Web server and live chat
  let chat;
  const app = buildApp({ onMessage: (msg) => chat.pushMessage(msg), mailer });
  serveWebApp(app);
  const server = http.createServer(app);
  chat = attachChat(server);

  // Listening without a host accepts both IPv4 and IPv6, which avoids the
  // "localhost resolves to ::1" problem on some Windows machines.
  server.listen(PORT, () => console.log(`UniNest API on http://localhost:${PORT}`));
}

// On the live site one server gives both the API and the web pages, so there is
// a single link to share. (On a laptop the pages come from "npm run dev" instead.)
function serveWebApp(app) {
  const indexHtml = path.join(WEB_APP, 'index.html');
  if (!fs.existsSync(indexHtml)) return;
  app.use(express.static(WEB_APP));
  // Any other page address (for example /matches or /verify-email) gets the app,
  // which then shows the right page.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(indexHtml);
  });
  console.log('Serving the web app from client/dist.');
}

start();
