# UniNest

Roommate and accommodation matching platform for university students.
Course project for AST02.21 E-Business Development and Technology (AIT, August 2026).

## What works now

- Student sign-up with a university email check (.edu, .ac.xx, ait.asia)
- Email confirmation: new accounts get a link by email and can log in only after opening it
- Data saved in MongoDB (MongoDB Atlas), so accounts, chats and listings survive a restart
- Lifestyle questionnaire and a weighted similarity matching score (0 to 100)
- Match list with a breakdown of why two students fit
- Real-time in-app chat over WebSockets, with an inbox and unread badges
- If WebSockets are blocked, chat falls back to normal HTTP and checks for new messages every 3 seconds
- Verified housing listings with filters (price, type, distance)
- Landlord page to add rooms, and an admin page to verify them before students can see them
- Premium (Semester Match Pass, 199 THB): pay by PromptPay QR, upload the transfer slip, an admin approves or rejects it. Free students see their top 3 matches, Premium students see all of them and get a badge

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

- Student: mali@ait.ac.th (also aisha, rin, ken, anan @ait.ac.th)
- Landlord: owner@baansuan.example
- Admin: admin@uninest.example (opens the Verify listings page)

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

## Tests

    cd server
    npm test

38 tests cover the matching algorithm, the REST API, email confirmation, Premium payments and live chat.
They use in-memory data by default. To run the same tests against Atlas, set
`MONGODB_TEST_URI` in `server/.env` to a database whose name contains "test",
for example `.../uninest_test`. The tests empty that database first and refuse
to touch a database without "test" in its name.

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
    server/src/payments.js   Premium plan, PromptPay QR, slip upload and admin review
    server/src/seed.js       demo accounts and listings
    client/src/pages/        web pages

## Next steps

- Student ID photo upload
- Deploy online with HTTPS (set APP_URL, JWT_SECRET and NODE_ENV=production)
