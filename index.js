require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

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

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send('Ivorey → Google Calendar webhook is running.');
});

// ── Webhook endpoint ──────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // Optional: verify the shared secret sent by GHL
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-webhook-secret'];
    if (incoming !== secret) {
      console.warn(`[${new Date().toISOString()}] Rejected webhook — bad secret`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const tz = process.env.TIMEZONE || 'America/New_York';
    const now = new Date();

    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    // Reminder fires the following day at 9 am local time.
    // Google Calendar reminders are expressed as "minutes before event start",
    // so we calculate the gap between now and tomorrow-9am.
    const nextDay9am = new Date(now);
    nextDay9am.setDate(nextDay9am.getDate() + 1);
    nextDay9am.setHours(9, 0, 0, 0);
    const reminderMinutes = Math.round((nextDay9am.getTime() - now.getTime()) / 60_000);

    const event = {
      summary: '🌿 New HTMA Inquiry — check Ivorey!',
      description: [
        'Someone new found their way to you. 🌱',
        '',
        'A new inquiry just came through your Rooted in Eden form. This is what you do — you help people get to the root of what\'s really going on in their bodies. Go take a look and see if this is someone you\'re called to serve.',
        '',
        '👉 Log into Ivorey and check your form submissions.',
        '',
        'Remember: you don\'t have to take everyone. Trust your discernment.',
      ].join('\n'),
      colorId: '1', // Lavender
      start: {
        dateTime: startTime,
        timeZone: tz,
      },
      end: {
        dateTime: endTime,
        timeZone: tz,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: reminderMinutes },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'rootedinedenpma@gmail.com',
      resource: event,
    });

    console.log(`[${new Date().toISOString()}] Event created: ${response.data.htmlLink}`);
    return res.status(200).json({ success: true, eventId: response.data.id });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error creating event:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Listening on port ${PORT}`);
});
