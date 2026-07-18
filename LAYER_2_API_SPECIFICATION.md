# 📡 Layer 2: API Specification (MVP)

**Layer:** Backend Interface  
**Status:** In Progress  
**Audience:** Backend & Frontend Developers  
**Last Updated:** July 18, 2026

---

## Overview

This document defines all API endpoints needed for the MVP. These endpoints are called by:
- 📱 Mobile app (React Native/Expo)
- 🌐 Web frontend (React)
- Both online and offline (via sync queue)

**Base URLs:**
```
Development:  http://localhost:8080/api
Production:   https://api.cattle-management.example.com/api
```

**All timestamps:** ISO 8601 format (UTC)  
**All amounts:** Numbers in BIF (Burundian Francs)  
**Authentication:** Simple (phone + PIN for MVP)

---

## 1. Authentication Endpoints

### POST /auth/register
**Purpose:** Create new user account  
**Auth Required:** No

**Request:**
```json
{
  "phone_number": "+257234567890",
  "pin": "1234",
  "farm_name": "Shima's Dairy Farm"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user_id": "user_123",
    "farm_id": "farm_001",
    "farm_name": "Shima's Dairy Farm",
    "device_id": "device_abc123"
  }
}
```

**Errors:**
```
400: Invalid phone format
409: Phone already registered
500: Server error
```

---

### POST /auth/login
**Purpose:** Authenticate user  
**Auth Required:** No

**Request:**
```json
{
  "phone_number": "+257234567890",
  "pin": "1234"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "user_123",
    "farm_id": "farm_001",
    "device_id": "device_abc123",
    "farm_data": {
      "farm_name": "Shima's Dairy Farm",
      "milk_price_per_liter": 1700
    }
  }
}
```

**Errors:**
```
401: Invalid credentials
404: User not found
```

---

## 2. CATTLE Endpoints

### GET /cattle
**Purpose:** Fetch all cattle for farm  
**Auth Required:** Yes  
**Cached:** Yes (valid 24h)

**Query Parameters:**
```
?status=Active          (optional, filter by status)
?sort=-updated_at       (optional, default by created_at)
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "tag_number": "COW-001",
      "name": "Cow A",
      "breed": "Friesian",
      "gender": "Female",
      "date_of_birth": "2020-03-15T00:00:00Z",
      "status": "Active",
      "health_status": "Healthy",
      "notes": "Good producer",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-07-18T00:00:00Z",
      "_synced_at": "2024-07-18T10:00:00Z"
    }
  ],
  "timestamp": "2024-07-18T10:30:00Z"
}
```

---

### GET /cattle/:id
**Purpose:** Fetch single cattle detail  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "tag_number": "COW-001",
    "name": "Cow A",
    ...
  }
}
```

---

### POST /cattle
**Purpose:** Create new cattle record  
**Auth Required:** Yes  
**Offline Supported:** Yes (queued locally)

**Request:**
```json
{
  "tag_number": "COW-007",
  "name": "Cow G",
  "breed": "Jersey",
  "gender": "Female",
  "date_of_birth": "2021-05-15",
  "status": "Active",
  "health_status": "Healthy",
  "notes": "Recently acquired"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "tag_number": "COW-007",
    ...
    "created_at": "2024-07-18T10:00:00Z",
    "_synced_at": "2024-07-18T10:00:00Z"
  }
}
```

---

### PUT /cattle/:id
**Purpose:** Update cattle record  
**Auth Required:** Yes  
**Offline Supported:** Yes

**Request:**
```json
{
  "health_status": "Sick",
  "notes": "Veterinary visit scheduled"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... updated cattle ... }
}
```

---

### DELETE /cattle/:id
**Purpose:** Delete cattle (soft delete)  
**Auth Required:** Yes  
**Offline Supported:** Yes

**Response (200):**
```json
{
  "success": true,
  "message": "Cattle deleted"
}
```

---

## 3. MILK PRODUCTION Endpoints

### GET /milk/cattle/:cattle_id/month/:yyyy-mm
**Purpose:** Fetch monthly milk records for one cow  
**Auth Required:** Yes  
**Cached:** Yes (valid 30 days for past months)  
**MOST USED ENDPOINT**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cattle_id": "507f1f77bcf86cd799439011",
    "cattle_tag": "COW-001",
    "cattle_name": "Cow A",
    "year_month": "2024-07",
    "total_liters": 465,
    "average_per_day": 15,
    "records": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "date_recorded": "2024-07-01",
        "quantity_liters": 14.5,
        "quality_score": 4,
        "notes": null
      },
      {
        "_id": "507f1f77bcf86cd799439021",
        "date_recorded": "2024-07-02",
        "quantity_liters": 15.0,
        "quality_score": 4
      }
    ]
  }
}
```

