const express = require('express');
const router = express.Router();
const MilkProduction = require('../models/MilkProduction');
const Cattle = require('../models/Cattle');

// GET /api/milk - Get all milk production records
router.get('/', async (req, res) => {
  try {
    const { cattle_id, date_from, date_to, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (cattle_id) filter.cattle_id = cattle_id;
    if (date_from || date_to) {
      filter.date_recorded = {};
      if (date_from) filter.date_recorded.$gte = new Date(date_from);
      if (date_to) filter.date_recorded.$lte = new Date(date_to);
    }

    const skip = (page - 1) * limit;
    
    const milkRecords = await MilkProduction.find(filter)
      .populate('cattle_id', 'tag_number name breed')
      .sort({ date_recorded: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await MilkProduction.countDocuments(filter);

    res.json({
      data: milkRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching milk records:', error);
    res.status(500).json({ error: 'Failed to fetch milk production records' });
  }
});

// GET /api/milk/:id - Get specific milk production record
router.get('/:id', async (req, res) => {
  try {
    const milkRecord = await MilkProduction.findById(req.params.id)
      .populate('cattle_id', 'tag_number name breed');
    
    if (!milkRecord) {
      return res.status(404).json({ error: 'Milk production record not found' });
    }

    res.json(milkRecord);
  } catch (error) {
    console.error('Error fetching milk record:', error);
    res.status(500).json({ error: 'Failed to fetch milk production record' });
  }
});

// POST /api/milk - Create new milk production record
router.post('/', async (req, res) => {
  try {
    const { cattle_id, date_recorded, quantity_liters, quality_score, notes } = req.body;

    // Validate required fields
    if (!cattle_id || !date_recorded || !quantity_liters) {
      return res.status(400).json({ 
        error: 'Missing required fields: cattle_id, date_recorded, quantity_liters' 
      });
    }

    // Check if cattle exists
    const cattle = await Cattle.findById(cattle_id);
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }

    const milkRecord = new MilkProduction({
      cattle_id,
      date_recorded: new Date(date_recorded),
      quantity_liters: parseFloat(quantity_liters),
      quality_score: quality_score ? parseFloat(quality_score) : undefined,
      notes
    });

    await milkRecord.save();
    await milkRecord.populate('cattle_id', 'tag_number name breed');

    res.status(201).json(milkRecord);
  } catch (error) {
    console.error('Error creating milk record:', error);
    res.status(500).json({ error: 'Failed to create milk production record' });
  }
});

// PUT /api/milk/:id - Update milk production record
router.put('/:id', async (req, res) => {
  try {
    const { cattle_id, date_recorded, quantity_liters, quality_score, notes } = req.body;

    const updateData = {};
    if (cattle_id) updateData.cattle_id = cattle_id;
    if (date_recorded) updateData.date_recorded = new Date(date_recorded);
    if (quantity_liters !== undefined) updateData.quantity_liters = parseFloat(quantity_liters);
    if (quality_score !== undefined) updateData.quality_score = parseFloat(quality_score);
    if (notes !== undefined) updateData.notes = notes;

    const milkRecord = await MilkProduction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('cattle_id', 'tag_number name breed');

    if (!milkRecord) {
      return res.status(404).json({ error: 'Milk production record not found' });
    }

    res.json(milkRecord);
  } catch (error) {
    console.error('Error updating milk record:', error);
    res.status(500).json({ error: 'Failed to update milk production record' });
  }
});

// DELETE /api/milk/:id - Delete milk production record
router.delete('/:id', async (req, res) => {
  try {
    const milkRecord = await MilkProduction.findByIdAndDelete(req.params.id);

    if (!milkRecord) {
      return res.status(404).json({ error: 'Milk production record not found' });
    }

    res.json({ message: 'Milk production record deleted successfully' });
  } catch (error) {
    console.error('Error deleting milk record:', error);
    res.status(500).json({ error: 'Failed to delete milk production record' });
  }
});

// GET /api/milk/summary - Get milk production summary
router.get('/summary/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const summary = await MilkProduction.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_quantity: { $sum: '$quantity_liters' },
          average_quantity: { $avg: '$quantity_liters' },
          average_quality: { $avg: '$quality_score' },
          record_count: { $sum: 1 }
        }
      }
    ]);

    const dailyProduction = await MilkProduction.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          daily_quantity: { $sum: '$quantity_liters' },
          daily_average_quality: { $avg: '$quality_score' },
          record_count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      summary: summary[0] || {
        total_quantity: 0,
        average_quantity: 0,
        average_quality: 0,
        record_count: 0
      },
      daily_production: dailyProduction,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching milk summary:', error);
    res.status(500).json({ error: 'Failed to fetch milk production summary' });
  }
});

module.exports = router;
