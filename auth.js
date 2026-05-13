/**
 * One-time script to obtain a Google OAuth2 refresh token.
 * Run locally with: npm run auth
 * You only need to do this once — then copy the refresh token into your .env.
 */
require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // must be http://localhost:3000/oauth2callback
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forces Google to return a refresh token every time
  scope: SCOPES,
});

console.log('\n──────────────────────────────────────────────────────────');
console.log('Open this URL in your browser and sign in as rootedinedenpma@gmail.com:');
console.log('\n' + authUrl + '\n');
console.log('Waiting for Google to redirect back to localhost:3000 …');
console.log('──────────────────────────────────────────────────────────\n');

// Spin up a temporary local server to catch the OAuth redirect
const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);

  if (pathname !== '/oauth2callback') {
    res.end('Not found');
    return;
  }

  const code = query.code;
  if (!code) {
    res.end('No code received. Try again.');
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end('<h2>Success! You can close this tab.</h2><p>Check your terminal for the refresh token.</p>');

    console.log('──────────────────────────────────────────────────────────');
    console.log('SUCCESS — copy this refresh token into your .env file');
    console.log('(or into Railway environment variables):\n');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n──────────────────────────────────────────────────────────\n');
  } catch (err) {
    res.end('Error: ' + err.message);
    console.error('Token exchange failed:', err.message);
  }

  server.close();
});

server.listen(3000);
