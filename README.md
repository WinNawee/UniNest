# UniNest

Roommate and accommodation matching platform for university students.
Course project for AST02.21 E-Business Development and Technology (AIT, August 2026).

**Live site:** https://uninest-d4xw.onrender.com
(free server: the first visit after a quiet period can take up to a minute)

## What works now

- Student sign-up with a university email check (.edu, .ac.xx, ait.asia)
- Email confirmation: new accounts get a link by email and can log in only after opening it
- Forgot password: a reset link by email (works for 1 hour, once), which also logs out other devices
- Data saved in MongoDB (MongoDB Atlas), so accounts, chats and listings survive a restart
- Lifestyle questionnaire and a weighted similarity matching score (0 to 100)
- Match list with a breakdown of why two students fit
- Real-time in-app chat over WebSockets, with an inbox and unread badges
- If WebSockets are blocked, chat falls back to normal HTTP and checks for new messages every 3 seconds
- Verified housing listings with filters (price, type, distance)
- Landlord page to add rooms with up to 6 photos, and an admin page to check them (photos included) before students can see them
- Room photo gallery and a "Message landlord" button that opens a chat with a ready question about the room
- Premium (Semester Match Pass, 199 THB): pay by PromptPay QR, upload the transfer slip, an admin approves or rejects it
- Premium features: all matches (free shows the top 3), advanced match filters, see who viewed your profile, 24-hour early access to newly verified rooms, Premium badge
- Featured Listings for landlords (99 THB for 30 days): the room is shown first in Housing, paid with the same PromptPay slip check
- Room reviews: confirmed students give 1 to 5 stars, one review per room, shown with first names
- Invite a friend: when a friend signs up with your link and confirms, both get 7 days of Premium (up to 5 friends)
- Admin business dashboard: KPIs, student funnel, revenue by stream, sign-ups per day, with demo accounts left out by default

## Run it

You need Node 20 or newer. Open two terminals.

    cd server
    npm install
    npm start          # API on http://localhost:4000

    cd client
    npm install
    npm run dev        # web app on http://localhost:5173

With no settings the server uses in-memory data and prints confirmation links in
its terminal. That is fine for a quick try. For real use, follow "Settings" below.

Demo accounts (password demo1234, already confirmed):

- Student: mali@ait.ac.th (also aisha, rin, ken, anan, ploy.demo, nina.demo, hana.demo @ait.ac.th)
- Landlord: owner@baansuan.example
- Admin: admin@uninest.example (opens the Business dashboard, with tabs for Payments and Listings)

Each browser tab keeps its own login, so you can test chat with two accounts in
two tabs. Closing a tab logs that tab out.

## Settings

Copy `server/.env.example` to `server/.env` and fill it in. The `.env` file holds
passwords, so it is ignored by Git. Never commit it.

### 1. MongoDB Atlas (database)

1. Sign up at https://www.mongodb.com/cloud/atlas and create a free cluster (M0).
2. Database Access: add a database user with a password. Avoid symbols like @ / : in the password, or URL-encode them.
3. Network Access: add your IP address (or 0.0.0.0/0 to allow any IP while testing).
4. Cluster > Connect > Drivers: copy the connection string.
5. Put it in `server/.env` as `MONGODB_URI=...`, replacing `<db_password>` with the real password.
6. Check it: `cd server` then `npm run check-db`. It should say "OK: connected".

The first time the server starts with an empty database it adds the demo
accounts and listings. Data is stored in a database called `uninest` unless the
connection string names another one.

### 2. PromptPay (Premium payments)

Set `PROMPTPAY_ID` in `server/.env` to the PromptPay number that should receive
payments (a 10-digit phone number or 13-digit ID), and `PROMPTPAY_NAME` to the
name shown under the QR. Real money sent by students goes to this number.

Without `PROMPTPAY_ID` the Premium page shows a faded QR marked "Test QR. Do not pay".

How a payment works:

