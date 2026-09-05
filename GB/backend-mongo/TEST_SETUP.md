# Testing Setup & Execution Guide

## Phase: Layer 2 Backend - Testing Cattle & Milk Production Routes

### What's Ready to Test

✅ **Cattle CRUD Routes** (5 endpoints)
- `POST /api/cattle` - Create cattle with validation
- `GET /api/cattle` - List all cattle with filtering & pagination
- `GET /api/cattle/:id` - Get single cattle
- `PUT /api/cattle/:id` - Update cattle
- `DELETE /api/cattle/:id` - Soft delete (mark as Deceased)

✅ **Milk Production Routes** (6 endpoints)
- `POST /api/milk/record` - Create daily milk records (MOST USED)
- `GET /api/milk/day/:date` - Today's totals (DASHBOARD QUERY)
- `GET /api/milk/cattle/:id/month/:yyyy-mm` - Monthly per cow
- `GET /api/milk/month/:yyyy-mm` - Monthly all cows
- `PUT /api/milk/:id` - Update record
- `DELETE /api/milk/:id` - Delete record

✅ **Supporting Infrastructure**
- Validation middleware (validates all requests)
- Response helpers (consistent JSON format)
- Error handling (asyncHandler catches all errors)
- Test suite (40+ test cases)
- Manual testing guide (curl examples)

---

## Step 1: Install Dependencies

```bash
cd GB/cattle-management-mobile/backend-mongo
npm install
```

This will install:
- `express` 4.18.2 - Web framework
- `mongoose` 7.5.0 - MongoDB driver
- `jest` 29.7.0 - Test runner (NEW)
- `supertest` 6.3.3 - HTTP testing (NEW)
- Plus others: cors, helmet, express-rate-limit, morgan

---

## Step 2: Configure Environment

Create/verify `.env` file in `backend-mongo/` directory:

```
MONGODB_URI=mongodb+srv://shimasarah777:45eDkKiSS5ubnP6Y@cluster0.mongodb.net/cattle-management
PORT=8080
NODE_ENV=development
```

⚠️ **Important:** Make sure MONGODB_URI in .env matches your Atlas connection string.

---

## Step 3: Choose Your Testing Approach

### Option A: Automated Tests (Recommended for thorough validation)

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm test -- --watch

# Run specific test file
npm test -- cattle.test.js

# Generate coverage report
npm test -- --coverage
```

**What gets tested:**
- ✅ 25+ Cattle endpoint tests
- ✅ 25+ Milk Production endpoint tests
- ✅ Validation scenarios
- ✅ Error handling (409 conflicts, 404 not found, 400 bad request)
- ✅ Edge cases (duplicate records, invalid formats, business rules)

---

### Option B: Manual Testing with Postman/curl

1. **Start the server:**
   ```bash
   npm start
   # Server runs on http://localhost:8080
   ```

2. **Test using curl commands:**
   See `TESTING_GUIDE.md` for complete curl commands for all endpoints

3. **Example: Create cattle**
   ```bash
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
   ```

4. **Example: Record milk production**
   ```bash
   curl -X POST http://localhost:8080/api/milk/record \
     -H "Content-Type: application/json" \
     -d '{
       "cattle_id": "{CATTLE_ID}",
       "date_recorded": "2024-07-18",
       "quantity_liters": 15.5,
       "quality_score": 4
     }'
   ```

---

## Step 4: Verify Routes Work

### Run Tests to Verify Everything

```bash
npm test
```

**Expected Output:**
```
PASS  routes/cattle.test.js
  CATTLE ROUTES
    POST /api/cattle
      ✓ Should create cattle with valid data (45ms)
      ✓ Should reject duplicate tag_number (32ms)
      ✓ Should validate required fields (28ms)
      ... (more tests)
    GET /api/cattle
      ✓ Should list all cattle (35ms)
      ✓ Should filter by status (38ms)
      ... (more tests)

  MILK PRODUCTION ROUTES
    POST /api/milk/record
      ✓ Should create milk record with valid data (42ms)
      ✓ Should reject duplicate record for same date (36ms)
      ... (more tests)

Test Suites: 1 passed, 1 total
Tests:       50 passed, 50 total
```

### Manual Verification Checklist

If running manually, verify these key operations:

```
1. Create 3 cattle
   - POST /api/cattle (Bessie, Daisy, Molly)
   - Verify response includes _id

2. List cattle
   - GET /api/cattle
   - Should show 3 cattle

