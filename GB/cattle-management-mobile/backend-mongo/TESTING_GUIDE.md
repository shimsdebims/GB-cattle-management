/**
 * MANUAL TESTING GUIDE FOR CATTLE & MILK PRODUCTION ROUTES
 * 
 * This guide shows how to manually test the API using curl or Postman
 * 
 * Prerequisites:
 * 1. Start the server: npm start (in backend-mongo directory)
 * 2. Server runs on http://localhost:8080
 * 3. MongoDB must be connected (check .env file)
 */

// ============================================================================
// CATTLE ENDPOINTS - MANUAL TEST COMMANDS
// ============================================================================

// 1. CREATE CATTLE (POST)
curl -X POST http://localhost:8080/api/cattle \
  -H "Content-Type: application/json" \
  -d '{
    "tag_number": "COW-001",
    "name": "Bessie",
    "breed": "Holstein",
    "gender": "Female",
    "date_of_birth": "2020-01-15",
    "status": "Active",
    "health_status": "Healthy"
  }'

// Expected Response (201):
{
  "success": true,
  "data": {
    "_id": "...",
    "tag_number": "COW-001",
    "name": "Bessie",
    "breed": "Holstein",
    "gender": "Female",
    "date_of_birth": "2020-01-15",
    "status": "Active",
    "health_status": "Healthy",
    "created_at": "2024-07-18T10:00:00Z",
    "updated_at": "2024-07-18T10:00:00Z"
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 2. CREATE SECOND CATTLE
curl -X POST http://localhost:8080/api/cattle \
  -H "Content-Type: application/json" \
  -d '{
    "tag_number": "COW-002",
    "name": "Daisy",
    "breed": "Jersey",
    "gender": "Female",
    "date_of_birth": "2019-06-20",
    "status": "Active",
    "health_status": "Healthy"
  }'

---

// 3. CREATE THIRD CATTLE (Sick status)
curl -X POST http://localhost:8080/api/cattle \
  -H "Content-Type: application/json" \
  -d '{
    "tag_number": "COW-003",
    "name": "Molly",
    "breed": "Guernsey",
    "gender": "Female",
    "date_of_birth": "2021-03-10",
    "status": "Active",
    "health_status": "Sick"
  }'

---

// 4. LIST ALL CATTLE (GET)
curl http://localhost:8080/api/cattle

