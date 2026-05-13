require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Google OAuth2 client ──────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const CALENDAR_ID = 'rootedinedenpma@gmail.com';
const PROCESSED_FILE = path.join(__dirname, 'processed-emails.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tz() {
  return process.env.TIMEZONE || 'America/New_York';
}

function atHour(date, hour) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Next business day at 9am. Fri/Sat/Sun all roll to Monday.
function nextBusinessDay9am(from) {
  const day = from.getDay(); // 0=Sun … 6=Sat
  const daysToAdd = day === 5 ? 3 : day === 6 ? 2 : day === 0 ? 1 : 1;
  const next = new Date(from);
  next.setDate(next.getDate() + daysToAdd);
  return atHour(next, 9);
}

function sameDay9am(from) {
  return atHour(from, 9);
}

function nextDay9am(from) {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  return atHour(next, 9);
}

function buildEvent({ summary, description, colorId, startTime }) {
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
  return {
    summary,
    description,
    colorId,
    start: { dateTime: startTime.toISOString(), timeZone: tz() },
    end: { dateTime: endTime.toISOString(), timeZone: tz() },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 0 }],
    },
  };
}

async function createEvent(eventBody) {
  const res = await calendar.events.insert({ calendarId: CALENDAR_ID, resource: eventBody });
  return res.data;
}

function checkSecret(req, res) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    console.warn(`[${new Date().toISOString()}] Rejected request — bad secret`);
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Processed-email tracking ──────────────────────────────────────────────────

function loadProcessed() {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveProcessed(ids) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...ids]));
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send('Ivorey → Google Calendar webhook is running.');
});

// ── POST /webhook — new inquiry (Holistic Well Woman Care form) ───────────────
app.post('/webhook', async (req, res) => {
  if (!checkSecret(req, res)) return;

  try {
    const now = new Date();
    const reminderTarget = nextDay9am(now);
    const reminderMinutes = Math.round((reminderTarget - now) / 60_000);

    const event = {
      summary: '🌿 New Health Coaching Inquiry — check Ivorey!',
      description: [
        'Someone new found their way to you. 🌱',
        '',
        "A new inquiry just came through your Rooted in Eden form. This is what you do — you help people get to the root of what's really going on in their bodies. Go take a look and see if this is someone you're called to serve.",
        '',
        '👉 Log into Ivorey and check your form submissions.',
        '',
        "Remember: you don't have to take everyone. Trust your discernment.",
      ].join('\n'),
      colorId: '1', // Lavender
      start: { dateTime: now.toISOString(), timeZone: tz() },
      end: { dateTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), timeZone: tz() },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: reminderMinutes }],
      },
    };

    const created = await createEvent(event);
    console.log(`[${new Date().toISOString()}] Inquiry event created: ${created.htmlLink}`);
    return res.status(200).json({ success: true, eventId: created.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /webhook/htma-payment ────────────────────────────────────────────────
// Fires when payment + contract are complete. Body must include {"service":"htma"}.
app.post('/webhook/htma-payment', async (req, res) => {
  if (!checkSecret(req, res)) return;

  if (req.body?.service !== 'htma') {
    return res.status(200).json({ skipped: true, reason: 'service is not htma' });
  }

  const name = req.body?.contact?.name || 'client';

  try {
    const created = await createEvent(buildEvent({
      summary: `🌿 Kit ready to mail — ${name}!`,
      description: "Payment received and contract signed! Time to get their kit in the mail. You're changing someone's life one strand of hair at a time. 🌿 Log into Ivorey to confirm their mailing address.",
      colorId: '1', // Lavender
      startTime: nextBusinessDay9am(new Date()),
    }));

    console.log(`[${new Date().toISOString()}] HTMA payment event created: ${created.htmlLink}`);
    return res.status(200).json({ success: true, eventId: created.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /webhook/htma-followup ───────────────────────────────────────────────
// Body: {"months": 3|6, "contact": {"name": "..."}}
app.post('/webhook/htma-followup', async (req, res) => {
  if (!checkSecret(req, res)) return;

  const months = req.body?.months;
  const name = req.body?.contact?.name || 'client';

  if (months !== 3 && months !== 6) {
    return res.status(400).json({ error: 'months must be 3 or 6' });
  }

  try {
    const created = await createEvent(buildEvent({
      summary: `🌿 ${months} Month Check In — ${name}`,
      description: "Time to check in and see how they're doing with their protocol. How are their symptoms? Are they ready to retest? Reach out personally and remind them you're still in their corner. 🌿",
      colorId: '1', // Lavender
      startTime: sameDay9am(new Date()),
    }));

    console.log(`[${new Date().toISOString()}] Follow-up event created: ${created.htmlLink}`);
    return res.status(200).json({ success: true, eventId: created.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Gmail watcher — checks every 15 minutes ───────────────────────────────────
async function checkGmail() {
  const isFirstRun = !fs.existsSync(PROCESSED_FILE);
  const processed = loadProcessed();

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:reports@traceelements.com',
      maxResults: 50,
    });

    const messages = response.data.messages || [];

    if (isFirstRun) {
      // Seed mode: mark all existing emails as already handled so we don't
      // create a flood of calendar events on first deploy.
      for (const msg of messages) processed.add(msg.id);
      saveProcessed(processed);
      console.log(`[${new Date().toISOString()}] Gmail seeded — ${messages.length} existing TEI email(s) marked as processed`);
      return;
    }

    let newCount = 0;
    for (const msg of messages) {
      if (processed.has(msg.id)) continue;

      const created = await createEvent(buildEvent({
        summary: '🌿 TEI Results In — prep protocol!',
        description: "Your client's HTMA results just landed from Trace Elements. Pull up the report, run it through InstantHTMA, and build their protocol before your next appointment. This is the work you were made for. 🌿",
        colorId: '2', // Sage (green)
        startTime: nextDay9am(new Date()),
      }));

      processed.add(msg.id);
      newCount++;
      console.log(`[${new Date().toISOString()}] TEI email processed → event created: ${created.htmlLink}`);
    }

    if (newCount > 0) saveProcessed(processed);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Gmail check error:`, err.message);
  }
}

// Run immediately on startup, then every 15 minutes
checkGmail();
setInterval(checkGmail, 15 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Listening on port ${PORT}`);
});
