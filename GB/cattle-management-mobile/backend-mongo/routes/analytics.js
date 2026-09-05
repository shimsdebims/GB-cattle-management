const express = require('express');
const router = express.Router();
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

// GET /api/analytics/dashboard - Get dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get cattle statistics
    const cattleStats = await Cattle.aggregate([
      {
        $group: {
          _id: null,
          total_cattle: { $sum: 1 },
          active_cattle: {
            $sum: {
              $cond: [{ $eq: ['$current_status', 'Active'] }, 1, 0]
            }
          },
          healthy_cattle: {
            $sum: {
              $cond: [{ $eq: ['$health_status', 'Healthy'] }, 1, 0]
            }
          },
          pregnant_cattle: {
            $sum: {
              $cond: [{ $eq: ['$health_status', 'Pregnant'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get milk production stats
    const milkStats = await MilkProduction.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_milk: { $sum: '$quantity_liters' },
          average_quality: { $avg: '$quality_score' },
          production_records: { $sum: 1 }
        }
      }
    ]);

    // Get financial stats
    const expenseStats = await Expense.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_expenses: { $sum: '$amount' }
        }
      }
    ]);

    const revenueStats = await Revenue.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: '$amount' }
        }
      }
    ]);

    // Get feeding stats
    const feedingStats = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_feed_cost: { $sum: '$total_cost' },
          total_feed_quantity: { $sum: '$quantity_kg' }
        }
      }
    ]);

    const totalExpenses = expenseStats[0]?.total_expenses || 0;
    const totalRevenue = revenueStats[0]?.total_revenue || 0;

    res.json({
      cattle: cattleStats[0] || {
        total_cattle: 0,
        active_cattle: 0,
        healthy_cattle: 0,
        pregnant_cattle: 0
      },
      milk_production: milkStats[0] || {
        total_milk: 0,
        average_quality: 0,
        production_records: 0
      },
      financial: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: totalRevenue - totalExpenses
      },
      feeding: feedingStats[0] || {
        total_feed_cost: 0,
        total_feed_quantity: 0
      },
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/milk-production-trends - Get milk production trends
router.get('/milk-production-trends', async (req, res) => {
  try {
    const { days = 30, cattle_id } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const matchStage = {
      date_recorded: { $gte: startDate }
    };

    if (cattle_id) {
      matchStage.cattle_id = cattle_id;
    }

    // Daily milk production trends
    const dailyTrends = await MilkProduction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          total_quantity: { $sum: '$quantity_liters' },
          average_quality: { $avg: '$quality_score' },
          record_count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Cattle performance comparison
    const cattlePerformance = await MilkProduction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$cattle_id',
          total_quantity: { $sum: '$quantity_liters' },
          average_quantity: { $avg: '$quantity_liters' },
          average_quality: { $avg: '$quality_score' },
          record_count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'cattle',
          localField: '_id',
          foreignField: '_id',
          as: 'cattle_info'
        }
      },
      {
        $unwind: '$cattle_info'
      },
      {
        $project: {
          cattle_id: '$_id',
          tag_number: '$cattle_info.tag_number',
          name: '$cattle_info.name',
          breed: '$cattle_info.breed',
          total_quantity: 1,
          average_quantity: 1,
          average_quality: 1,
          record_count: 1
        }
      },
      { $sort: { total_quantity: -1 } }
    ]);

    res.json({
      daily_trends: dailyTrends,
      cattle_performance: cattlePerformance,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching milk production trends:', error);
    res.status(500).json({ error: 'Failed to fetch milk production trends' });
  }
});

// GET /api/analytics/feeding-analysis - Get feeding cost analysis
router.get('/feeding-analysis', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Feed type cost analysis
    const feedTypeCosts = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$feed_type',
          total_cost: { $sum: '$total_cost' },
          total_quantity: { $sum: '$quantity_kg' },
          average_cost_per_unit: { $avg: '$cost_per_unit' },
          usage_count: { $sum: 1 }
        }
      },
      { $sort: { total_cost: -1 } }
    ]);

    // Daily feeding costs
    const dailyFeedingCosts = await Feeding.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          daily_cost: { $sum: '$total_cost' },
          daily_quantity: { $sum: '$quantity_kg' },
          feed_sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      feed_type_costs: feedTypeCosts,
      daily_feeding_costs: dailyFeedingCosts,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching feeding analysis:', error);
    res.status(500).json({ error: 'Failed to fetch feeding analysis' });
  }
});

module.exports = router;
