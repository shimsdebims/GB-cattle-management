/**
 * LAYER 2A: MongoDB Models (Mongoose)
 * 
 * These models match exactly with:
 * - LAYER_1_DATA_MODEL.md (schema & validation)
 * - LAYER_1B_TYPES.ts (TypeScript interfaces)
 * 
 * All models include:
 * - Sync fields (_synced_at, _local_only)
 * - Proper indexes
 * - Validation rules
 * - Timestamps
 */

// ============================================================================
// 1. CATTLE MODEL
// ============================================================================

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

  // Sync Fields (for offline-first)
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
cattleSchema.index({ tag_number: 1 }, { unique: true });
cattleSchema.index({ status: 1 });
cattleSchema.index({ updated_at: -1 });
cattleSchema.index({ _synced_at: 1 });

// Update timestamps
cattleSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Cattle', cattleSchema);

// ============================================================================
// 2. MILK PRODUCTION MODEL
// ============================================================================

const milkSchema = new mongoose.Schema({
  // Identity
  cattle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cattle',
    required: [true, 'Cattle ID is required'],
  },
  cattle_tag: {
    type: String,
    required: [true, 'Cattle tag is required (denormalized)'],
  },

  // Production Data
  date_recorded: {
    type: Date,
    required: [true, 'Date recorded is required'],
    validate: {
      validator: function (date) {
        // Allow today but not future dates
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
      },
      message: 'Date cannot be in the future',
    },
  },
  quantity_liters: {
    type: Number,
    required: [true, 'Quantity in liters is required'],
    min: [0.1, 'Quantity must be greater than 0'],
    max: [50, 'Quantity must not exceed 50 liters'],
  },
  quality_score: {
    type: Number,
    min: [1, 'Quality score must be between 1 and 5'],
    max: [5, 'Quality score must be between 1 and 5'],
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

  // Sync Fields
  _synced_at: {
    type: Date,
    default: Date.now,
  },
  _local_only: {
    type: Boolean,
    default: false,
  },
});

// Prevent duplicate records for same cattle on same date
milkSchema.index({ cattle_id: 1, date_recorded: 1 }, { unique: true });
milkSchema.index({ date_recorded: -1 });
milkSchema.index({ cattle_tag: 1 });
milkSchema.index({ _synced_at: 1 });

milkSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('MilkProduction', milkSchema);

// ============================================================================
// 3. EXPENSES MODEL
// ============================================================================

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

  // Sync Fields
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

expenseSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);

// ============================================================================
// 4. REVENUE MODEL
// ============================================================================

const revenueSchema = new mongoose.Schema({
  // Classification
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: {
      values: ['Milk', 'Cattle_Sale', 'Subsidy', 'Other'],
      message:
        'Source must be one of: Milk, Cattle_Sale, Subsidy, Other',
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

  // Metadata
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

  // Sync Fields
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
revenueSchema.index({ date_recorded: -1 });
revenueSchema.index({ source: 1 });
revenueSchema.index({ _synced_at: 1 });

revenueSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Revenue', revenueSchema);

// ============================================================================
// 5. SETTINGS MODEL
// ============================================================================

const settingsSchema = new mongoose.Schema({
  // Configuration
  farm_id: {
    type: String,
    required: true,
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

settingsSchema.index({ farm_id: 1 }, { unique: true });

settingsSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);

// ============================================================================
// 6. SYNC METADATA MODEL
// ============================================================================

const syncMetadataSchema = new mongoose.Schema({
  // Sync Tracking
  device_id: {
    type: String,
    required: true,
    unique: true,
  },
  last_sync: {
    type: Date,
    default: Date.now,
  },
  pending_count: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Conflict Resolution
  conflict_strategy: {
    type: String,
    default: 'client_wins',
    enum: ['client_wins', 'server_wins', 'manual'],
  },

  // Sync Queue
  queue_size_bytes: {
    type: Number,
    default: 0,
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
});

syncMetadataSchema.index({ device_id: 1 }, { unique: true });

syncMetadataSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('SyncMetadata', syncMetadataSchema);

// ============================================================================
// Usage in Routes:
//
// const Cattle = require('./models/Cattle');
// const MilkProduction = require('./models/MilkProduction');
// const Expense = require('./models/Expense');
// const Revenue = require('./models/Revenue');
// const Settings = require('./models/Settings');
// const SyncMetadata = require('./models/SyncMetadata');
//
// ============================================================================
