#!/usr/bin/env python3
"""
Script to populate the database with mock data for testing and demonstration
"""

import os
import sys
from datetime import datetime, date, timedelta
from random import randint, choice, uniform

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models.cattle import Cattle
from models.milk_production import MilkProduction
from models.feeding import Feeding
from models.expenses import Expenses
from models.revenue import Revenue

# Mock data constants
BREEDS = ['Holstein', 'Jersey', 'Angus', 'Hereford', 'Brahman', 'Simmental', 'Charolais']
HEALTH_STATUSES = ['Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering']
CURRENT_STATUSES = ['Active', 'Sold', 'Deceased', 'Quarantined']
LOCATIONS = ['Barn A', 'Barn B', 'Pasture 1', 'Pasture 2', 'Quarantine Area']
FEED_TYPES = ['Hay', 'Corn Silage', 'Barley', 'Wheat', 'Alfalfa', 'Grass Pellets', 'Protein Supplement']
EXPENSE_CATEGORIES = ['Feed', 'Veterinary', 'Equipment', 'Maintenance', 'Utilities', 'Labor', 'Insurance']
REVENUE_SOURCES = ['Milk Sales', 'Cattle Sales', 'Breeding Services', 'Manure Sales']

def create_mock_cattle():
    """Create mock cattle records"""
    cattle_data = []
    
    for i in range(1, 16):  # Create 15 cattle
        # Generate random dates
        birth_date = date.today() - timedelta(days=randint(365, 2190))  # 1-6 years old
        purchase_date = birth_date + timedelta(days=randint(30, 365))  # Purchased sometime after birth
        
        cattle = Cattle(
            tag_number=f"GB{i:04d}",
            name=choice([
                'Bella', 'Daisy', 'Molly', 'Bessie', 'Luna', 'Rosie', 'Stella', 'Ruby',
                'Max', 'Charlie', 'Duke', 'Thunder', 'Rocky', 'Bruno', 'Atlas'
            ]) + f" {i}",
            breed=choice(BREEDS),
            date_of_birth=birth_date,
            gender=choice(['Male', 'Female']),
            weight=uniform(400, 800),
            health_status=choice(HEALTH_STATUSES) if randint(1, 10) <= 2 else 'Healthy',  # 20% chance of non-healthy
            location=choice(LOCATIONS),
            purchase_date=purchase_date,
            purchase_price=uniform(800, 2500),
            current_status=choice(CURRENT_STATUSES) if randint(1, 10) <= 1 else 'Active',  # 10% chance of non-active
            notes=choice([
                'Excellent milk producer',
                'Good temperament',
                'Requires special attention',
                'Regular health checks needed',
                'High breeding value',
                None
            ])
        )
        cattle_data.append(cattle)
    
    return cattle_data

def create_mock_milk_production(cattle_list):
    """Create mock milk production records"""
    milk_records = []
    
    for cattle in cattle_list:
        if cattle.gender == 'Female' and cattle.current_status == 'Active':
            # Generate milk records for the last 30 days
            for i in range(30):
                record_date = date.today() - timedelta(days=i)
                quantity = uniform(15, 35)  # 15-35 liters per day
                
                milk_record = MilkProduction(
                    cattle_id=cattle.id,
                    date_recorded=record_date,
                    quantity_liters=quantity,
                    quality_score=uniform(7.0, 10.0),
                    notes=choice([
                        'Morning milking',
                        'Evening milking',
                        'Good quality',
                        'Lower than usual',
                        'Excellent production',
                        None
                    ])
                )
                milk_records.append(milk_record)
    
    return milk_records

def create_mock_feeding(cattle_list):
    """Create mock feeding records"""
    feeding_records = []
    
    for cattle in cattle_list:
        if cattle.current_status == 'Active':
            # Generate feeding records for the last 7 days
            for i in range(7):
                record_date = date.today() - timedelta(days=i)
                feed_type = choice(FEED_TYPES)
                quantity = uniform(5, 15)  # 5-15 kg per day
                cost_per_unit = uniform(0.5, 2.0)  # Cost per kg
                
                feeding_record = Feeding(
                    cattle_id=cattle.id,
                    date_recorded=record_date,
                    feed_type=feed_type,
                    quantity_kg=quantity,
                    cost_per_unit=cost_per_unit,
                    total_cost=quantity * cost_per_unit,
                    supplier=choice(['FeedCorp', 'AgriSupply', 'FarmFresh', 'LocalFarm']),
                    notes=choice([
                        'Regular feeding',
                        'Extra nutrition',
                        'Special diet',
                        'Reduced portion',
                        None
                    ])
                )
                feeding_records.append(feeding_record)
    
    return feeding_records

