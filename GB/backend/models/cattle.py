from database import db
from datetime import datetime

class Cattle(db.Model):
    __tablename__ = 'cattle'
    
    id = db.Column(db.Integer, primary_key=True)
    tag_number = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    breed = db.Column(db.String(50), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    gender = db.Column(db.String(10), nullable=False)  # Male/Female
    weight = db.Column(db.Float, nullable=True)
    health_status = db.Column(db.String(50), default='Healthy')
    location = db.Column(db.String(100), nullable=True)
    purchase_date = db.Column(db.Date, nullable=True)
    purchase_price = db.Column(db.Float, nullable=True)
    current_status = db.Column(db.String(20), default='Active')  # Active/Sold/Deceased
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    milk_records = db.relationship('MilkProduction', backref='cattle', lazy=True, cascade='all, delete-orphan')
    feeding_records = db.relationship('Feeding', backref='cattle', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Cattle {self.tag_number}: {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'tag_number': self.tag_number,
            'name': self.name,
            'breed': self.breed,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'gender': self.gender,
            'weight': self.weight,
            'health_status': self.health_status,
            'location': self.location,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'purchase_price': self.purchase_price,
            'current_status': self.current_status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def calculate_age_in_months(self):
        if self.date_of_birth:
            today = datetime.now().date()
            return (today.year - self.date_of_birth.year) * 12 + (today.month - self.date_of_birth.month)
        return None
