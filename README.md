# Ivorey → Google Calendar Webhook

This server handles three automations for Rooted in Eden:

| Trigger | Endpoint | What it creates |
|---------|----------|-----------------|
| New inquiry form submitted | `POST /webhook` | Lavender event now; popup reminder next day 9am |
| HTMA payment + contract complete | `POST /webhook/htma-payment` | Lavender event next business day 9am |
| 3 or 6 month follow-up | `POST /webhook/htma-followup` | Lavender event same day 9am |
| Email from `reports@traceelements.com` | *(auto, every 15 min)* | Sage/green event next day 9am |

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later (for local testing)
- A [Google account](https://console.cloud.google.com) to create OAuth credentials
- A [Railway](https://railway.app) account for deployment

---

## Step 1 — Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com) and sign in as `rootedinedenpma@gmail.com`.
2. Click **Select a project** → **New Project**. Name it something like `ivorey-webhook`.
3. In the left sidebar go to **APIs & Services → Library**. Search for and enable both:
   - **Google Calendar API**
   - **Gmail API**
4. Go to **APIs & Services → OAuth consent screen**.
   - Choose **External**, click **Create**.
   - Fill in App name (e.g. `Ivorey Webhook`), your email for support, and your email again for developer contact.
   - Click **Save and Continue** through all screens until done.
   - Under **Test users**, click **+ Add Users** and add `rootedinedenpma@gmail.com`. Save.
5. Go to **APIs & Services → Credentials → + Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `ivorey-webhook`.
   - Under **Authorized redirect URIs**, click **+ Add URI** and enter: `http://localhost:3000/oauth2callback`
   - Click **Create**.
6. A dialog shows your **Client ID** and **Client Secret** — copy both, you'll need them shortly.

---

## Step 2 — Local setup

```bash
# Clone or copy the project folder, then:
cd ivorey-calendar-webhook
npm install

# Copy the example env file
cp .env.example .env
```

Open `.env` and fill in:

```
GOOGLE_CLIENT_ID=paste_your_client_id
GOOGLE_CLIENT_SECRET=paste_your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
TIMEZONE=America/New_York   # change to your timezone if needed
```

---

## Step 3 — Get your refresh token (one-time)

> **If you already ran this before:** the scopes have changed (Gmail was added), so you must run it again to get a new token that covers both Calendar and Gmail.

```bash
npm run auth
```

The script prints a URL. Open it in your browser and sign in as `rootedinedenpma@gmail.com`. Google will ask you to grant access to both **Calendar** and **Gmail (read-only)**. After authorizing, your terminal will print:

```
GOOGLE_REFRESH_TOKEN=1//0g...
```

Copy that value and add it to `.env` (replacing any previous token):

```
GOOGLE_REFRESH_TOKEN=paste_token_here
```

---

## Step 4 — Test locally

```bash
node index.js
```

On first start the Gmail watcher seeds itself (marks all existing TEI emails as already processed — no calendar spam). You'll see a log line confirming this.

In a second terminal, test each endpoint:

**New inquiry:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

**HTMA payment:**
```bash
curl -X POST http://localhost:3000/webhook/htma-payment \
  -H "Content-Type: application/json" \
  -d '{"service":"htma","contact":{"name":"Jane Smith"}}'
```

**3-month follow-up:**
```bash
curl -X POST http://localhost:3000/webhook/htma-followup \
  -H "Content-Type: application/json" \
  -d '{"months":3,"contact":{"name":"Jane Smith"}}'
```

Check your Google Calendar after each — events should appear at the expected times.

---

## Step 5 — Deploy to Railway

1. Push the project to a GitHub repository (the `.gitignore` keeps `.env` out of git).
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → select your repo.
3. Once the first deploy finishes, go to your service → **Variables** and add every variable from your `.env` file:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` — change this to `http://localhost:3000/oauth2callback` (the auth step is already done; Railway just needs this value present)
   - `GOOGLE_REFRESH_TOKEN`
   - `TIMEZONE`
   - `WEBHOOK_SECRET` (optional — see below)
4. Railway sets `PORT` automatically — do not add it manually.
5. Click **Deploy**. Once live, copy your Railway public URL (e.g. `https://ivorey-calendar-webhook-production.up.railway.app`).

---

## Step 6 — Configure GoHighLevel webhooks

Set up three separate webhooks in Ivorey, all pointing to your Railway URL:

**New inquiry form (Holistic Well Woman Care - Virtual):**
- URL: `https://your-railway-url.up.railway.app/webhook`
- Method: POST

**HTMA payment complete:**
- URL: `https://your-railway-url.up.railway.app/webhook/htma-payment`
- Method: POST
- Make sure the payload includes `"service": "htma"` and `"contact": {"name": "..."}` (map the contact name field from GHL)

**3 or 6 month follow-up:**
- URL: `https://your-railway-url.up.railway.app/webhook/htma-followup`
- Method: POST
- Payload must include `"months": 3` or `"months": 6` and `"contact": {"name": "..."}`

The Gmail watcher for Trace Elements emails runs automatically in the background — no GHL setup needed for that one.

---

## Optional: Webhook secret

To prevent anyone who guesses your URL from spamming your calendar:

1. Generate a random string (e.g. `openssl rand -hex 20` in your terminal).
2. Add it to `.env` / Railway variables as `WEBHOOK_SECRET=your_secret`.
3. In GoHighLevel webhook settings, add a custom header:
   - Header name: `x-webhook-secret`
   - Value: the same string

The server will reject any request that doesn't include the matching header.

---

## File overview

| File | Purpose |
|------|---------|
| `index.js` | Express server — webhooks, Gmail watcher, Calendar event creation |
| `auth.js` | One-time local script to generate the OAuth refresh token |
| `processed-emails.json` | Auto-created at runtime; tracks TEI emails already acted on |
| `railway.toml` | Railway deployment config |
| `.env.example` | Template for your environment variables |

---

## Timezone reference

Common US timezones for `TIMEZONE`:

| Zone | Value |
|------|-------|
| Eastern | `America/New_York` |
| Central | `America/Chicago` |
| Mountain | `America/Denver` |
| Pacific | `America/Los_Angeles` |

Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
