# UniNest

Roommate and accommodation matching platform for university students.
Course project for AST02.21 E-Business Development and Technology (AIT, August 2026).

## What works now

- Student sign-up with a university email check (.edu, .ac.xx, ait.asia)
- Lifestyle questionnaire and a weighted similarity matching score (0 to 100)
- Match list with a breakdown of why two students fit
- Real-time in-app chat over WebSockets, so contact details stay private
- Messages inbox with unread badges
- If WebSockets are blocked, chat falls back to normal HTTP and checks for new messages every 3 seconds
- Verified housing listings with filters (price, type, distance)
- Landlord page to add rooms, and an admin page to verify them before students can see them

## Run it

You need Node 20 or newer. Open two terminals.

    cd server
    npm install
    npm start          # API on http://localhost:4000

    cd client
    npm install
    npm run dev        # web app on http://localhost:5173

Demo accounts (password demo1234):

- Student: mali@ait.ac.th
- Landlord: owner@baansuan.example

To use the admin page, register a landlord account with the email admin@uninest.example.

To try chat, log in as mali@ait.ac.th in one tab and aisha@ait.ac.th in another tab.
Each tab keeps its own login, so two tabs in the same browser work fine.
Closing a tab logs that tab out.

## Tests

    cd server
    npm test

The tests cover the matching algorithm, the REST API (including the chat inbox) and the live chat.

## How matching works

Each answer is compared on a 1 to 5 scale. The final score is a weighted average:
tidiness 20%, sleep 17%, budget 15%, noise 10%, study habits 10%, culture and
language 10%, social life 8%, guests 5%, smoking 5%. A smoker paired with a strict
non-smoker has the total reduced by 30%. A same-gender preference or a different
university removes a candidate completely. The code is in `server/src/matching.js`.

## Known limits and next steps

- Data is kept in memory and resets when the server restarts. `server/src/store.js`
  is the only file that touches data, so moving to MongoDB Atlas means changing that file.
- The university email is checked by domain only. A confirmation link is still to do.
- Payment (PromptPay) and student ID photo upload are not built yet.
- Set JWT_SECRET and ADMIN_EMAILS as environment variables before any real deployment.
