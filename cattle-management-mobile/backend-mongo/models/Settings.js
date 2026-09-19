const mongoose = require('mongoose');
const { DEFAULTS } = require('../constants/domain');

// Singleton settings document for the farm
const settingsSchema = new mongoose.Schema({
  milk_price_per_liter: {
    type: Number,
    required: true,
    default: DEFAULTS.MILK_PRICE_PER_LITER,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    default: DEFAULTS.CURRENCY,
    trim: true,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

/** Fetch (creating on first call) the one settings document. */
settingsSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

module.exports = mongoose.model('Settings', settingsSchema);
