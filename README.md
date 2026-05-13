# Ivorey → Google Calendar Webhook

When someone submits the **Holistic Well Woman Care - Virtual** form in GoHighLevel (Ivorey.io), this server receives the webhook and instantly creates a lavender-colored reminder event on `rootedinedenpma@gmail.com`.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later (for local testing)
- A [Google account](https://console.cloud.google.com) to create OAuth credentials
- A [Railway](https://railway.app) account for deployment

---

## Step 1 — Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com) and sign in as `rootedinedenpma@gmail.com`.
2. Click **Select a project** → **New Project**. Name it something like `ivorey-webhook`.
3. In the left sidebar go to **APIs & Services → Library**. Search for **Google Calendar API** and click **Enable**.
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

```bash
npm run auth
```

The script prints a URL. Open it in your browser and sign in as `rootedinedenpma@gmail.com`. After authorizing, your terminal will print:

```
GOOGLE_REFRESH_TOKEN=1//0g...
```

Copy that value and add it to `.env`:

```
GOOGLE_REFRESH_TOKEN=paste_token_here
```

---

## Step 4 — Test locally

```bash
node index.js
```

In a second terminal, send a test webhook:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"formName":"Holistic Well Woman Care - Virtual","test":true}'
```

Check your Google Calendar — a lavender event should appear immediately with a popup reminder for the following day at 9 am.

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

## Step 6 — Configure GoHighLevel webhook

1. In **Ivorey (GoHighLevel)**, go to the **Holistic Well Woman Care - Virtual** form settings.
2. Find **Webhooks** or **Integrations → Webhook**.
3. Set the webhook URL to:
   ```
   https://your-railway-url.up.railway.app/webhook
   ```
4. Set the method to **POST**.
5. Save.

To verify it's working, submit a test entry in the form and check your Google Calendar.

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
| `index.js` | Express server — receives webhook, creates Calendar event |
| `auth.js` | One-time local script to generate the OAuth refresh token |
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
