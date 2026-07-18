# Dairy Cattle Management System

A comprehensive web application for managing dairy cattle operations, tracking milk production, feeding records, financial data, and providing analytics with matplotlib visualizations.

## Features

### 🐄 Cattle Management
- Track individual cattle information (tag number, breed, health status, etc.)
- Monitor cattle lifecycle from birth to sale
- Manage cattle locations and health records

### 🥛 Milk Production Tracking
- Daily milk production recording
- Quality scoring system
- Production trends and analytics
- Cow-by-cow production comparison

### 🌾 Feeding Management
- Track feed types and quantities
- Monitor feeding costs per cattle
- Feed supplier management
- Nutritional analysis

### 💰 Financial Management
- Expense tracking by category
- Revenue recording from multiple sources
- Profit/loss analysis
- ROI calculations per cattle

### 📊 Analytics & Reporting
- Interactive charts using matplotlib
- Milk production trend analysis
- Cattle performance comparison
- Financial overview dashboards
- Feed cost analysis

## Technology Stack

### Backend
- **Python 3.8+** with Flask
- **SQLAlchemy** for database ORM
- **SQLite** for development database
- **matplotlib** for chart generation
- **pandas** for data analysis
- **Flask-CORS** for cross-origin requests

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for component library
- **React Router** for navigation
- **Axios** for API communication
- **Recharts** for additional charting

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env file with your configuration
```

5. Initialize the database:
```bash
python app.py
```

The backend will start on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env file if needed
```

4. Start the development server:
```bash
npm start
```

The frontend will start on `http://localhost:3000`

## API Endpoints

### Cattle Management
- `GET /api/cattle` - Get all cattle
- `POST /api/cattle` - Create new cattle record
- `GET /api/cattle/{id}` - Get specific cattle
- `PUT /api/cattle/{id}` - Update cattle record
- `DELETE /api/cattle/{id}` - Delete cattle record

### Milk Production
- `GET /api/milk` - Get milk production records
- `POST /api/milk` - Create milk production record
- `GET /api/milk/summary` - Get production summary
- `PUT /api/milk/{id}` - Update milk record
- `DELETE /api/milk/{id}` - Delete milk record

### Feeding Management
- `GET /api/feeding` - Get feeding records
- `POST /api/feeding` - Create feeding record
- `PUT /api/feeding/{id}` - Update feeding record
- `DELETE /api/feeding/{id}` - Delete feeding record

### Financial Management
- `GET /api/financial/expenses` - Get expenses
- `POST /api/financial/expenses` - Create expense
- `GET /api/financial/revenue` - Get revenue records
- `POST /api/financial/revenue` - Create revenue record
- `GET /api/financial/summary` - Get financial summary

### Analytics
- `GET /api/analytics/milk-production-chart` - Get milk production chart
- `GET /api/analytics/cattle-comparison` - Get cattle comparison chart
- `GET /api/analytics/financial-overview` - Get financial overview chart
- `GET /api/analytics/feeding-cost-analysis` - Get feeding cost analysis

## Usage

### Adding New Cattle
1. Navigate to "Cattle Management"
2. Click "Add New Cattle"
3. Fill in cattle information (tag number, name, breed, etc.)
4. Save the record

### Recording Milk Production
1. Go to "Milk Production"
2. Select the cattle
3. Enter daily milk quantity and quality score
4. Save the record

### Tracking Expenses and Revenue
1. Navigate to "Financial Management"
2. Add expenses by category (Feed, Veterinary, Equipment, etc.)
3. Record revenue from milk sales or cattle sales
4. View financial summaries and reports

### Viewing Analytics
1. Go to "Analytics Dashboard"
2. Select time period (7 days, 30 days, 90 days, or 1 year)
3. View various charts and insights:
   - Milk production trends
   - Cattle performance comparison
   - Financial overview
   - Feeding cost analysis

## Database Schema

### Cattle Table
- ID, Tag Number, Name, Breed
- Date of Birth, Gender, Weight
- Health Status, Location
- Purchase Date/Price, Current Status

### Milk Production Table
- Cattle ID, Date Recorded
- Quantity (Liters), Quality Score
- Notes

### Feeding Table
- Cattle ID, Date Recorded
- Feed Type, Quantity (kg)
- Cost per Unit, Total Cost
- Supplier, Notes

### Expenses Table
- Date, Category, Description
- Amount, Supplier, Receipt Number

### Revenue Table
- Date, Source, Description
- Amount, Notes

## Development

### Adding New Features
1. Backend: Add new routes in `routes/` directory
2. Frontend: Create new components in `components/` or pages in `pages/`
3. Update API service in `services/api.ts`
4. Add new types in `types/index.ts`

### Database Migrations
When adding new fields or tables:
1. Update models in `models/` directory
2. Delete existing database file (for development)
3. Restart the application to recreate tables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please create an issue in the repository.
