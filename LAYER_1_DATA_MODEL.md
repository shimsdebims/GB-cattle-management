# 🗄️ Layer 1: Data Model & Database Schema (MVP)

**Layer:** Foundation  
**Status:** In Progress  
**Last Updated:** July 18, 2026

---

## Overview

This document defines the **clean, minimal data schema** for the MVP. Everything built on top will use these models.

**Key Principles:**
- ✅ Only fields needed for MVP features
- ✅ Simple relationships (no complex nesting)
- ✅ Optimized for sync/offline (minimal data transfer)
- ✅ Performance-first indexing
- ✅ Clear data types and validation

---

## 1. Database Setup

### Connection String
```
MongoDB Connection:
mongodb+srv://shimasarah777:[PASSWORD]@cluster0.mongodb.net/cattle-management

Environment File (.env):
MONGODB_URI=mongodb+srv://shimasarah777:45eDkKiSS5ubnP6Y@cluster0.mongodb.net/cattle-management
DATABASE_NAME=cattle-management
NODE_ENV=development
PORT=8080
```

### Collections (Tables)
```
📦 cattle-management (Database)
├── cattle (animals)
├── milk_productions (daily records)
├── expenses (expense tracking)
├── revenue (income tracking)
├── sync_metadata (offline sync tracking)
└── settings (farm-wide settings)
```

---

## 2. Data Models (MVP)

### Model 1: CATTLE (Animal Roster)

**Purpose:** Track individual animals  
**Sync Priority:** High (reference data)  
**Update Frequency:** Weekly  

```typescript
// TypeScript Interface
interface Cattle {
  // Identity
  _id: ObjectId;
  tag_number: string;           // Unique ID: "COW-001"
  name: string;                 // "Cow A"
  
  // Basic Info
  breed: string;                // "Friesian", "Jersey", etc.
  gender: "Male" | "Female";    // For tracking
  date_of_birth: Date;          // ISO format
  
  // Status
  status: "Active" | "Sold" | "Deceased";
  health_status?: string;       // "Healthy", "Sick", "Resting"
  
  // Metadata
  notes?: string;               // Additional info
  created_at: Date;
  updated_at: Date;
  
  // Sync Fields
  _synced_at?: Date;            // Last sync timestamp
  _local_only?: boolean;        // Flag for offline-created records
}
```

**MongoDB Schema:**
```javascript
db.cattle.insertOne({
  tag_number: "COW-001",
  name: "Cow A",
  breed: "Friesian",
  gender: "Female",
  date_of_birth: ISODate("2020-03-15"),
  status: "Active",
  health_status: "Healthy",
  notes: "Good milk producer",
  created_at: ISODate("2024-01-01"),
  updated_at: ISODate("2024-01-01"),
  _synced_at: ISODate("2024-01-01")
});
```

**Indexes (Performance):**
```javascript
db.cattle.createIndex({ tag_number: 1 }, { unique: true });
db.cattle.createIndex({ status: 1 });
db.cattle.createIndex({ updated_at: -1 });
db.cattle.createIndex({ _synced_at: 1 });
```

**API Endpoints:**
```
GET    /api/cattle                    - List all cattle
GET    /api/cattle/:id                - Get single cow
POST   /api/cattle                    - Create new cow
PUT    /api/cattle/:id                - Update cow
DELETE /api/cattle/:id                - Delete cow
POST   /api/cattle/sync               - Sync cattle data
```

---

### Model 2: MILK_PRODUCTION (Daily Records)

**Purpose:** Record daily milk output per cow  
**Sync Priority:** CRITICAL (most frequent data)  
**Update Frequency:** Daily (morning/evening)  
**Estimated Daily Records:** 12+ per month (6 cows × 2 days)

