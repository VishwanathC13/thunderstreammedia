// Zoom / Teams / Webex auto-meeting creation (spec 3.4). Real branch fires
// only when that provider's env vars are set; otherwise returns a
// realistic mock so the booking-confirm flow works end-to-end without
// credentials.
function mockMeeting(provider, topic) {
  const id = Math.random().toString(36).slice(2, 10);
  console.log(`[MOCK:${provider}] would create meeting "${topic}" — returning mock join link`);
  return { provider, joinUrl: `https://mock.meet/${provider.toLowerCase()}/${id}`, meetingId: `mock-${id}`, mocked: true };
}

async function createZoomMeeting({ topic, startTime, durationMins }) {
  if (!(process.env.ZOOM_ENABLED === 'true' && process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET)) {
    return mockMeeting('ZOOM', topic);
  }
  // Real Server-to-Server OAuth flow: exchange client credentials for a
  // token, then POST /users/me/meetings. Left as a single call site so
  // dropping in real credentials is the only change needed here.
  const tokenRes = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
  });
  const { access_token } = await tokenRes.json();
  const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, type: 2, start_time: startTime, duration: durationMins }),
  });
  const data = await meetingRes.json();
  return { provider: 'ZOOM', joinUrl: data.join_url, meetingId: String(data.id), mocked: false };
}

async function createTeamsMeeting({ topic, startTime, durationMins }) {
  if (!(process.env.TEAMS_ENABLED === 'true' && process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET)) {
    return mockMeeting('TEAMS', topic);
  }
  const end = new Date(new Date(startTime).getTime() + durationMins * 60000);
  const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${process.env.MS_CLIENT_ID}&client_secret=${process.env.MS_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
  });
  const { access_token } = await tokenRes.json();
  const meetingRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: topic, startDateTime: startTime, endDateTime: end.toISOString() }),
  });
  const data = await meetingRes.json();
  return { provider: 'TEAMS', joinUrl: data.joinWebUrl, meetingId: data.id, mocked: false };
}

async function createWebexMeeting({ topic, startTime, durationMins }) {
  if (!(process.env.WEBEX_ENABLED === 'true' && process.env.WEBEX_ACCESS_TOKEN)) {
    return mockMeeting('WEBEX', topic);
  }
  const end = new Date(new Date(startTime).getTime() + durationMins * 60000);
  const meetingRes = await fetch('https://webexapis.com/v1/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WEBEX_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: topic, start: new Date(startTime).toISOString(), end: end.toISOString() }),
  });
  const data = await meetingRes.json();
  return { provider: 'WEBEX', joinUrl: data.webLink, meetingId: data.id, mocked: false };
}

async function createMeeting({ provider, topic, startTime, durationMins }) {
  switch (provider) {
    case 'TEAMS':
      return createTeamsMeeting({ topic, startTime, durationMins });
    case 'WEBEX':
      return createWebexMeeting({ topic, startTime, durationMins });
    case 'ZOOM':
    default:
      return createZoomMeeting({ topic, startTime, durationMins });
  }
}

module.exports = { createMeeting };