// Expected Response (200):
{
  "success": true,
  "data": {
    "items": [
      { "tag_number": "COW-001", "name": "Bessie", ... },
      { "tag_number": "COW-002", "name": "Daisy", ... },
      { "tag_number": "COW-003", "name": "Molly", ... }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 50,
      "pages": 1,
      "has_next": false,
      "has_previous": false
    }
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 5. LIST CATTLE WITH FILTERING - Filter by status
curl 'http://localhost:8080/api/cattle?status=Active'

---

// 6. LIST CATTLE WITH FILTERING - Filter by health_status
curl 'http://localhost:8080/api/cattle?health_status=Sick'

---

// 7. LIST CATTLE WITH PAGINATION
curl 'http://localhost:8080/api/cattle?limit=2&page=1'

---

// 8. GET SINGLE CATTLE - Replace {ID} with actual cattle ID from create response
curl http://localhost:8080/api/cattle/{ID}

// Expected Response (200):
{
  "success": true,
  "data": {
    "_id": "{ID}",
    "tag_number": "COW-001",
    "name": "Bessie",
    ...
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 9. UPDATE CATTLE - Update health_status
curl -X PUT http://localhost:8080/api/cattle/{ID} \
  -H "Content-Type: application/json" \
  -d '{
    "health_status": "Resting",
    "name": "Bessie Updated"
  }'

---

// 10. DELETE CATTLE (Soft Delete - marks as Deceased)
curl -X DELETE http://localhost:8080/api/cattle/{ID}

// Expected Response (200):
{
  "success": true,
  "data": {
    "_id": "{ID}",
    "status": "Deceased",  // Changed to Deceased
    ...
  },
  "message": "Cattle deleted successfully",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// ============================================================================
// MILK PRODUCTION ENDPOINTS - MANUAL TEST COMMANDS
// ============================================================================

// 1. RECORD MILK PRODUCTION (POST) - Most frequently used endpoint
curl -X POST http://localhost:8080/api/milk/record \
  -H "Content-Type: application/json" \
  -d '{
    "cattle_id": "{COW-001_ID}",
    "date_recorded": "2024-07-18",
    "quantity_liters": 15.5,
    "quality_score": 4,
    "notes": "Good production today"
  }'

// Expected Response (201):
{
  "success": true,
  "data": {
    "_id": "...",
    "cattle_id": "{COW-001_ID}",
    "cattle_tag": "COW-001",
    "date_recorded": "2024-07-18",
    "quantity_liters": 15.5,
    "quality_score": 4,
    "notes": "Good production today",
    "created_at": "2024-07-18T10:00:00Z",
    "_synced_at": "2024-07-18T10:00:00Z"
  },
  "message": "Milk record created successfully",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 2. RECORD MILK FOR SECOND COW
curl -X POST http://localhost:8080/api/milk/record \
  -H "Content-Type: application/json" \
  -d '{
    "cattle_id": "{COW-002_ID}",
    "date_recorded": "2024-07-18",
    "quantity_liters": 14.2,
    "quality_score": 3
  }'

---

// 3. RECORD MILK FOR THIRD COW
curl -X POST http://localhost:8080/api/milk/record \
  -H "Content-Type: application/json" \
  -d '{
    "cattle_id": "{COW-003_ID}",
    "date_recorded": "2024-07-18",
    "quantity_liters": 13.8,
    "quality_score": 4
  }'

---

// 4. GET TODAY'S MILK TOTALS (Dashboard Query - Critical)
curl 'http://localhost:8080/api/milk/day/2024-07-18'

// Expected Response (200):
{
  "success": true,
  "data": {
    "date": "2024-07-18",
    "total_liters": 43.5,
    "records_count": 3,
    "average_per_cow": 14.5,
    "records": [
      {
        "_id": "...",
        "cattle_tag": "COW-001",
        "quantity_liters": 15.5,
        "quality_score": 4
      },
      {
        "_id": "...",
        "cattle_tag": "COW-002",
        "quantity_liters": 14.2,
        "quality_score": 3
      },
      {
        "_id": "...",
        "cattle_tag": "COW-003",
        "quantity_liters": 13.8,
        "quality_score": 4
      }
    ]
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 5. GET MONTHLY MILK DATA FOR ONE COW
curl 'http://localhost:8080/api/milk/cattle/{COW-001_ID}/month/2024-07'

// Expected Response (200):
{
  "success": true,
  "data": {
    "cattle_id": "{COW-001_ID}",
    "cattle_tag": "COW-001",
    "cattle_name": "Bessie",
    "year_month": "2024-07",
    "total_liters": 15.5,
    "average_per_day": 15.5,
    "record_count": 1,
    "records": [
      {
        "_id": "...",
        "date_recorded": "2024-07-18",
        "quantity_liters": 15.5,
        "quality_score": 4
      }
    ]
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 6. GET MONTHLY TOTALS FOR ALL COWS (Monthly Report)
curl 'http://localhost:8080/api/milk/month/2024-07'

// Expected Response (200):
{
  "success": true,
  "data": {
    "year_month": "2024-07",
    "total_liters": 43.5,
    "average_per_cow": 14.5,
    "cows_count": 3,
    "by_cow": {
      "COW-001": {
        "total": 15.5,
        "average": 15.5,
        "records_count": 1
      },
      "COW-002": {
        "total": 14.2,
        "average": 14.2,
        "records_count": 1
      },
      "COW-003": {
        "total": 13.8,
        "average": 13.8,
        "records_count": 1
      }
    }
  },
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 7. UPDATE MILK RECORD - Replace {RECORD_ID} with actual ID
curl -X PUT http://localhost:8080/api/milk/{RECORD_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "quantity_liters": 16.0,
    "quality_score": 5,
    "notes": "Updated after recount"
  }'

---

// 8. DELETE MILK RECORD
curl -X DELETE http://localhost:8080/api/milk/{RECORD_ID}

---

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

// 1. Test Duplicate Cattle Tag
curl -X POST http://localhost:8080/api/cattle \
  -H "Content-Type: application/json" \
  -d '{
    "tag_number": "COW-001",
    "name": "Another Bessie",
    ...
  }'

// Expected Response (409 Conflict):
{
  "success": false,
  "error": "Conflict",
  "message": "tag_number already exists",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 2. Test Missing Required Fields
curl -X POST http://localhost:8080/api/cattle \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Incomplete Cattle"
  }'

// Expected Response (400 Bad Request):
{
  "success": false,
  "error": "Validation error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "tag_number",
      "message": "Tag number is required"
    },
    ...
  ],
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 3. Test Duplicate Milk Record for Same Date
curl -X POST http://localhost:8080/api/milk/record \
  -H "Content-Type: application/json" \
  -d '{
    "cattle_id": "{COW-001_ID}",
    "date_recorded": "2024-07-18",
    "quantity_liters": 16.0
  }'

// Expected Response (409 Conflict):
{
  "success": false,
  "error": "Conflict",
  "message": "Record already exists for this date and cattle",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 4. Test Invalid Quantity Range
curl -X POST http://localhost:8080/api/milk/record \
  -H "Content-Type: application/json" \
  -d '{
    "cattle_id": "{COW-001_ID}",
    "date_recorded": "2024-07-19",
    "quantity_liters": 75  // Too high (max 50)
  }'

// Expected Response (400 Bad Request):
{
  "success": false,
  "error": "Validation error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "quantity_liters",
      "message": "Quantity must be between 0.1 and 50 liters"
    }
  ],
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 5. Test Invalid ObjectId
curl http://localhost:8080/api/cattle/invalid-id

// Expected Response (400 Bad Request):
{
  "success": false,
  "error": "Bad Request",
  "message": "Invalid cattle ID format",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// 6. Test Non-Existent Record
curl http://localhost:8080/api/cattle/507f1f77bcf86cd799439999

// Expected Response (404 Not Found):
{
  "success": false,
  "error": "Not Found",
  "message": "Cattle not found",
  "timestamp": "2024-07-18T10:00:00Z"
}

---

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

✓ POST /api/cattle - Create cattle
✓ GET /api/cattle - List all cattle
✓ GET /api/cattle?status=Active - Filter by status
✓ GET /api/cattle?health_status=Sick - Filter by health
✓ GET /api/cattle?limit=2&page=1 - Pagination
✓ GET /api/cattle/{id} - Get single cattle
✓ PUT /api/cattle/{id} - Update cattle
✓ DELETE /api/cattle/{id} - Soft delete cattle
✓ POST /api/milk/record - Create milk record (MOST USED)
✓ GET /api/milk/day/{date} - Today's totals (DASHBOARD)
✓ GET /api/milk/cattle/{id}/month/{yyyy-mm} - Monthly per cow
✓ GET /api/milk/month/{yyyy-mm} - Monthly all cows
✓ PUT /api/milk/{id} - Update milk record
✓ DELETE /api/milk/{id} - Delete milk record

✓ Error: Duplicate cattle tag (409)
✓ Error: Missing required fields (400)
✓ Error: Invalid quantity range (400)
✓ Error: Invalid date format (400)
✓ Error: Non-existent record (404)
✓ Error: Invalid ObjectId (400)
✓ Error: Duplicate milk record for same date (409)

---

// ============================================================================
// POSTMAN COLLECTION
// ============================================================================

Import this into Postman as raw JSON to test all endpoints:

{
  "info": { "name": "Cattle Management API" },
  "item": [
    {
      "name": "Cattle",
      "item": [
        {
          "name": "Create Cattle",
          "request": {
            "method": "POST",
            "url": "http://localhost:8080/api/cattle",
            "body": { ... }
          }
        },
        ...
      ]
    },
    {
      "name": "Milk Production",
      "item": [
        ...
      ]
    }
  ]
}

---
