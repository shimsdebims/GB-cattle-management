const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

// EXPENSE ROUTES

// GET /api/financial/expenses - Get all expenses
router.get('/expenses', async (req, res) => {
  try {
    const { category, date_from, date_to, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (category) filter.category = new RegExp(category, 'i');
    if (date_from || date_to) {
      filter.date_recorded = {};
      if (date_from) filter.date_recorded.$gte = new Date(date_from);
      if (date_to) filter.date_recorded.$lte = new Date(date_to);
    }

    const skip = (page - 1) * limit;
    
    const expenses = await Expense.find(filter)
      .sort({ date_recorded: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Expense.countDocuments(filter);

    res.json({
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/financial/expenses/:id - Get specific expense
router.get('/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// POST /api/financial/expenses - Create new expense
router.post('/expenses', async (req, res) => {
  try {
    const { 
      date_recorded, 
      category, 
      description, 
      amount, 
      supplier, 
      receipt_number, 
      notes 
    } = req.body;

    // Validate required fields
    if (!date_recorded || !category || !description || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: date_recorded, category, description, amount' 
      });
    }

    const expense = new Expense({
      date_recorded: new Date(date_recorded),
      category,
      description,
      amount: parseFloat(amount),
      supplier,
      receipt_number,
      notes
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/financial/expenses/:id - Update expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const { 
      date_recorded, 
      category, 
      description, 
      amount, 
      supplier, 
      receipt_number, 
      notes 
    } = req.body;

    const updateData = {};
    if (date_recorded) updateData.date_recorded = new Date(date_recorded);
    if (category) updateData.category = category;
    if (description) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (supplier !== undefined) updateData.supplier = supplier;
    if (receipt_number !== undefined) updateData.receipt_number = receipt_number;
    if (notes !== undefined) updateData.notes = notes;

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/financial/expenses/:id - Delete expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// REVENUE ROUTES

// GET /api/financial/revenue - Get all revenue records
router.get('/revenue', async (req, res) => {
  try {
    const { source, date_from, date_to, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (source) filter.source = new RegExp(source, 'i');
    if (date_from || date_to) {
      filter.date_recorded = {};
      if (date_from) filter.date_recorded.$gte = new Date(date_from);
      if (date_to) filter.date_recorded.$lte = new Date(date_to);
    }

    const skip = (page - 1) * limit;
    
    const revenues = await Revenue.find(filter)
      .sort({ date_recorded: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Revenue.countDocuments(filter);

    res.json({
      data: revenues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue records' });
  }
});

// GET /api/financial/revenue/:id - Get specific revenue record
router.get('/revenue/:id', async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    
    if (!revenue) {
      return res.status(404).json({ error: 'Revenue record not found' });
    }

    res.json(revenue);
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue record' });
  }
});

// POST /api/financial/revenue - Create new revenue record
router.post('/revenue', async (req, res) => {
  try {
    const { date_recorded, source, description, amount, notes } = req.body;

    // Validate required fields
    if (!date_recorded || !source || !description || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: date_recorded, source, description, amount' 
      });
    }

    const revenue = new Revenue({
      date_recorded: new Date(date_recorded),
      source,
      description,
      amount: parseFloat(amount),
      notes
    });

    await revenue.save();
    res.status(201).json(revenue);
  } catch (error) {
    console.error('Error creating revenue:', error);
    res.status(500).json({ error: 'Failed to create revenue record' });
  }
});

// PUT /api/financial/revenue/:id - Update revenue record
router.put('/revenue/:id', async (req, res) => {
  try {
    const { date_recorded, source, description, amount, notes } = req.body;

    const updateData = {};
    if (date_recorded) updateData.date_recorded = new Date(date_recorded);
    if (source) updateData.source = source;
    if (description) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (notes !== undefined) updateData.notes = notes;

    const revenue = await Revenue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!revenue) {
      return res.status(404).json({ error: 'Revenue record not found' });
    }

    res.json(revenue);
  } catch (error) {
    console.error('Error updating revenue:', error);
    res.status(500).json({ error: 'Failed to update revenue record' });
  }
});

// DELETE /api/financial/revenue/:id - Delete revenue record
router.delete('/revenue/:id', async (req, res) => {
  try {
    const revenue = await Revenue.findByIdAndDelete(req.params.id);

    if (!revenue) {
      return res.status(404).json({ error: 'Revenue record not found' });
    }

    res.json({ message: 'Revenue record deleted successfully' });
  } catch (error) {
    console.error('Error deleting revenue:', error);
    res.status(500).json({ error: 'Failed to delete revenue record' });
  }
});

// FINANCIAL SUMMARY AND ANALYTICS

// GET /api/financial/summary - Get financial summary
router.get('/summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get expense summary
    const expenseSummary = await Expense.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_expenses: { $sum: '$amount' },
          expense_count: { $sum: 1 }
        }
      }
    ]);

    // Get revenue summary
    const revenueSummary = await Revenue.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: '$amount' },
          revenue_count: { $sum: 1 }
        }
      }
    ]);

    // Get expense breakdown by category
    const expenseByCategory = await Expense.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$category',
          total_amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total_amount: -1 }
      }
    ]);

    // Get revenue breakdown by source
    const revenueBySource = await Revenue.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$source',
          total_amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total_amount: -1 }
      }
    ]);

    // Calculate profit/loss
    const totalExpenses = expenseSummary[0]?.total_expenses || 0;
    const totalRevenue = revenueSummary[0]?.total_revenue || 0;
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      summary: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        revenue_count: revenueSummary[0]?.revenue_count || 0,
        expense_count: expenseSummary[0]?.expense_count || 0
      },
      expense_by_category: expenseByCategory,
      revenue_by_source: revenueBySource,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

// GET /api/financial/trends - Get financial trends over time
router.get('/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily expense trends
    const dailyExpenses = await Expense.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          daily_expenses: { $sum: '$amount' },
          expense_count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Daily revenue trends
    const dailyRevenue = await Revenue.aggregate([
      {
        $match: {
          date_recorded: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_recorded' } },
          daily_revenue: { $sum: '$amount' },
          revenue_count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      daily_expenses: dailyExpenses,
      daily_revenue: dailyRevenue,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching financial trends:', error);
    res.status(500).json({ error: 'Failed to fetch financial trends' });
  }
});

module.exports = router;
