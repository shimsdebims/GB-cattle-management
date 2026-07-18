const mongoose = require('mongoose');

const cattleSchema = new mongoose.Schema({
  tag_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  breed: {
    type: String,
    required: true,
    enum: ['Holstein', 'Jersey', 'Angus', 'Hereford', 'Brahman', 'Simmental', 'Charolais', 'Other']
  },
  date_of_birth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female']
  },
  weight: {
    type: Number,
    min: 0
  },
  health_status: {
    type: String,
    default: 'Healthy',
    enum: ['Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering']
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
    enum: ['Active', 'Sold', 'Deceased', 'Quarantined']
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for better query performance
cattleSchema.index({ tag_number: 1 });
cattleSchema.index({ current_status: 1 });
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
