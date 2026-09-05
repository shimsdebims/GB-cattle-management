/**
 * SYNC METADATA MODEL
 * Tracks offline sync state per device
 * References: LAYER_1_DATA_MODEL.md, LAYER_1B_TYPES.ts
 */

const mongoose = require('mongoose');

const syncMetadataSchema = new mongoose.Schema({
  // Sync Tracking
  device_id: {
    type: String,
    required: [true, 'Device ID is required'],
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
    enum: {
      values: ['client_wins', 'server_wins', 'manual'],
      message: 'Strategy must be client_wins, server_wins, or manual',
    },
  },

  // Sync Queue
  queue_size_bytes: {
    type: Number,
    default: 0,
    min: 0,
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

// Indexes
syncMetadataSchema.index({ device_id: 1 }, { unique: true });

// Auto-update timestamp on save
syncMetadataSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model('SyncMetadata', syncMetadataSchema);
