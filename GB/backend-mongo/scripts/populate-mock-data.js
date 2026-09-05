const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Cattle = require('../models/Cattle');
const MilkProduction = require('../models/MilkProduction');
const Feeding = require('../models/Feeding');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');

// Mock data constants
const BREEDS = ['Holstein', 'Jersey', 'Angus', 'Hereford', 'Brahman', 'Simmental', 'Charolais'];
const HEALTH_STATUSES = ['Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering'];
const CURRENT_STATUSES = ['Active', 'Sold', 'Deceased', 'Quarantined'];
const LOCATIONS = ['Barn A', 'Barn B', 'Pasture 1', 'Pasture 2', 'Quarantine Area'];
const FEED_TYPES = ['Hay', 'Corn Silage', 'Barley', 'Wheat', 'Alfalfa', 'Grass Pellets', 'Protein Supplement'];
const EXPENSE_CATEGORIES = ['Feed', 'Veterinary', 'Equipment', 'Maintenance', 'Utilities', 'Labor', 'Insurance'];
const REVENUE_SOURCES = ['Milk Sales', 'Cattle Sales', 'Breeding Services', 'Manure Sales'];

// Helper functions
const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
const randomFloat = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function createMockCattle() {
  console.log('Creating mock cattle...');
  const cattle = [];
  
  for (let i = 1; i <= 15; i++) {
    const dateOfBirth = randomDate(new Date(2020, 0, 1), new Date(2023, 11, 31));
    const purchaseDate = randomDate(new Date(2023, 0, 1), new Date(2024, 11, 31));
    
    const cattleData = {
      tag_number: `GB${String(i).padStart(4, '0')}`,
      name: `${randomChoice(['Daisy', 'Bella', 'Luna', 'Rosie', 'Molly', 'Ruby', 'Stella', 'Coco', 'Penny', 'Ginger'])} ${i}`,
      breed: randomChoice(BREEDS),
      date_of_birth: dateOfBirth,
      gender: randomChoice(['Male', 'Female']),
      weight: randomFloat(400, 800),
      health_status: randomChoice(HEALTH_STATUSES),
      location: randomChoice(LOCATIONS),
      purchase_date: purchaseDate,
      purchase_price: randomFloat(1000, 2500),
      current_status: randomChoice(CURRENT_STATUSES.filter(s => s !== 'Deceased')), // Mostly active cattle
      notes: randomChoice([
        'High milk producer',
        'Good breeding stock',
        'Excellent health record',
        'Strong genetics',
        'High breeding value',
        null
      ])
    };
    
    cattle.push(cattleData);
  }
  
  return await Cattle.insertMany(cattle);
}

async function createMockMilkProduction(cattleList) {
  console.log('Creating mock milk production records...');
  const milkRecords = [];
  
  // Create records for the last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  for (const cattle of cattleList) {
    // Skip if cattle is not active or is male
    if (cattle.current_status !== 'Active' || cattle.gender === 'Male') continue;
    
    // Create 1-2 records per day for each cattle
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const recordsPerDay = randomInt(1, 2);
      
      for (let r = 0; r < recordsPerDay; r++) {
        const recordDate = new Date(d);
        recordDate.setHours(randomInt(5, 18), randomInt(0, 59), 0, 0);
        
        milkRecords.push({
          cattle_id: cattle._id,
          date_recorded: recordDate,
          quantity_liters: randomFloat(15, 35), // Liters per session
          quality_score: randomFloat(7, 10),
          notes: randomChoice([
            'Good quality milk',
            'Excellent production',
            'Normal milking session',
            'High fat content',
            null
          ])
        });
      }
    }
  }
  
  return await MilkProduction.insertMany(milkRecords);
}

async function createMockFeeding(cattleList) {
  console.log('Creating mock feeding records...');
  const feedingRecords = [];
  
  // Create records for the last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  for (const cattle of cattleList) {
    // Skip if cattle is not active
    if (cattle.current_status !== 'Active') continue;
    
    // Create 2-3 feeding records per day for each cattle
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const feedingsPerDay = randomInt(2, 3);
      
      for (let f = 0; f < feedingsPerDay; f++) {
        const feedDate = new Date(d);
        feedDate.setHours(randomInt(6, 20), randomInt(0, 59), 0, 0);
        
        const feedType = randomChoice(FEED_TYPES);
        const quantity = randomFloat(5, 15); // kg
        const costPerUnit = randomFloat(0.5, 2.5); // per kg
        
        feedingRecords.push({
          cattle_id: cattle._id,
          date_recorded: feedDate,
          feed_type: feedType,
          quantity_kg: quantity,
          cost_per_unit: costPerUnit,
          total_cost: quantity * costPerUnit,
          supplier: randomChoice(['Farm Supply Co', 'Green Valley Feeds', 'Country Feed Store', 'Local Farmer', null]),
          notes: randomChoice([
            'Regular feeding',
            'Extra nutrition needed',
            'High quality feed',
            'Bulk purchase discount',
            null
          ])
        });
      }
    }
  }
  
  return await Feeding.insertMany(feedingRecords);
}

