const express = require('express');
const router = express.Router();

const Settings = require('../models/Settings');
const { ok, asyncHandler, validationMiddleware } = require('../middleware');

// GET /api/settings — creates the singleton on first call
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    return ok(res, settings.toJSON());
  })
);

// PUT /api/settings
router.put(
  '/',
  validationMiddleware('settings'),
  asyncHandler(async (req, res) => {
    const { milk_price_per_liter, currency } = req.body;

    const settings = await Settings.getSingleton();
    if (milk_price_per_liter !== undefined) {
      settings.milk_price_per_liter = Number(milk_price_per_liter);
    }
    if (currency !== undefined) {
      settings.currency = String(currency).trim();
    }
    await settings.save();

    return ok(res, settings.toJSON(), 'Settings updated');
  })
);

module.exports = router;
