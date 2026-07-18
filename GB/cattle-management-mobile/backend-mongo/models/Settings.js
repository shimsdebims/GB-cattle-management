/**
 * SETTINGS MODEL
 * Stores farm-wide configuration
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Configuration
  farm_id: {
    type: String,
    required: [true, 'Farm ID is required'],
    unique: true,
  },
  farm_name: {
    type: String,
    required: [true, 'Farm name is required'],
  },

  // Financial
  milk_price_per_liter: {
    type: Number,
    default: 1700,
    min: [1, 'Price must be greater than 0'],
  },
  currency: {
    type: String,
    default: 'BIF',
    enum: ['BIF'],
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
  last_sync: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
settingsSchema.index({ farm_id: 1 }, { unique: true });

// Auto-update timestamp on save
settingsSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
