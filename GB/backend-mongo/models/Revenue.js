/**
 * REVENUE MODEL
 * Tracks all farm income sources
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  // Classification
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: {
      values: ['Milk', 'Cattle_Sale', 'Subsidy', 'Other'],
      message:
        'Source must be one of: Milk, Cattle_Sale, Subsidy, Other',
    },
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description must not exceed 200 characters'],
  },

  // Amount
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  currency: {
    type: String,
    default: 'BIF',
    enum: ['BIF'],
  },

  // Metadata
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

// Indexes
revenueSchema.index({ date_recorded: -1 });
revenueSchema.index({ source: 1 });
revenueSchema.index({ _synced_at: 1 });

// Auto-update timestamp on save
revenueSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Revenue', revenueSchema);
