const express = require('express');
const router = express.Router();
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');

// GET /api/cattle - Get all cattle
router.get('/', async (req, res) => {
  try {
    const { status, health, breed, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (status) filter.current_status = status;
    if (health) filter.health_status = health;
    if (breed) filter.breed = breed;

    const skip = (page - 1) * limit;
    
    const cattle = await Cattle.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Cattle.countDocuments(filter);

    res.json({
      data: cattle,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cattle/:id - Get single cattle
router.get('/:id', async (req, res) => {
  try {
    const cattle = await Cattle.findById(req.params.id);
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }
    res.json(cattle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cattle - Create new cattle
router.post('/', async (req, res) => {
  try {
    const cattle = new Cattle(req.body);
    await cattle.save();
    res.status(201).json(cattle);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Tag number already exists' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// PUT /api/cattle/:id - Update cattle
router.put('/:id', async (req, res) => {
  try {
    const cattle = await Cattle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }
    
    res.json(cattle);
  } catch (error) {
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// DELETE /api/cattle/:id - Delete cattle
router.delete('/:id', async (req, res) => {
  try {
    const cattle = await Cattle.findById(req.params.id);
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }

    // Delete related records
    await MilkProduction.deleteMany({ cattle_id: req.params.id });
    await Feeding.deleteMany({ cattle_id: req.params.id });
    
    await Cattle.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Cattle and related records deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cattle/:id/summary - Get cattle summary with related data
router.get('/:id/summary', async (req, res) => {
  try {
    const cattle = await Cattle.findById(req.params.id);
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get milk production for last 30 days
    const milkRecords = await MilkProduction.find({
      cattle_id: req.params.id,
      date_recorded: { $gte: thirtyDaysAgo }
    }).sort({ date_recorded: -1 });

    // Get feeding records for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const feedingRecords = await Feeding.find({
      cattle_id: req.params.id,
      date_recorded: { $gte: sevenDaysAgo }
    }).sort({ date_recorded: -1 });

    // Calculate totals
    const totalMilk = milkRecords.reduce((sum, record) => sum + record.quantity_liters, 0);
    const averageDailyMilk = milkRecords.length > 0 ? totalMilk / 30 : 0;
    const totalFeedCost = feedingRecords.reduce((sum, record) => sum + (record.total_cost || 0), 0);

    res.json({
      cattle,
      summary: {
        milk_production: {
          total_liters_30_days: totalMilk,
          average_daily_liters: averageDailyMilk,
          record_count: milkRecords.length
        },
        feeding: {
          total_cost_7_days: totalFeedCost,
          record_count: feedingRecords.length
        }
      },
      recent_milk_records: milkRecords.slice(0, 10),
      recent_feeding_records: feedingRecords.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
