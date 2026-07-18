const mongoose = require('mongoose');

const milkProductionSchema = new mongoose.Schema({
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
  quantity_liters: {
    type: Number,
    required: true,
    min: 0
  },
  quality_score: {
    type: Number,
    min: 0,
    max: 10
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
milkProductionSchema.index({ cattle_id: 1 });
milkProductionSchema.index({ date_recorded: -1 });
milkProductionSchema.index({ cattle_id: 1, date_recorded: -1 });

module.exports = mongoose.model('MilkProduction', milkProductionSchema);
