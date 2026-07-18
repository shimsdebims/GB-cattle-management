const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  date_recorded: {
    type: Date,
    required: true,
    default: Date.now
  },
  source: {
    type: String,
    required: true,
    enum: ['Milk Sales', 'Cattle Sales', 'Breeding Services', 'Manure Sales', 'Other']
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
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
revenueSchema.index({ date_recorded: -1 });
revenueSchema.index({ source: 1 });

module.exports = mongoose.model('Revenue', revenueSchema);