def create_mock_expenses():
    """Create mock expense records"""
    expenses = []
    
    for i in range(20):  # Create 20 expense records
        expense_date = date.today() - timedelta(days=randint(1, 90))
        category = choice(EXPENSE_CATEGORIES)
        
        # Generate realistic amounts based on category
        if category == 'Feed':
            amount = uniform(200, 800)
            description = f"{choice(FEED_TYPES)} purchase"
        elif category == 'Veterinary':
            amount = uniform(50, 300)
            description = choice(['Vaccination', 'Health check', 'Treatment', 'Emergency visit'])
        elif category == 'Equipment':
            amount = uniform(100, 1500)
            description = choice(['Milking equipment', 'Feeding tools', 'Maintenance tools'])
        elif category == 'Maintenance':
            amount = uniform(50, 400)
            description = choice(['Barn repair', 'Fence maintenance', 'Equipment repair'])
        elif category == 'Utilities':
            amount = uniform(100, 300)
            description = choice(['Electricity', 'Water', 'Gas'])
        elif category == 'Labor':
            amount = uniform(300, 800)
            description = choice(['Farm worker salary', 'Veterinarian fee', 'Consultant fee'])
        else:  # Insurance
            amount = uniform(200, 600)
            description = 'Insurance premium'
        
        expense = Expenses(
            date_recorded=expense_date,
            category=category,
            description=description,
            amount=amount,
            supplier=choice(['FeedCorp', 'AgriSupply', 'VetClinic', 'LocalSupplier', 'UtilityCorp']),
            receipt_number=f"REC{randint(1000, 9999)}",
            notes=choice([
                'Paid in full',
                'Partial payment',
                'Invoice pending',
                'Urgent expense',
                None
            ])
        )
        expenses.append(expense)
    
    return expenses

def create_mock_revenue():
    """Create mock revenue records"""
    revenues = []
    
    for i in range(15):  # Create 15 revenue records
        revenue_date = date.today() - timedelta(days=randint(1, 60))
        source = choice(REVENUE_SOURCES)
        
        # Generate realistic amounts based on source
        if source == 'Milk Sales':
            amount = uniform(500, 1200)
            description = f"Milk sales - {randint(100, 300)} liters"
        elif source == 'Cattle Sales':
            amount = uniform(1000, 3000)
            description = f"Cattle sale - {choice(BREEDS)} {choice(['Bull', 'Cow', 'Heifer'])}"
        elif source == 'Breeding Services':
            amount = uniform(100, 400)
            description = "Breeding service fee"
        else:  # Manure Sales
            amount = uniform(50, 200)
            description = "Organic manure sale"
        
        revenue = Revenue(
            date_recorded=revenue_date,
            source=source,
            description=description,
            amount=amount,
            notes=choice([
                'Payment received',
                'Pending payment',
                'Partial payment',
                'Full payment',
                None
            ])
        )
        revenues.append(revenue)
    
    return revenues

def populate_database():
    """Main function to populate the database with mock data"""
    with app.app_context():
        try:
            # Clear existing data
            print("Clearing existing data...")
            db.drop_all()
            db.create_all()
            
            # Create mock cattle
            print("Creating mock cattle...")
            cattle_list = create_mock_cattle()
            db.session.add_all(cattle_list)
            db.session.commit()
            
            # Refresh cattle objects to get their IDs
            cattle_list = Cattle.query.all()
            
            # Create mock milk production records
            print("Creating mock milk production records...")
            milk_records = create_mock_milk_production(cattle_list)
            db.session.add_all(milk_records)
            db.session.commit()
            
            # Create mock feeding records
            print("Creating mock feeding records...")
            feeding_records = create_mock_feeding(cattle_list)
            db.session.add_all(feeding_records)
            db.session.commit()
            
            # Create mock expenses
            print("Creating mock expenses...")
            expenses = create_mock_expenses()
            db.session.add_all(expenses)
            db.session.commit()
            
            # Create mock revenues
            print("Creating mock revenues...")
            revenues = create_mock_revenue()
            db.session.add_all(revenues)
            db.session.commit()
            
            print("\n✅ Mock data populated successfully!")
            print(f"Created:")
            print(f"  - {len(cattle_list)} cattle records")
            print(f"  - {len(milk_records)} milk production records")
            print(f"  - {len(feeding_records)} feeding records")
            print(f"  - {len(expenses)} expense records")
            print(f"  - {len(revenues)} revenue records")
            
        except Exception as e:
            print(f"❌ Error populating database: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    populate_database()
