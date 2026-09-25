const express = require('express');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER'));

router.get('/status', async (req, res) => {
  const config = await prisma.studioConfig.findUnique({ where: { id: 1 } });
  res.json({
    zoom: { enabled: process.env.ZOOM_ENABLED === 'true' && Boolean(process.env.ZOOM_ACCOUNT_ID) },
    teams: { enabled: process.env.TEAMS_ENABLED === 'true' && Boolean(process.env.MS_TENANT_ID) },
    webex: { enabled: process.env.WEBEX_ENABLED === 'true' && Boolean(process.env.WEBEX_ACCESS_TOKEN) },
    whatsapp: { enabled: process.env.WHATSAPP_ENABLED === 'true' && Boolean(process.env.WHATSAPP_TOKEN) },
    email: { enabled: process.env.EMAIL_ENABLED === 'true' && Boolean(process.env.SENDGRID_API_KEY) },
    razorpay: { enabled: process.env.RAZORPAY_ENABLED === 'true' && Boolean(process.env.RAZORPAY_KEY_ID) },
    googleCalendar: { enabled: Boolean(config?.googleCalendarRefreshToken) },
    geoip: { enabled: true }, // real, ungated
    storage: { enabled: true }, // real, ungated
  });
});

module.exports = router;
