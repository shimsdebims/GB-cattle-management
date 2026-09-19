const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES, LIMITS } = require('../constants/domain');

const expenseSchema = new mongoose.Schema({
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  category: {
    type: String,
    required: true,
    enum: EXPENSE_CATEGORIES,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: LIMITS.DESCRIPTION_MAX,
  },
  quantity: {
    type: Number,
    min: 0,
  },
  cost_per_unit: {
    type: Number,
    min: 0,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  supplier: {
    type: String,
    trim: true,
  },
  receipt_number: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: LIMITS.NOTES_MAX,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes — date_recorded leads because every financial query is month-scoped.
expenseSchema.index({ date_recorded: -1 });
expenseSchema.index({ category: 1, date_recorded: -1 });
expenseSchema.index({ supplier: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
