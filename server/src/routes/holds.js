const express = require('express');
const seatHold = require('../lib/seatHold');

const router = express.Router();

// DELETE /api/holds/:holdToken — release a seat hold early (e.g. user
// deselects/cancels before the TTL expires on its own).
router.delete('/:holdToken', async (req, res) => {
  await seatHold.releaseHold(req.params.holdToken);
  res.status(204).end();
});

module.exports = router;
