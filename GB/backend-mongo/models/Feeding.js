const mongoose = require('mongoose');

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
    enum: ['Hay', 'Corn Silage', 'Barley', 'Wheat', 'Alfalfa', 'Grass Pellets', 'Protein Supplement', 'Other']
  },
  quantity_kg: {
    type: Number,
    required: true,
    min: 0
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

// Pre-save middleware to calculate total_cost
feedingSchema.pre('save', function(next) {
  if (this.cost_per_unit && this.quantity_kg) {
    this.total_cost = this.cost_per_unit * this.quantity_kg;
  }
  next();
});

// Indexes
feedingSchema.index({ cattle_id: 1 });
feedingSchema.index({ date_recorded: -1 });
feedingSchema.index({ feed_type: 1 });

module.exports = mongoose.model('Feeding', feedingSchema);