```typescript
interface MilkProduction {
  // Identity
  _id: ObjectId;
  cattle_id: ObjectId;               // Reference to cattle
  cattle_tag: string;                // Denormalized for offline queries
  
  // Production Data
  date_recorded: Date;               // Date of milking (not datetime)
  quantity_liters: number;           // Amount in liters (0-50)
  quality_score?: number;            // 1-5 star rating (optional MVP)
  
  // Metadata
  notes?: string;
  created_at: Date;
  updated_at: Date;
  
  // Sync Fields
  _synced_at?: Date;
  _local_only?: boolean;
}
```

**MongoDB Schema:**
```javascript
db.milk_productions.insertOne({
  cattle_id: ObjectId("507f1f77bcf86cd799439011"),
  cattle_tag: "COW-001",
  date_recorded: ISODate("2024-07-18"),
  quantity_liters: 15.5,
  quality_score: 4,
  notes: "Good quality",
  created_at: ISODate("2024-07-18T06:00:00Z"),
  updated_at: ISODate("2024-07-18T06:00:00Z"),
  _synced_at: ISODate("2024-07-18T07:00:00Z")
});
```

**Indexes (CRITICAL for Performance):**
```javascript
// For daily queries
db.milk_productions.createIndex({ cattle_id: 1, date_recorded: -1 });
db.milk_productions.createIndex({ date_recorded: -1 });
db.milk_productions.createIndex({ cattle_tag: 1 });

// For sync
db.milk_productions.createIndex({ _synced_at: 1 });
db.milk_productions.createIndex({ created_at: 1 });
```

**API Endpoints:**
```
GET    /api/milk/cattle/:cattle_id/month/:yyyy-mm     - Monthly data
GET    /api/milk/cattle/:cattle_id/date/:date         - Daily record
POST   /api/milk/record                                - Create record
PUT    /api/milk/:id                                   - Update record
POST   /api/milk/sync                                  - Bulk sync
```

**Calculated Fields (From Frontend):**
```
Daily Total = SUM(quantity_liters) for all cattle on date
Monthly Total = SUM(quantity_liters) for all days in month
Per-Cow Average = Monthly Total ÷ Number of cattle
Daily Revenue = Daily Total × Price per Liter
```

---

### Model 3: EXPENSES (Spending Tracker)

**Purpose:** Track all farm expenses by category  
**Sync Priority:** High (monthly reporting)  
**Update Frequency:** Weekly/Daily  
**Estimated Records:** 20-50 per month

```typescript
interface Expense {
  // Identity
  _id: ObjectId;
  
  // Classification
  category: "Feed" | "Staff" | "Medical" | "Tax" | "Insurance" | "Other";
  description: string;               // "Protein concentrate", "Manager salary"
  
  // Amount
  amount: number;                    // In BIF
  currency: "BIF";                   // For future multi-currency
  
  // Date & Tracking
  date_recorded: Date;               // When expense occurred
  supplier?: string;                 // "Supplier ABC"
  receipt_number?: string;           // "REC-2024-001"
  
  // Metadata
  notes?: string;
  created_at: Date;
  updated_at: Date;
  
  // Sync Fields
  _synced_at?: Date;
  _local_only?: boolean;
}
```

**MongoDB Schema:**
```javascript
db.expenses.insertOne({
  category: "Feed",
  description: "Protein concentrate 50kg bag",
  amount: 25000,
  currency: "BIF",
  date_recorded: ISODate("2024-07-15"),
  supplier: "Feed Supplier XYZ",
  receipt_number: "REC-2024-0847",
  notes: "Good quality, arrived on time",
  created_at: ISODate("2024-07-15"),
  updated_at: ISODate("2024-07-15"),
  _synced_at: ISODate("2024-07-15T10:00:00Z")
});
```

**Indexes:**
```javascript
db.expenses.createIndex({ date_recorded: -1 });
db.expenses.createIndex({ category: 1 });
db.expenses.createIndex({ date_recorded: 1, category: 1 });
db.expenses.createIndex({ _synced_at: 1 });
```

