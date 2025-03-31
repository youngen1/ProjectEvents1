const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Ticket = require('../models/Ticket');

// Get user's tickets
router.get('/mytickets', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id })
      .populate('event')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 