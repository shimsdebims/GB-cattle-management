/**
 * CATTLE MODEL
 * Defines cattle/cow records
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const cattleSchema = new mongoose.Schema({
  // Identity
  tag_number: {
    type: String,
    required: [true, 'Tag number is required'],
    unique: true,
    trim: true,
    minlength: [5, 'Tag number must be at least 5 characters'],
    maxlength: [20, 'Tag number must not exceed 20 characters'],
  },
  name: {
    type: String,
    required: [true, 'Cattle name is required'],
    trim: true,
    maxlength: [100, 'Name must not exceed 100 characters'],
  },

  // Basic Info
  breed: {
    type: String,
    required: [true, 'Breed is required'],
    trim: true,
    maxlength: [50, 'Breed must not exceed 50 characters'],
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['Male', 'Female'],
      message: 'Gender must be either Male or Female',
    },
  },
  date_of_birth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function (date) {
        return date <= new Date();
      },
      message: 'Date of birth cannot be in the future',
    },
  },

  // Status
  status: {
    type: String,
    default: 'Active',
    enum: {
      values: ['Active', 'Sold', 'Deceased'],
      message: 'Status must be Active, Sold, or Deceased',
    },
  },
  health_status: {
    type: String,
    enum: {
      values: ['Healthy', 'Sick', 'Resting', null],
      message: 'Health status must be Healthy, Sick, or Resting',
    },
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

// Indexes for performance
cattleSchema.index({ tag_number: 1 }, { unique: true });
cattleSchema.index({ status: 1 });
cattleSchema.index({ updated_at: -1 });
cattleSchema.index({ _synced_at: 1 });

// Auto-update timestamp on save
cattleSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Cattle', cattleSchema);