1. The student opens Premium, scans the QR in a banking app and pays 199 THB.
2. The student uploads a screenshot of the transfer slip.
3. The admin (admin@uninest.example) opens Admin > Payments, checks the slip
   against the bank account, and clicks Approve or Reject (with a reason).
4. On approval the student has Premium for 150 days. A rejected student sees the
   reason and can upload a new slip.

The website cannot confirm PromptPay transfers by itself, which is why an admin
checks each slip. A payment gateway could automate this after a business is registered.

### 3. Gmail (confirmation emails)

1. Turn on 2-Step Verification for the Gmail account.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. In `server/.env` set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-letter app password (no spaces).
4. Restart the server. It should print "Email: sending real confirmation emails."

Confirmation links last 24 hours and work once. "Send a new link" can be used once a minute.

## Put it online

See [DEPLOY.md](DEPLOY.md) for step-by-step instructions (Render, Brevo email, MongoDB Atlas).
In short, Render runs `npm run build` (installs everything and builds the web pages)
and `npm start` (one server that gives the API, live chat and the web pages).

## Live site safety

The demo password is public on GitHub, so the live site (with `NODE_ENV=production`) works differently:

- The server does not start without `JWT_SECRET` (32+ characters) and `ADMIN_PASSWORD` (10+ characters).
- `admin@uninest.example` logs in with `ADMIN_PASSWORD`, not `demo1234`.
- Demo students and the demo landlord cannot log in and do not appear in matches.
- Demo rooms show a "Sample listing" badge and have no "Message landlord" button.

On a laptop (without `NODE_ENV=production`) all demo accounts work as before.
For a live demo on presentation day, set `DEMO_ACCOUNTS=on` and restart.

## Tests

    cd server
    npm test

54 tests cover the matching algorithm, the REST API, email confirmation, password reset, payments, Premium features, referrals, the dashboard, room photos, live-site safety and live chat.
They use in-memory data by default. To run the same tests against Atlas, set
`MONGODB_TEST_URI` in `server/.env` to a database whose name contains "test",
for example `.../uninest_test`. The tests empty that database first and refuse
to touch a database without "test" in its name.

## E-business concepts in the app

| Concept | Where it shows in UniNest |
|---|---|
| Two-sided platform | Students and landlords, each with their own pages |
| Revenue model | Premium (students) and Featured Listings (landlords) |
| Freemium | Free top 3 matches and view counts, Premium unlocks the rest |
| Trust and reputation | Email confirmation, verified listings, reviews, private chat |
| Growth (viral marketing) | Invite a friend, both get Premium days |
| E-metrics | Admin dashboard: funnel, conversion rate, revenue by stream |
| Online payment | PromptPay QR with slip check |

## How matching works

Each answer is compared on a 1 to 5 scale. The final score is a weighted average:
tidiness 20%, sleep 17%, budget 15%, noise 10%, study habits 10%, culture and
language 10%, social life 8%, guests 5%, smoking 5%. A smoker paired with a strict
non-smoker has the total reduced by 30%. A same-gender preference or a different
university removes a candidate completely. The code is in `server/src/matching.js`.

## Project layout

    server/src/app.js        API routes (auth, email confirmation, matching, listings, chat)
    server/src/socket.js     live chat
    server/src/db/mongo.js   MongoDB models and queries
    server/src/db/memory.js  in-memory version with the same functions (tests, quick demos)
    server/src/mailer.js     confirmation emails
    server/src/payments.js   Premium and Featured Listing plans, PromptPay QR, slip upload and admin review
    server/src/referrals.js  invite codes and rewards
    server/src/views.js      who viewed my profile
    server/src/stats.js      admin dashboard numbers
    server/src/photos.js     room photos (upload, delete, show)
    server/src/seed.js       demo accounts and listings
    client/src/pages/        web pages

## Next steps

- Student ID photo upload
- Check room photos again when a landlord adds them after verification
