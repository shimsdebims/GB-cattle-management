const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  category: {
    type: String,
    required: true,
    enum: ['Feed', 'Veterinary', 'Equipment', 'Maintenance', 'Utilities', 'Labor', 'Insurance', 'Other']
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: String,
    trim: true
  },
  receipt_number: {
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

// Indexes
expenseSchema.index({ date_recorded: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ supplier: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
