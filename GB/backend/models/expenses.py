from database import db
from datetime import datetime

class Expenses(db.Model):
    __tablename__ = 'expenses'
    
    id = db.Column(db.Integer, primary_key=True)
    date_recorded = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # Feed, Veterinary, Equipment, Labor, etc.
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    supplier = db.Column(db.String(100), nullable=True)
    receipt_number = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'Expenses(id={self.id}, category={self.category}, amount={self.amount})'

    def to_dict(self):
        return {
            'id': self.id,
            'date_recorded': self.date_recorded.isoformat(),
            'category': self.category,
            'description': self.description,
            'amount': self.amount,
            'supplier': self.supplier,
            'receipt_number': self.receipt_number,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
