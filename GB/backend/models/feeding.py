from database import db
from datetime import datetime
from sqlalchemy import ForeignKey

class Feeding(db.Model):
    __tablename__ = 'feeding'
    
    id = db.Column(db.Integer, primary_key=True)
    cattle_id = db.Column(db.Integer, ForeignKey('cattle.id'), nullable=False)
    date_recorded = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    feed_type = db.Column(db.String(100), nullable=False)  # Hay, Grain, Silage, etc.
    quantity_kg = db.Column(db.Float, nullable=False)
    cost_per_unit = db.Column(db.Float, nullable=True)
    total_cost = db.Column(db.Float, nullable=True)
    supplier = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'Feeding(id={self.id}, cattle_id={self.cattle_id}, feed_type={self.feed_type}, qty={self.quantity_kg})'

    def to_dict(self):
        return {
            'id': self.id,
            'cattle_id': self.cattle_id,
            'date_recorded': self.date_recorded.isoformat(),
            'feed_type': self.feed_type,
            'quantity_kg': self.quantity_kg,
            'cost_per_unit': self.cost_per_unit,
            'total_cost': self.total_cost,
            'supplier': self.supplier,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