**API Endpoints:**
```
GET    /api/expenses/month/:yyyy-mm           - Monthly expenses
GET    /api/expenses/category/:category       - By category
POST   /api/expenses                          - Create expense
PUT    /api/expenses/:id                      - Update expense
DELETE /api/expenses/:id                      - Delete expense
POST   /api/expenses/sync                     - Bulk sync
```

**Calculated Fields (From Frontend):**
```
Total by Category = SUM(amount) per category per month
Monthly Total = SUM(amount) for all expenses in month
Daily Average = Monthly Total ÷ Days in month
Category Breakdown % = Category Total ÷ Monthly Total × 100
```

**Fixed Categories (Don't change, use in dropdown):**
```
1. Feed          - All feed-related costs
2. Staff         - Salaries, wages, labor
3. Medical       - Veterinary, medicines, health
4. Tax           - Cattle tax, farm tax
5. Insurance     - Cattle insurance, farm insurance
6. Other         - Everything else (bedding, operations, misc)
```

---

### Model 4: REVENUE (Income Tracking)

**Purpose:** Track all farm income sources  
**Sync Priority:** High (financial reporting)  
**Update Frequency:** Monthly (primarily)

```typescript
interface Revenue {
  // Identity
  _id: ObjectId;
  
  // Classification
  source: "Milk" | "Cattle_Sale" | "Subsidy" | "Other";
  description: string;               // "Milk sales June"
  
  // Amount
  amount: number;                    // In BIF
  currency: "BIF";
  
  // Metadata
  date_recorded: Date;               // When revenue was received
  notes?: string;
  created_at: Date;
  updated_at: Date;
  
  // Sync Fields
  _synced_at?: Date;
  _local_only?: boolean;
}
```

**MongoDB Schema:**
```javascript
db.revenue.insertOne({
  source: "Milk",
  description: "June milk sales (145 liters × 1,700 BIF)",
  amount: 246500,
  currency: "BIF",
  date_recorded: ISODate("2024-07-01"),
  notes: "Delivered to cooperative",
  created_at: ISODate("2024-07-01"),
  updated_at: ISODate("2024-07-01"),
  _synced_at: ISODate("2024-07-01T09:00:00Z")
});
```

**Indexes:**
```javascript
db.revenue.createIndex({ date_recorded: -1 });
db.revenue.createIndex({ source: 1 });
db.revenue.createIndex({ _synced_at: 1 });
```

**API Endpoints:**
```
GET    /api/revenue/month/:yyyy-mm           - Monthly revenue
GET    /api/revenue/source/:source           - By source
POST   /api/revenue                          - Create revenue
PUT    /api/revenue/:id                      - Update revenue
DELETE /api/revenue/:id                      - Delete revenue
POST   /api/revenue/sync                     - Bulk sync
```

**Note:** Revenue for milk is **auto-calculated** by combining:
- Milk Production records × Price per Liter
- So only manual revenue (cattle sales, subsidies) needs manual entry

---

### Model 5: SETTINGS (Farm Configuration)

**Purpose:** Store farm-wide settings  
**Sync Priority:** Low (reference data)  
**Update Frequency:** Rarely (when changed)

```typescript
interface Settings {
  // Identity
  _id: ObjectId;
  
  // Configuration
  farm_name: string;                 // "Shima's Dairy Farm"
  farm_id: string;                   // Unique identifier
  
  // Financial
  milk_price_per_liter: number;      // 1700 BIF (default)
  currency: string;                  // "BIF"
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  last_sync: Date;
}
```

**MongoDB Schema:**
```javascript
db.settings.insertOne({
  farm_id: "farm_001",
  farm_name: "Shima's Dairy Farm",
  milk_price_per_liter: 1700,
  currency: "BIF",
  created_at: ISODate("2024-01-01"),
  updated_at: ISODate("2024-01-01"),
  last_sync: ISODate("2024-07-18")
});
```

**API Endpoints:**
```
GET    /api/settings                 - Get farm settings
PUT    /api/settings                 - Update settings
```

---

### Model 6: SYNC_METADATA (Offline Tracking)

**Purpose:** Track what's been synced, handle conflicts  
**Sync Priority:** CRITICAL (for offline sync to work)  
**Update Frequency:** Every sync action

```typescript
interface SyncMetadata {
  // Identity
  _id: ObjectId;
  
  // Sync Tracking
  device_id: string;                 // Mobile device identifier
  last_sync: Date;                   // Last successful sync
  pending_count: number;             // Records waiting to sync
  
  // Conflict Resolution
  conflict_strategy: "client_wins" | "server_wins" | "manual"; // For MVP: client_wins
  
  // Sync Queue Size
  queue_size_bytes: number;          // Estimated size of pending data
  
  created_at: Date;
  updated_at: Date;
}
```

**MongoDB Schema:**
```javascript
db.sync_metadata.insertOne({
  device_id: "device_abc123",
  last_sync: ISODate("2024-07-18T10:00:00Z"),
  pending_count: 0,
  conflict_strategy: "client_wins",
  queue_size_bytes: 0,
  created_at: ISODate("2024-07-18"),
  updated_at: ISODate("2024-07-18")
});
```

---

## 3. Relationships & Data Flow

```
CATTLE (Parent)
  ├── One-to-Many: MILK_PRODUCTION
  │   └── Many cow records per cattle record
  └── Reference: Used in EXPENSES (indirectly via notes)

MILK_PRODUCTION (Transaction)
  ├── Points to: CATTLE (cattle_id)
  ├── Calculates: Revenue (quantity × milk_price_per_liter from SETTINGS)
  └── Used by: Dashboard (daily totals, monthly summaries)

EXPENSES (Categorical)
  ├── Independent: References no other collection
  ├── Categories: Feed, Staff, Medical, Tax, Insurance, Other
  └── Used by: Financial dashboard (monthly breakdown)

REVENUE (Income)
  ├── Manual entries: Cattle sales, subsidies, other
  ├── Auto-calculated: Milk revenue (from MILK_PRODUCTION)
  └── Used by: Financial dashboard (profit calculation)

SETTINGS (Configuration)
  ├── Single record per farm
  ├── Contains: milk_price_per_liter (used for calculations)
  └── Updated: Monthly or when price changes

SYNC_METADATA (Infrastructure)
  ├── Tracks: Offline sync state
  ├── One record per device
  └── Critical for: Offline-first functionality
```

---

## 4. Data Size Estimation (12-Month Operations)

```
CATTLE:
- ~6 records
- ~1 KB per record
- Total: ~6 KB

MILK_PRODUCTION:
- ~6 cows × 30 days × 12 months = 2,160 records/year
- ~0.5 KB per record
- Total: ~1 MB/year
- Mobile storage: ~1 MB (manageable)

EXPENSES:
- ~30 records/month × 12 = 360 records/year
- ~0.3 KB per record
- Total: ~108 KB/year

REVENUE:
- ~12 records/year (monthly summaries)
- Total: ~5 KB/year

TOTAL: ~2 MB/year (very lightweight)
```

---

## 5. Validation Rules

### CATTLE
```
tag_number: Required, unique, alphanumeric (5-20 chars)
name: Required, 1-100 chars
breed: Required, 1-50 chars
gender: Required, enum (Male/Female)
date_of_birth: Required, valid date, not future
status: Required, enum (Active/Sold/Deceased)
```

### MILK_PRODUCTION
```
cattle_id: Required, valid ObjectId, must exist in cattle
date_recorded: Required, valid date, not future
quantity_liters: Required, number > 0, max 50
quality_score: Optional, number 1-5
```

### EXPENSES
```
category: Required, enum (Feed/Staff/Medical/Tax/Insurance/Other)
description: Required, 1-200 chars
amount: Required, number > 0
date_recorded: Required, valid date, not future
```

### REVENUE
```
source: Required, enum (Milk/Cattle_Sale/Subsidy/Other)
description: Required, 1-200 chars
amount: Required, number > 0
date_recorded: Required, valid date, not future
```

---

## 6. Performance Optimization

### Query Patterns (Most Frequent)

```javascript
// Dashboard - Daily totals (MOST USED)
db.milk_productions.find({
  date_recorded: ISODate("2024-07-18")
}).project({ quantity_liters: 1, cattle_tag: 1 });
// Index: { date_recorded: -1 }

// Monthly Report (USED DAILY)
db.milk_productions.aggregate([
  { $match: { date_recorded: { $gte: ISODate("2024-07-01"), $lt: ISODate("2024-08-01") } } },
  { $group: { _id: "$cattle_tag", total: { $sum: "$quantity_liters" } } }
]);
// Index: { date_recorded: -1, cattle_tag: 1 }

// Expense Summary (USED WEEKLY)
db.expenses.aggregate([
  { $match: { date_recorded: { $gte: ISODate("2024-07-01"), $lt: ISODate("2024-08-01") } } },
  { $group: { _id: "$category", total: { $sum: "$amount" } } }
]);
// Index: { date_recorded: 1, category: 1 }

// Sync Pending Data (USED EVERY SYNC)
db.milk_productions.find({ _synced_at: { $exists: false } });
db.expenses.find({ _synced_at: { $exists: false } });
// Index: { _synced_at: 1 }
```

### Data Transfer Optimization

```
For Mobile Sync (reduce payload):
- Only send changed records
- Compress timestamps (epoch milliseconds, not ISO strings)
- Exclude unnecessary fields
- Batch requests (max 100 records per request)
- Return only essential fields

Example Response (Minimal):
{
  "records": [
    { "id": "507f", "qty": 15.5, "date": 1721347200000 },
    { "id": "507g", "qty": 18, "date": 1721347200000 }
  ],
  "sync_cursor": "2024-07-18T10:30:00Z"
}
```

---

## 7. Migration Strategy (From Current to MVP)

### Current System Issues
- ❌ Dual backends (Python + Node)
- ❌ Overly complex models
- ❌ Feeding model not used in MVP
- ❌ Unnecessary fields (weight, location, etc.)

### Migration Steps
```
1. Export existing data from current backends
2. Map to new simplified models
3. Validate data integrity
4. Import to clean MongoDB
5. Run initial sync
6. Archive old system for reference
```

---

## 8. Testing Data (Seed for Development)

```javascript
// Sample Cattle
db.cattle.insertMany([
  {
    tag_number: "COW-001",
    name: "Cow A",
    breed: "Friesian",
    gender: "Female",
    date_of_birth: ISODate("2020-03-15"),
    status: "Active",
    health_status: "Healthy",
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    tag_number: "COW-002",
    name: "Cow B",
    breed: "Jersey",
    gender: "Female",
    date_of_birth: ISODate("2021-05-20"),
    status: "Active",
    health_status: "Healthy",
    created_at: new Date(),
    updated_at: new Date()
  }
  // ... Continue for COW-003 through COW-006
]);

// Sample Milk Production (7 days × 6 cows)
db.milk_productions.insertMany([
  {
    cattle_id: ObjectId("..."), // Reference to Cow A
    cattle_tag: "COW-001",
    date_recorded: ISODate("2024-07-18"),
    quantity_liters: 15.5,
    quality_score: 4,
    created_at: new Date(),
    updated_at: new Date()
  }
  // ... More records
]);
```

---

## 9. Next Steps

- [ ] **Validate Schema** with stakeholders
- [ ] **Create Indexes** in MongoDB
- [ ] **Generate TypeScript Interfaces** (Layer 2)
- [ ] **Create API Specifications** (Layer 2)
- [ ] **Seed Test Data** (Layer 2)
- [ ] **Build Models** in Node.js (Layer 3)

---

**End of Data Model Document**
