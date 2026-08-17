const mongoose = require('mongoose');
const {
  BREEDS,
  GENDERS,
  HEALTH_STATUSES,
  CATTLE_STATUSES,
  LIMITS,
} = require('../constants/domain');

const cattleSchema = new mongoose.Schema({
  tag_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: LIMITS.TAG_NUMBER_MIN,
    maxlength: LIMITS.TAG_NUMBER_MAX,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: LIMITS.NAME_MAX,
  },
  breed: {
    type: String,
    required: true,
    enum: BREEDS,
  },
  date_of_birth: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => value <= new Date(),
      message: 'Date of birth cannot be in the future',
    },
  },
  gender: {
    type: String,
    required: true,
    enum: GENDERS,
  },
  weight: {
    type: Number,
    min: 0,
    max: LIMITS.CATTLE_WEIGHT_MAX,
  },
  health_status: {
    type: String,
    default: 'Healthy',
    enum: HEALTH_STATUSES,
  },
  location: {
    type: String,
    trim: true
  },
  purchase_date: {
    type: Date
  },
  purchase_price: {
    type: Number,
    min: 0
  },
  current_status: {
    type: String,
    default: 'Active',
    enum: CATTLE_STATUSES,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: LIMITS.NOTES_MAX,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// NOTE: `tag_number` is already indexed by `unique: true` above; re-declaring it
// would create a duplicate index.
// Compound index serves the default list query (filter by status, newest first).
cattleSchema.index({ current_status: 1, created_at: -1 });
cattleSchema.index({ health_status: 1 });
cattleSchema.index({ breed: 1 });

// Virtual for age calculation
cattleSchema.virtual('age_in_months').get(function() {
  if (!this.date_of_birth) return null;
  const today = new Date();
  const birth = this.date_of_birth;
  return (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
});

// Ensure virtual fields are serialized
cattleSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Cattle', cattleSchema);
