/**
 * EXPENSE MODEL
 * Tracks all farm expenses by category
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Classification
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Feed', 'Staff', 'Medical', 'Tax', 'Insurance', 'Other'],
      message:
        'Category must be one of: Feed, Staff, Medical, Tax, Insurance, Other',
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

  // Date & Tracking
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
  supplier: {
    type: String,
    trim: true,
  },
  receipt_number: {
    type: String,
    trim: true,
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

// Indexes
expenseSchema.index({ date_recorded: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ date_recorded: 1, category: 1 });
expenseSchema.index({ _synced_at: 1 });

// Auto-update timestamp on save
expenseSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
