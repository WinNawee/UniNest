// Shared test setup.
// By default the tests use the in-memory store. To run the same tests against
// a real MongoDB, set MONGODB_TEST_URI to a database whose name contains "test",
// for example: mongodb+srv://user:pass@cluster.mongodb.net/uninest_test
import '../src/env.js';
import http from 'node:http';
import { buildApp } from '../src/app.js';
import { connectDb, disconnectDb, db } from '../src/db/index.js';
import { seedIfEmpty } from '../src/seed.js';

// A fake mailer that keeps the emails instead of sending them.
export function fakeMailer({ delivered = true } = {}) {
  const sent = [];
  return {
    sent,
    async sendVerification(mail) {
      sent.push(mail);
      return { delivered };
    },
    lastToken() {
      const link = sent.at(-1)?.link || '';
      return new URL(link).searchParams.get('token');
    },
  };
}

export async function startTestServer({ mailer = fakeMailer(), onMessage } = {}) {
  await connectDb(process.env.MONGODB_TEST_URI, { defaultDbName: 'uninest_test' });
  await db.reset();
  await seedIfEmpty();
  const server = http.createServer(buildApp({ mailer, onMessage }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  }

  async function stop() {
    await new Promise((r) => server.close(r));
    await disconnectDb();
  }

  return { server, base, call, stop, mailer };
}

// Register a new account and confirm its email, returning a login token.
export async function registerAndConfirm(ctx, body) {
  const reg = await ctx.call('/api/auth/register', { method: 'POST', body });
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.data)}`);
  const ok = await ctx.call('/api/auth/verify-email', { method: 'POST', body: { token: ctx.mailer.lastToken() } });
  if (ok.status !== 200) throw new Error(`verify failed: ${JSON.stringify(ok.data)}`);
  return ok.data;
}

export const login = (ctx, email, password = 'demo1234') =>
  ctx.call('/api/auth/login', { method: 'POST', body: { email, password } });