---

### GET /milk/day/:date
**Purpose:** Fetch all milk records for specific date  
**Auth Required:** Yes  
**DAILY DASHBOARD QUERY**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-07-18",
    "total_liters": 87.5,
    "records_count": 6,
    "average_per_cow": 14.58,
    "records": [
      {
        "cattle_id": "507f...",
        "cattle_tag": "COW-001",
        "cattle_name": "Cow A",
        "quantity_liters": 15.5,
        "quality_score": 4
      }
    ]
  }
}
```

---

### GET /milk/month/:yyyy-mm
**Purpose:** Fetch all milk records for month (all cows)  
**Auth Required:** Yes  
**MONTHLY REPORT QUERY**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "year_month": "2024-07",
    "total_liters": 1850,
    "average_per_cow": 308.33,
    "cows_count": 6,
    "by_cow": {
      "COW-001": {
        "total": 465,
        "average": 15,
        "records_count": 31
      },
      "COW-002": {
        "total": 450,
        "average": 14.5,
        "records_count": 31
      }
    }
  }
}
```

---

### POST /milk/record
**Purpose:** Record daily milk production  
**Auth Required:** Yes  
**Offline Supported:** Yes (critical)  
**MOST CALLED ENDPOINT**

**Request:**
```json
{
  "cattle_id": "507f1f77bcf86cd799439011",
  "date_recorded": "2024-07-18",
  "quantity_liters": 15.5,
  "quality_score": 4,
  "notes": "Good quality"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "cattle_id": "507f1f77bcf86cd799439011",
    "cattle_tag": "COW-001",
    "date_recorded": "2024-07-18",
    "quantity_liters": 15.5,
    "quality_score": 4,
    "created_at": "2024-07-18T06:15:00Z",
    "_synced_at": "2024-07-18T06:15:00Z"
  }
}
```

**Errors:**
```
400: Invalid quantity (must be > 0 and < 50)
404: Cattle not found
409: Record already exists for this date (conflict)
```

---

### PUT /milk/:id
**Purpose:** Update milk record  
**Auth Required:** Yes  
**Offline Supported:** Yes

**Request:**
```json
{
  "quantity_liters": 16.0,
  "notes": "Updated after recount"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... updated record ... }
}
```

---

### DELETE /milk/:id
**Purpose:** Delete milk record  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "message": "Record deleted"
}
```

---

## 4. EXPENSES Endpoints

### GET /expenses/month/:yyyy-mm
**Purpose:** Fetch all expenses for month  
**Auth Required:** Yes  
**MONTHLY EXPENSE QUERY**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "year_month": "2024-07",
    "total": 425000,
    "by_category": {
      "Feed": 150000,
      "Staff": 200000,
      "Medical": 25000,
      "Tax": 30000,
      "Insurance": 15000,
      "Other": 5000
    },
    "daily_average": 13709,
    "records": [
      {
        "_id": "507f...",
        "date_recorded": "2024-07-01",
        "category": "Feed",
        "description": "Protein concentrate 50kg",
        "amount": 25000,
        "supplier": "Supplier XYZ",
        "receipt_number": "REC-2024-0847"
      }
    ]
  }
}
```

---

### GET /expenses/category/:category
**Purpose:** Fetch expenses by category  
**Auth Required:** Yes

