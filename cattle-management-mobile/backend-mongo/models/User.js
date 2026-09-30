const mongoose = require('mongoose');
const { LIMITS } = require('../constants/domain');

/**
 * App users. One owner today; `role` leaves room for workers later without a
 * schema change.
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: LIMITS.USERNAME_MIN,
      maxlength: LIMITS.USERNAME_MAX,
    },
    // scrypt$<salt hex>$<hash hex> — never the password itself.
    password_hash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'worker'],
      default: 'owner',
    },
    // Bumped on password change; tokens carry it, so old tokens stop working.
    token_version: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password_hash;
    delete ret.token_version;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
