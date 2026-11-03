# Putting UniNest online (Render)

This guide puts the whole app (web pages, API and live chat) on one free Render
web service, with the data in your existing MongoDB Atlas database.
It takes about 45 minutes the first time.

You need:

- the code pushed to GitHub (with `package.json` in the top folder)
- your MongoDB Atlas account
- a Gmail address to send emails from
- (optional) the PromptPay number that should receive Premium payments

## 1. MongoDB Atlas (5 minutes)

1. Log in at https://cloud.mongodb.com.
2. **Database Access** (under Security): click **Edit** on your database user, then
   **Edit Password** > **Autogenerate Secure Password**. Copy it and click **Update User**.
   The old password was shared in chat, so the live site should use a new one.
3. **Network Access**: make sure `0.0.0.0/0` (allow access from anywhere) is in the list.
   Render's free plan has no fixed IP address, so Atlas must accept any address.
   The database password still protects it.
4. Put the new password into `MONGODB_URI` in your own `server/.env` too, and run
   `npm run check-db` in the server folder. It should say "OK: connected".
   Send the new `.env` to your teammate privately.

Keep the full connection string ready for step 3. It looks like:

    mongodb+srv://USER:NEW_PASSWORD@cluster0.xxxxx.mongodb.net/uninest?retryWrites=true&w=majority

## 2. Email with Brevo (15 minutes)

Render's free plan blocks the normal email ports (25, 465 and 587), so Gmail's
SMTP server cannot be used from there. Brevo is a free email service (300
emails a day) that also accepts port 2525, which Render does not block.

1. Sign up at https://www.brevo.com (free plan).
2. Add your Gmail address as a sender: **Senders, Domains & Dedicated IPs** > **Senders** >
   **Add a sender**. Brevo emails you a code to confirm it.
3. Open **SMTP & API** > **SMTP** and click **Generate a new SMTP key**. Copy it.
   On the same page you see your **SMTP login** (it looks like `xxxxxx@smtp-brevo.com`).
4. You will use these values in step 3:

        SMTP_HOST=smtp-relay.brevo.com
        SMTP_PORT=2525
        SMTP_USER=your SMTP login (xxxxxx@smtp-brevo.com)
        SMTP_PASS=the SMTP key
        MAIL_FROM=UniNest <the Gmail address you added as a sender>

New Brevo accounts are sometimes checked by Brevo before they can send.
If emails do not arrive at first, look for a message from Brevo asking for details.

## 3. Render (15 minutes)

1. Sign up at https://render.com with your GitHub account.
2. Click **New** > **Web Service** and pick your `uninest` repository.
   (If you do not see it, click "Configure GitHub" and give Render access to the repo.)
3. Fill in:

    | Setting | Value |
    |---|---|
    | Name | `uninest` (this becomes part of the link) |
    | Region | Singapore (closest to Thailand) |
    | Branch | `main` |
    | Root Directory | leave empty |
    | Runtime / Language | Node |
    | Build Command | `npm run build` |
    | Start Command | `npm start` |
    | Instance Type | Free |

4. Under **Environment Variables**, add:

    | Key | Value |
    |---|---|
    | `NODE_ENV` | `production` |
    | `MONGODB_URI` | the connection string from step 1 |
    | `JWT_SECRET` | click **Generate** (any long random text) |
    | `ADMIN_PASSWORD` | a private password for admin@uninest.example (10+ characters) |
    | `SMTP_HOST` | `smtp-relay.brevo.com` |
    | `SMTP_PORT` | `2525` |
    | `SMTP_USER` | your Brevo SMTP login |
    | `SMTP_PASS` | your Brevo SMTP key |
    | `MAIL_FROM` | `UniNest <your.address@gmail.com>` |
    | `PROMPTPAY_ID` | (optional) 10-digit phone or 13-digit ID that receives payments |
    | `PROMPTPAY_NAME` | (optional) name shown under the QR |

    You do not need `APP_URL`: the app reads its Render address by itself.

5. Open **Advanced** and set **Health Check Path** to `/api/health`.
6. Click **Create Web Service** (or **Deploy**). The first build takes a few minutes.
   When the log shows `UniNest API on ...` and the status is "Live", open the
   link at the top of the page (for example `https://uninest-xxxx.onrender.com`).

The log should also show:

    Connected to MongoDB (database "uninest").
    Admin password set from ADMIN_PASSWORD.
    Demo students and the demo landlord are switched off on the live site.
    Email: sending real confirmation emails.
    Serving the web app from client/dist.

If it says "The live site needs these settings first", add the setting it names
under **Environment**, and Render restarts the app.

## 4. Check it works (10 minutes)

1. Sign up as a student with your AIT email. The confirmation email should arrive
   within a minute (check spam too). Open the link.
2. Fill in the questionnaire and open your matches.
3. Ask your teammate to sign up too, then chat with each other.
4. Log in as `admin@uninest.example` with your `ADMIN_PASSWORD`.
   The dashboard should count only the two of you.
5. Try "Forgot password?" once.
6. Open the link on your phone.

## Good to know

- **Free plan sleep:** after about 15 minutes with no visitors the app sleeps, and the
  next visit takes 30 to 60 seconds to wake it up. Tell pilot testers this is normal.
- **Updates:** every `git push` to `main` makes Render build and restart the app.
- **Logs:** Render > your service > **Logs** shows errors and confirmation emails sent.
- **Presentation day:** to log in with the demo accounts on the live site, add
  `DEMO_ACCOUNTS` = `on` under Environment. Remove it afterwards.
- **Never** put these values in GitHub. They live only in Render, your own `server/.env`,
  and your teammate's copy.