**Query Parameters:**
```
?year_month=2024-07    (optional, filter by month)
?start_date=2024-07-01 (optional)
?end_date=2024-07-31   (optional)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "category": "Feed",
    "total": 150000,
    "count": 6,
    "average": 25000,
    "records": [ ... ]
  }
}
```

---

### POST /expenses
**Purpose:** Record expense  
**Auth Required:** Yes  
**Offline Supported:** Yes

**Request:**
```json
{
  "category": "Feed",
  "description": "Protein concentrate 50kg bag",
  "amount": 25000,
  "date_recorded": "2024-07-15",
  "supplier": "Supplier XYZ",
  "receipt_number": "REC-2024-0847",
  "notes": "Good quality"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439040",
    "category": "Feed",
    "description": "Protein concentrate 50kg bag",
    "amount": 25000,
    "date_recorded": "2024-07-15",
    "created_at": "2024-07-15T09:00:00Z",
    "_synced_at": "2024-07-15T09:00:00Z"
  }
}
```

---

### PUT /expenses/:id
**Purpose:** Update expense  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": { ... updated expense ... }
}
```

---

### DELETE /expenses/:id
**Purpose:** Delete expense  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true
}
```

---

## 5. REVENUE Endpoints

### GET /revenue/month/:yyyy-mm
**Purpose:** Fetch all revenue for month  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "year_month": "2024-07",
    "total": 3145000,
    "milk_revenue": 3135000,
    "manual_revenue": 10000,
    "by_source": {
      "Milk": 3135000,
      "Cattle_Sale": 0,
      "Subsidy": 10000,
      "Other": 0
    },
    "records": [
      {
        "_id": "507f...",
        "source": "Milk",
        "description": "June milk sales",
        "amount": 3135000,
        "date_recorded": "2024-07-01"
      }
    ]
  }
}
```

**Note:** Milk revenue is auto-calculated from MilkProduction

---

### POST /revenue
**Purpose:** Record manual revenue (non-milk)  
**Auth Required:** Yes  
**Offline Supported:** Yes

**Request:**
```json
{
  "source": "Subsidy",
  "description": "Government subsidy for dairy",
  "amount": 50000,
  "date_recorded": "2024-07-15"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f...",
    "source": "Subsidy",
    ...
  }
}
```

---

### PUT /revenue/:id
### DELETE /revenue/:id
(Same patterns as expenses)

---

## 6. DASHBOARD & REPORTING Endpoints

### GET /dashboard/today
**Purpose:** Get today's quick stats  
**Auth Required:** Yes  
**MAIN DASHBOARD SCREEN**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-07-18",
    "today": {
      "milk_total": 87.5,
      "milk_records_count": 6,
      "milk_per_cow": 14.58,
      "daily_revenue": 148750,
      "daily_expenses": 2500,
      "daily_profit": 146250
    },
    "month_to_date": {
      "total_milk_liters": 1850,
      "milk_per_cow_average": 308.33,
      "total_revenue": 3145000,
      "total_expenses": 425000,
      "gross_profit": 2720000,
      "profit_per_cow": 453333,
      "profit_margin": 86.5
    },
    "stats": {
      "active_cattle_count": 6,
      "sync_status": "synced",
      "last_sync": "2024-07-18T10:00:00Z",
      "pending_changes": 0
    }
  }
}
```

---

### GET /report/monthly/:yyyy-mm
**Purpose:** Generate monthly report  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "year_month": "2024-07",
    "summary": {
      "total_milk": 1850,
      "total_revenue": 3145000,
      "total_expenses": 425000,
      "net_profit": 2720000
    },
    "milk_by_cow": [...],
    "expenses_by_category": [...],
    "profit_breakdown": [...]
  }
}
```

---

## 7. SETTINGS Endpoints

### GET /settings
**Purpose:** Get farm settings  
**Auth Required:** Yes  
**Cached:** Yes (24h)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f...",
    "farm_id": "farm_001",
    "farm_name": "Shima's Dairy Farm",
    "milk_price_per_liter": 1700,
    "currency": "BIF",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-07-18T00:00:00Z"
  }
}
```

