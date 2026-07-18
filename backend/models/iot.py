from database import db
from datetime import datetime

class IoTDevice(db.Model):
    __tablename__ = 'iot_devices'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), unique=True, nullable=False)
    field_id = db.Column(db.Integer, db.ForeignKey('fields.id'), nullable=False)
    device_type = db.Column(db.String(30), nullable=False)  # soil_sensor, weather_station, camera
    name = db.Column(db.String(100), nullable=False)
    location_lat = db.Column(db.Float, nullable=True)
    location_lng = db.Column(db.Float, nullable=True)
    battery_level = db.Column(db.Float, nullable=True)
    signal_strength = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), default='active')  # active, inactive, maintenance
    last_seen = db.Column(db.DateTime, nullable=True)
    firmware_version = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sensor_readings = db.relationship('SensorReading', backref='device', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'field_id': self.field_id,
            'device_type': self.device_type,
            'name': self.name,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'battery_level': self.battery_level,
            'signal_strength': self.signal_strength,
            'status': self.status,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'firmware_version': self.firmware_version,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class SensorReading(db.Model):
    __tablename__ = 'sensor_readings'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('iot_devices.device_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Environmental data
    soil_moisture = db.Column(db.Float, nullable=True)  # percentage
    soil_temperature = db.Column(db.Float, nullable=True)  # celsius
    air_temperature = db.Column(db.Float, nullable=True)  # celsius
    humidity = db.Column(db.Float, nullable=True)  # percentage
    ph_level = db.Column(db.Float, nullable=True)  # 0-14 scale
    light_intensity = db.Column(db.Float, nullable=True)  # lux
    rainfall = db.Column(db.Float, nullable=True)  # mm
    wind_speed = db.Column(db.Float, nullable=True)  # m/s
    
    # Device status
    battery_voltage = db.Column(db.Float, nullable=True)
    signal_strength = db.Column(db.Float, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'soil_moisture': self.soil_moisture,
            'soil_temperature': self.soil_temperature,
            'air_temperature': self.air_temperature,
            'humidity': self.humidity,
            'ph_level': self.ph_level,
            'light_intensity': self.light_intensity,
            'rainfall': self.rainfall,
            'wind_speed': self.wind_speed,
            'battery_voltage': self.battery_voltage,
            'signal_strength': self.signal_strength
        }

class IrrigationEvent(db.Model):
    __tablename__ = 'irrigation_events'
    
    id = db.Column(db.Integer, primary_key=True)
    field_id = db.Column(db.Integer, db.ForeignKey('fields.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    water_amount_liters = db.Column(db.Float, nullable=True)
    trigger_type = db.Column(db.String(20), nullable=False)  # manual, scheduled, sensor_triggered
    triggered_by_device = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'field_id': self.field_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'water_amount_liters': self.water_amount_liters,
            'trigger_type': self.trigger_type,
            'triggered_by_device': self.triggered_by_device,
            'notes': self.notes,
            'created_at': self.created_at.isoformat()
        }
