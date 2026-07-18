from database import db
from datetime import datetime
from sqlalchemy import ForeignKey

class MilkProduction(db.Model):
    __tablename__ = 'milk_production'
    
    id = db.Column(db.Integer, primary_key=True)
    cattle_id = db.Column(db.Integer, ForeignKey('cattle.id'), nullable=False)
    date_recorded = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    quantity_liters = db.Column(db.Float, nullable=False)
    quality_score = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'MilkProduction(id={self.id}, cattle_id={self.cattle_id}, date={self.date_recorded}, qty={self.quantity_liters})'

    def to_dict(self):
        return {
            'id': self.id,
            'cattle_id': self.cattle_id,
            'date_recorded': self.date_recorded.isoformat(),
            'quantity_liters': self.quantity_liters,
            'quality_score': self.quality_score,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