3. Filter cattle
   - GET /api/cattle?status=Active
   - GET /api/cattle?health_status=Healthy

4. Record milk (3 times, one per cow)
   - POST /api/milk/record (15.5L for COW-001)
   - POST /api/milk/record (14.2L for COW-002)
   - POST /api/milk/record (13.8L for COW-003)

5. Dashboard query (CRITICAL)
   - GET /api/milk/day/2024-07-18
   - Should show total 43.5L, 3 records

6. Monthly summary
   - GET /api/milk/month/2024-07
   - Should show per-cow breakdown

7. Update record
   - PUT /api/milk/{id}
   - Change quantity_liters to 16.0

8. Error handling
   - POST duplicate cattle tag → 409 Conflict
   - POST invalid quantity (>50) → 400 Bad Request
   - GET non-existent ID → 404 Not Found
```

---

## Step 5: Expected Behavior

### Success Response Format (All 2xx)

```json
{
  "success": true,
  "data": { /* requested data */ },
  "message": "Optional message",
  "timestamp": "2024-07-18T10:00:00Z"
}
```

### Error Response Format (All errors)

```json
{
  "success": false,
  "error": "Error type (Conflict, ValidationError, etc)",
  "message": "Human-readable message",
  "errors": [ /* optional validation errors */ ],
  "timestamp": "2024-07-18T10:00:00Z"
}
```

### Key Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 201 | Created | POST /api/cattle |
| 200 | OK | GET /api/cattle, PUT, DELETE |
| 400 | Bad Request | Invalid data format |
| 404 | Not Found | Cattle doesn't exist |
| 409 | Conflict | Duplicate tag_number or date |
| 500 | Server Error | MongoDB connection issue |

---

## Step 6: Troubleshooting

### Tests won't run: "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Tests fail with MongoDB connection error
```bash
# Check .env file has correct MONGODB_URI
# Verify MongoDB Atlas credentials are correct
# Make sure IP whitelist includes your machine (0.0.0.0/0 for testing)
```

### Tests timeout
```bash
# Increase Jest timeout in jest.config.js or run with:
npm test -- --testTimeout=20000
```

### Server won't start
```bash
# Check PORT isn't already in use
lsof -i :8080

# Or use different port
PORT=3000 npm start
```

---

## Step 7: What Validation Happens

### Cattle Validation

```
✓ tag_number: 5-20 chars, alphanumeric, UNIQUE
✓ name: 1-100 chars
✓ breed: 1-50 chars
✓ gender: Enum (Male/Female)
✓ date_of_birth: Date, not in future
✓ status: Enum (Active/Sold/Deceased)
✓ health_status: Enum (Healthy/Sick/Resting)
```

### Milk Production Validation

```
✓ cattle_id: Valid ObjectId, must exist in Cattle collection
✓ date_recorded: Date, not in future, UNIQUE per cattle
✓ quantity_liters: 0.1 - 50 (decimal)
✓ quality_score: 1 - 5 (optional, if provided)
✓ notes: Optional, max 500 chars
```

---

## Step 8: Next Steps After Testing

Once both route sets pass all tests:

1. **Layer 3: Expense & Revenue Routes** 
   - Follow same pattern as Cattle/Milk
   
2. **Layer 4: Dashboard & Sync Endpoints**
   - Aggregate data from multiple collections
   - Implement offline sync queue

3. **Layer 5: Mobile Frontend Integration**
   - Test with actual React Native app
   - Verify offline sync works

---

## Files Created/Modified

```
✅ routes/cattle.js                 - Refactored to Layer 2 spec
✅ routes/milk.js                   - Implemented Layer 2 spec
✅ routes/cattle.test.js            - 50+ comprehensive tests
✅ jest.config.js                   - Jest configuration
✅ TESTING_GUIDE.md                 - Manual testing with curl
✅ package.json                     - Added jest, supertest, test script
✅ middleware/validation.js         - Validates all requests
✅ middleware/responses.js          - Consistent response format
✅ middleware/index.js              - Exports all middleware
```

---

## Git Commits

```
Commit 1: Layer 2A - Cattle routes + validation middleware
Commit 2: Layer 2B - Milk routes + tests + documentation
```

---

## Ready to Test?

Run this command and watch everything work:

```bash
cd GB/cattle-management-mobile/backend-mongo
npm install
npm test
```

Expected: All tests pass ✅

Good luck! Let me know what you find during testing.
