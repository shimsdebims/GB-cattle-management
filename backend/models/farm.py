from database import db
from datetime import datetime

class Farm(db.Model):
    __tablename__ = 'farms'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    address = db.Column(db.String(200), nullable=True)
    total_area_hectares = db.Column(db.Float, nullable=True)
    owner_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    fields = db.relationship('Field', backref='farm', lazy=True, cascade='all, delete-orphan')
    cattle = db.relationship('Cattle', backref='farm', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'address': self.address,
            'total_area_hectares': self.total_area_hectares,
            'owner_name': self.owner_name,
            'phone_number': self.phone_number,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'fields_count': len(self.fields),
            'cattle_count': len(self.cattle)
        }

class Field(db.Model):
    __tablename__ = 'fields'
    
    id = db.Column(db.Integer, primary_key=True)
    farm_id = db.Column(db.Integer, db.ForeignKey('farms.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    crop_type = db.Column(db.String(50), nullable=True)
    area_hectares = db.Column(db.Float, nullable=False)
    planting_date = db.Column(db.Date, nullable=True)
    expected_harvest_date = db.Column(db.Date, nullable=True)
    soil_type = db.Column(db.String(50), nullable=True)
    irrigation_type = db.Column(db.String(30), nullable=True)  # drip, sprinkler, manual
    status = db.Column(db.String(20), default='active')  # active, fallow, harvested
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    iot_devices = db.relationship('IoTDevice', backref='field', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'farm_id': self.farm_id,
            'name': self.name,
            'crop_type': self.crop_type,
            'area_hectares': self.area_hectares,
            'planting_date': self.planting_date.isoformat() if self.planting_date else None,
            'expected_harvest_date': self.expected_harvest_date.isoformat() if self.expected_harvest_date else None,
            'soil_type': self.soil_type,
            'irrigation_type': self.irrigation_type,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'devices_count': len(self.iot_devices)
        }
