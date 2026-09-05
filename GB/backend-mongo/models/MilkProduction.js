/**
 * MILK PRODUCTION MODEL
 * Defines daily milk production records per cow
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const milkProductionSchema = new mongoose.Schema({
  // Identity
  cattle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
    required: [true, 'Cattle ID is required'],
  },
  cattle_tag: {
    type: String,
    required: [true, 'Cattle tag is required (denormalized)'],
  },

  // Production Data
  date_recorded: {
    type: Date,
    required: [true, 'Date recorded is required'],
    validate: {
      validator: function (date) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
      },
      message: 'Date cannot be in the future',
    },
  },
  quantity_liters: {
    type: Number,
    required: [true, 'Quantity in liters is required'],
    min: [0.1, 'Quantity must be greater than 0'],
    max: [50, 'Quantity must not exceed 50 liters'],
  },
  quality_score: {
    type: Number,
    min: [1, 'Quality score must be between 1 and 5'],
    max: [5, 'Quality score must be between 1 and 5'],
  },

  // Metadata
  notes: {
    type: String,
    trim: true,
  },

  // Timestamps
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },

  // Sync Fields (for offline-first architecture)
  _synced_at: {
    type: Date,
    default: Date.now,
  },
  _local_only: {
    type: Boolean,
    default: false,
  },
});

// Prevent duplicate records for same cattle on same date
milkProductionSchema.index({ cattle_id: 1, date_recorded: 1 }, { unique: true });
milkProductionSchema.index({ date_recorded: -1 });
milkProductionSchema.index({ cattle_tag: 1 });
milkProductionSchema.index({ _synced_at: 1 });

// Auto-update timestamp on save
milkProductionSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('MilkProduction', milkProductionSchema);
