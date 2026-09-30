const mongoose = require('mongoose');

/**
 * Milk price history.
 *
 * Each entry is the price in force from `effective_from` until the next entry.
 * A milk day is valued at the price in force on that day, so changing the price
 * never rewrites income that has already been earned.
 */
const milkPriceSchema = new mongoose.Schema(
  {
    // Calendar date at UTC midnight, like every other record date.
    effective_from: {
      type: Date,
      required: true,
      unique: true,
    },
    price_per_liter: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('MilkPrice', milkPriceSchema);