---

### PUT /settings
**Purpose:** Update farm settings  
**Auth Required:** Yes

**Request:**
```json
{
  "farm_name": "Shima's Premium Dairy",
  "milk_price_per_liter": 1750
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... updated settings ... }
}
```

---

## 8. SYNC Endpoints (CRITICAL for Offline)

### POST /sync
**Purpose:** Bulk sync offline changes  
**Auth Required:** Yes  
**Priority:** CRITICAL  
**Optimization:** Batch all changes together

**Request (Send to server):**
```json
{
  "device_id": "device_abc123",
  "last_sync": "2024-07-18T08:00:00Z",
  "changes": {
    "cattle": [],
    "milk_productions": [
      {
        "_id": "local_id_123",
        "cattle_id": "507f...",
        "date_recorded": "2024-07-18",
        "quantity_liters": 15.5,
        "created_at": "2024-07-18T06:00:00Z"
      }
    ],
    "expenses": [],
    "revenue": []
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "timestamp": "2024-07-18T10:30:00Z",
  "synced_count": 3,
  "server_data": {
    "cattle": [],
    "milk_productions": [
      {
        "_id": "507f1f77bcf86cd799439030",
        "cattle_id": "507f1f77bcf86cd799439011",
        "date_recorded": "2024-07-18",
        "quantity_liters": 15.5,
        "_synced_at": "2024-07-18T10:30:00Z"
      }
    ],
    "expenses": [],
    "revenue": []
  },
  "errors": []
}
```

**Sync Strategy:**
- Client sends all pending changes
- Server validates each record
- Server returns synced records with server-generated IDs
- Client updates local storage with server IDs
- On conflict: Keep server data (server_wins)

---

### GET /sync/status
**Purpose:** Check sync status  
**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "device_id": "device_abc123",
    "last_sync": "2024-07-18T10:30:00Z",
    "server_data_age": 0,
    "needs_sync": false
  }
}
```

---

## 9. EXPORT Endpoints

### GET /export/monthly/:yyyy-mm?format=pdf
**Purpose:** Export monthly report  
**Auth Required:** Yes  
**Formats:** pdf, csv

**Response (200):**
```
Binary file (PDF)
Content-Type: application/pdf
```

---

## 10. Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message",
  "details": {...},
  "timestamp": "2024-07-18T10:30:00Z"
}
```

### Common Error Codes
```
400: Bad Request (validation failed)
401: Unauthorized (auth required)
403: Forbidden (permission denied)
404: Not Found
409: Conflict (duplicate, update conflict)
422: Unprocessable Entity (data validation)
429: Too Many Requests (rate limiting)
500: Internal Server Error
```

---

## 11. Rate Limiting & Performance

### Rate Limits (Per Device/User)
```
- GET requests: 1000/hour
- POST requests: 100/hour
- Sync endpoint: 50/hour
- Export: 10/hour
```

### Response Time SLA
```
- GET (simple): < 200ms
- GET (aggregated): < 500ms
- POST: < 300ms
- Sync: < 1s (even with 100 records)
```

### Payload Optimization
```
- All responses: gzip compressed
- Timestamps: Unix epoch (milliseconds)
- Numbers: No unnecessary decimals
- Strings: No null padding
```

---

## 12. API Versioning

Current version: `v1`  
All endpoints: `/api/v1/...`

Future versions won't break existing apps - new versions will be additive.

---

## 13. Implementation Checklist

- [ ] Database connection & models (MongoDB)
- [ ] Authentication system (phone + PIN)
- [ ] Cattle CRUD endpoints
- [ ] Milk production endpoints (critical)
- [ ] Expenses endpoints
- [ ] Revenue endpoints (auto-calc milk)
- [ ] Dashboard aggregation queries
- [ ] Sync mechanism (conflict resolution)
- [ ] Export (PDF/CSV)
- [ ] Error handling & logging
- [ ] Rate limiting
- [ ] Input validation
- [ ] Test with mobile app
- [ ] Performance optimization
- [ ] Documentation for mobile team

---

**End of API Specification**
