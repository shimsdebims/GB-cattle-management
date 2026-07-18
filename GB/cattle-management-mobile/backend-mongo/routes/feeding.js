const express = require('express');
const router = express.Router();
const Feeding = require('../models/Feeding');
const Cattle = require('../models/Cattle');

// GET /api/feeding - Get all feeding records
router.get('/', async (req, res) => {
  try {
    const { cattle_id, feed_type, date_from, date_to, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (cattle_id) filter.cattle_id = cattle_id;
    if (feed_type) filter.feed_type = new RegExp(feed_type, 'i');
    if (date_from || date_to) {
      filter.date_recorded = {};
      if (date_from) filter.date_recorded.$gte = new Date(date_from);
      if (date_to) filter.date_recorded.$lte = new Date(date_to);
    }

    const skip = (page - 1) * limit;
    
    const feedingRecords = await Feeding.find(filter)
      .populate('cattle_id', 'tag_number name breed')
      .sort({ date_recorded: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Feeding.countDocuments(filter);

    res.json({
      data: feedingRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching feeding records:', error);
    res.status(500).json({ error: 'Failed to fetch feeding records' });
  }
});

// GET /api/feeding/:id - Get specific feeding record
router.get('/:id', async (req, res) => {
  try {
    const feedingRecord = await Feeding.findById(req.params.id)
      .populate('cattle_id', 'tag_number name breed');
    
    if (!feedingRecord) {
      return res.status(404).json({ error: 'Feeding record not found' });
    }

    res.json(feedingRecord);
  } catch (error) {
    console.error('Error fetching feeding record:', error);
    res.status(500).json({ error: 'Failed to fetch feeding record' });
  }
});

// POST /api/feeding - Create new feeding record
router.post('/', async (req, res) => {
  try {
    const { 
      cattle_id, 
      date_recorded, 
      feed_type, 
      quantity_kg, 
      cost_per_unit, 
      supplier, 
      notes 
    } = req.body;

    // Validate required fields
    if (!cattle_id || !date_recorded || !feed_type || !quantity_kg) {
      return res.status(400).json({ 
        error: 'Missing required fields: cattle_id, date_recorded, feed_type, quantity_kg' 
      });
    }

    // Check if cattle exists
    const cattle = await Cattle.findById(cattle_id);
    if (!cattle) {
      return res.status(404).json({ error: 'Cattle not found' });
    }

    const feedingRecord = new Feeding({
      cattle_id,
      date_recorded: new Date(date_recorded),
      feed_type,
      quantity_kg: parseFloat(quantity_kg),
      cost_per_unit: cost_per_unit ? parseFloat(cost_per_unit) : undefined,
      supplier,
      notes
    });

    await feedingRecord.save();
    await feedingRecord.populate('cattle_id', 'tag_number name breed');

    res.status(201).json(feedingRecord);
  } catch (error) {
    console.error('Error creating feeding record:', error);
    res.status(500).json({ error: 'Failed to create feeding record' });
  }
});

// PUT /api/feeding/:id - Update feeding record
router.put('/:id', async (req, res) => {
  try {
    const { 
      cattle_id, 
      date_recorded, 
      feed_type, 
      quantity_kg, 
      cost_per_unit, 
      supplier, 
      notes 
    } = req.body;

    const updateData = {};
    if (cattle_id) updateData.cattle_id = cattle_id;
    if (date_recorded) updateData.date_recorded = new Date(date_recorded);
    if (feed_type) updateData.feed_type = feed_type;
    if (quantity_kg !== undefined) updateData.quantity_kg = parseFloat(quantity_kg);
    if (cost_per_unit !== undefined) updateData.cost_per_unit = parseFloat(cost_per_unit);
    if (supplier !== undefined) updateData.supplier = supplier;
    if (notes !== undefined) updateData.notes = notes;

    const feedingRecord = await Feeding.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('cattle_id', 'tag_number name breed');

    if (!feedingRecord) {
      return res.status(404).json({ error: 'Feeding record not found' });
    }

    res.json(feedingRecord);
  } catch (error) {
    console.error('Error updating feeding record:', error);
    res.status(500).json({ error: 'Failed to update feeding record' });
  }
});

// DELETE /api/feeding/:id - Delete feeding record
router.delete('/:id', async (req, res) => {
  try {
    const feedingRecord = await Feeding.findByIdAndDelete(req.params.id);

    if (!feedingRecord) {
      return res.status(404).json({ error: 'Feeding record not found' });
    }

    res.json({ message: 'Feeding record deleted successfully' });
  } catch (error) {
    console.error('Error deleting feeding record:', error);
    res.status(500).json({ error: 'Failed to delete feeding record' });
  }
});

// GET /api/feeding/summary - Get feeding summary and analytics
router.get('/summary/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const summary = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_quantity: { $sum: '$quantity_kg' },
          total_cost: { $sum: '$total_cost' },
          average_cost_per_unit: { $avg: '$cost_per_unit' },
          record_count: { $sum: 1 }
        }
      }
    ]);

    const feedTypeBreakdown = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$feed_type',
          total_quantity: { $sum: '$quantity_kg' },
          total_cost: { $sum: '$total_cost' },
          average_cost: { $avg: '$cost_per_unit' },
          record_count: { $sum: 1 }
        }
      },
      {
        $sort: { total_cost: -1 }
      }
    ]);

    const dailyFeeding = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          daily_quantity: { $sum: '$quantity_kg' },
          daily_cost: { $sum: '$total_cost' },
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
        total_cost: 0,
        average_cost_per_unit: 0,
        record_count: 0
      },
      feed_type_breakdown: feedTypeBreakdown,
      daily_feeding: dailyFeeding,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching feeding summary:', error);
    res.status(500).json({ error: 'Failed to fetch feeding summary' });
  }
});

module.exports = router;
