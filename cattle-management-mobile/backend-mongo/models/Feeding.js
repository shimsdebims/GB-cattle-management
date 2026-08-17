const mongoose = require('mongoose');
const { FEED_TYPES, LIMITS } = require('../constants/domain');

const feedingSchema = new mongoose.Schema({
  cattle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
    required: true
  },
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  feed_type: {
    type: String,
    required: true,
    enum: FEED_TYPES,
  },
  quantity_kg: {
    type: Number,
    required: true,
    min: 0,
    max: LIMITS.FEED_QUANTITY_MAX,
  },
  cost_per_unit: {
    type: Number,
    min: 0
  },
  total_cost: {
    type: Number,
    min: 0
  },
  supplier: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

/**
 * total_cost is always derived from quantity × unit cost.
 *
 * Exposed as a static (rather than hidden in an update hook) because `save`
 * hooks never run for findByIdAndUpdate, and query-middleware workarounds are
 * easy to get subtly wrong. Routes call this explicitly, mirroring how expense
 * amounts are resolved.
 */
feedingSchema.statics.deriveTotalCost = function ({ quantity_kg, cost_per_unit }) {
  if (quantity_kg == null || cost_per_unit == null) return undefined;
  return quantity_kg * cost_per_unit;
};

// Keep create/save consistent for any code path that builds a document directly.
feedingSchema.pre('save', function (next) {
  if (this.cost_per_unit != null && this.quantity_kg != null) {
    this.total_cost = this.cost_per_unit * this.quantity_kg;
  }
  next();
});

// Indexes
feedingSchema.index({ cattle_id: 1, date_recorded: -1 });
feedingSchema.index({ date_recorded: -1 });
feedingSchema.index({ feed_type: 1 });

module.exports = mongoose.model('Feeding', feedingSchema);
