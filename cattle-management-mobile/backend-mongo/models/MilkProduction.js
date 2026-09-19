const mongoose = require('mongoose');
const { LIMITS } = require('../constants/domain');

const milkProductionSchema = new mongoose.Schema({
  cattle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
    required: true
  },
  // Normalized to midnight UTC on save so one cow has at most one record per
  // calendar day. See the pre-validate hook and the unique index below.
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  quantity_liters: {
    type: Number,
    required: true,
    min: 0,
    max: LIMITS.MILK_QUANTITY_MAX,
  },
  quality_score: {
    type: Number,
    min: LIMITS.QUALITY_SCORE_MIN,
    max: LIMITS.QUALITY_SCORE_MAX,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: LIMITS.NOTES_MAX,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

/** Strip the time component so duplicate-day detection is reliable. */
function startOfUtcDay(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

milkProductionSchema.pre('validate', function (next) {
  if (this.date_recorded) {
    this.date_recorded = startOfUtcDay(this.date_recorded);
  }
  next();
});

// Mutate the update document directly — `this.set(...)` is ignored when the
// update has no `$set` operator, which silently skipped normalization on edit.
milkProductionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const target = update.$set || update;
  if (target.date_recorded) {
    target.date_recorded = startOfUtcDay(target.date_recorded);
    this.setUpdate(update);
  }
  next();
});

// One record per cow per day, enforced by the database rather than by hope.
milkProductionSchema.index({ cattle_id: 1, date_recorded: 1 }, { unique: true });
// Supports month-range scans and the newest-first list query.
milkProductionSchema.index({ date_recorded: -1 });

milkProductionSchema.statics.startOfUtcDay = startOfUtcDay;

module.exports = mongoose.model('MilkProduction', milkProductionSchema);