async function createMockExpenses() {
  console.log('Creating mock expenses...');
  const expenses = [];
  
  // Create expenses for the last 90 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  for (let i = 0; i < 25; i++) {
    const expenseDate = randomDate(startDate, endDate);
    const category = randomChoice(EXPENSE_CATEGORIES);
    
    let amount, description;
    switch (category) {
      case 'Feed':
        amount = randomFloat(200, 800);
        description = `${randomChoice(FEED_TYPES)} purchase`;
        break;
      case 'Veterinary':
        amount = randomFloat(50, 300);
        description = randomChoice(['Vaccination', 'Health checkup', 'Treatment', 'Emergency care']);
        break;
      case 'Equipment':
        amount = randomFloat(100, 1500);
        description = randomChoice(['Milking equipment', 'Feeding tools', 'Maintenance tools', 'Farm machinery']);
        break;
      case 'Maintenance':
        amount = randomFloat(75, 500);
        description = randomChoice(['Barn repair', 'Fence maintenance', 'Equipment service', 'Facility upgrade']);
        break;
      case 'Utilities':
        amount = randomFloat(150, 400);
        description = randomChoice(['Electricity bill', 'Water bill', 'Gas bill', 'Internet/Phone']);
        break;
      case 'Labor':
        amount = randomFloat(300, 1200);
        description = randomChoice(['Farm worker salary', 'Veterinarian fee', 'Consultant fee', 'Temporary help']);
        break;
      case 'Insurance':
        amount = randomFloat(200, 600);
        description = 'Insurance premium';
        break;
      default:
        amount = randomFloat(50, 500);
        description = 'General expense';
    }
    
    expenses.push({
      date_recorded: expenseDate,
      category: category,
      description: description,
      amount: amount,
      supplier: randomChoice(['Farm Supply Co', 'Local Vendor', 'Service Provider', 'Equipment Dealer', null]),
      receipt_number: `RCP${randomInt(1000, 9999)}`,
      notes: randomChoice([
        'Regular expense',
        'Urgent purchase',
        'Bulk discount applied',
        'Emergency expense',
        'Planned purchase',
        null
      ])
    });
  }
  
  return await Expense.insertMany(expenses);
}

async function createMockRevenue() {
  console.log('Creating mock revenue records...');
  const revenues = [];
  
  // Create revenue for the last 60 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);
  
  for (let i = 0; i < 20; i++) {
    const revenueDate = randomDate(startDate, endDate);
    const source = randomChoice(REVENUE_SOURCES);
    
    let amount, description;
    switch (source) {
      case 'Milk Sales':
        amount = randomFloat(500, 2000);
        description = `Milk sales - ${randomInt(100, 500)} liters`;
        break;
      case 'Cattle Sales':
        amount = randomFloat(1500, 3500);
        description = `Cattle sale - ${randomChoice(['Bull', 'Cow', 'Heifer'])}`;
        break;
      case 'Breeding Services':
        amount = randomFloat(200, 800);
        description = 'Breeding service fee';
        break;
      case 'Manure Sales':
        amount = randomFloat(100, 400);
        description = 'Organic manure sales';
        break;
      default:
        amount = randomFloat(100, 1000);
        description = 'Other farm income';
    }
    
    revenues.push({
      date_recorded: revenueDate,
      source: source,
      description: description,
      amount: amount,
      notes: randomChoice([
        'Regular income',
        'Premium price received',
        'Bulk sale',
        'Contract sale',
        'Spot market sale',
        null
      ])
    });
  }
  
  return await Revenue.insertMany(revenues);
}

async function populateDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Promise.all([
      Cattle.deleteMany({}),
      MilkProduction.deleteMany({}),
      Feeding.deleteMany({}),
      Expense.deleteMany({}),
      Revenue.deleteMany({})
    ]);
    
    // Create mock data
    const cattle = await createMockCattle();
    const milkRecords = await createMockMilkProduction(cattle);
    const feedingRecords = await createMockFeeding(cattle);
    const expenses = await createMockExpenses();
    const revenues = await createMockRevenue();
    
    console.log('\n✅ Mock data populated successfully!');
    console.log('Created:');
    console.log(`  - ${cattle.length} cattle records`);
    console.log(`  - ${milkRecords.length} milk production records`);
    console.log(`  - ${feedingRecords.length} feeding records`);
    console.log(`  - ${expenses.length} expense records`);
    console.log(`  - ${revenues.length} revenue records`);
    
  } catch (error) {
    console.error('Error populating database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the population script
if (require.main === module) {
  populateDatabase();
}

module.exports = { populateDatabase };
