const mongoose = require('mongoose');
const { REVENUE_SOURCES, LIMITS } = require('../constants/domain');

/**
 * Manual (non-milk) income only. Milk income is derived from production ×
 * `Settings.milk_price_per_liter`, so recording it here would double-count it.
 */
const revenueSchema = new mongoose.Schema({
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  source: {
    type: String,
    required: true,
    enum: REVENUE_SOURCES,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: LIMITS.DESCRIPTION_MAX,
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Set for a cattle sale, so the cow's card can show what it sold for.
  cattle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: LIMITS.NOTES_MAX,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
revenueSchema.index({ date_recorded: -1 });
revenueSchema.index({ source: 1, date_recorded: -1 });
revenueSchema.index({ cattle_id: 1 }, { sparse: true });

module.exports = mongoose.model('Revenue', revenueSchema);
