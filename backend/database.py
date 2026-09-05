from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    """Initialize database with Flask app"""
    db.init_app(app)
    
    with app.app_context():
        # Import all models to register them
        from models.cattle import Cattle
        from models.milk_production import MilkProduction
        from models.feeding import Feeding
        from models.expenses import Expenses
        from models.revenue import Revenue
        
        # Create all tables
        db.create_all()
        print("Database tables created successfully!")
