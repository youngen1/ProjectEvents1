const mongoose = require('mongoose');

const platformEarningSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  transaction_date: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('PlatformEarning', platformEarningSchema); 