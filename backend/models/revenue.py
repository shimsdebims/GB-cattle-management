from database import db
from datetime import datetime

class Revenue(db.Model):
    __tablename__ = 'revenue'
    
    id = db.Column(db.Integer, primary_key=True)
    date_recorded = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    source = db.Column(db.String(50), nullable=False)  # Milk, Cattle Sale, Subsidy, etc.
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'Revenue(id={self.id}, source={self.source}, amount={self.amount})'

    def to_dict(self):
        return {
            'id': self.id,
            'date_recorded': self.date_recorded.isoformat(),
            'source': self.source,
            'description': self.description,
            'amount': self.amount,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
