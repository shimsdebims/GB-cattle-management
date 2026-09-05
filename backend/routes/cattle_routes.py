from flask import Blueprint, request, jsonify
from database import db
from models.cattle import Cattle
from datetime import datetime

cattle_bp = Blueprint('cattle', __name__)

@cattle_bp.route('/', methods=['GET'])
def get_all_cattle():
    try:
        cattle = Cattle.query.all()
        return jsonify([c.to_dict() for c in cattle]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cattle_bp.route('/<int:cattle_id>', methods=['GET'])
def get_cattle(cattle_id):
    try:
        cattle = Cattle.query.get_or_404(cattle_id)
        return jsonify(cattle.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@cattle_bp.route('/', methods=['POST'])
def create_cattle():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['tag_number', 'name', 'breed', 'date_of_birth', 'gender']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Parse date of birth
        dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        
        cattle = Cattle(
            tag_number=data['tag_number'],
            name=data['name'],
            breed=data['breed'],
            date_of_birth=dob,
            gender=data['gender'],
            weight=data.get('weight'),
            health_status=data.get('health_status', 'Healthy'),
            location=data.get('location'),
            purchase_date=datetime.strptime(data['purchase_date'], '%Y-%m-%d').date() if data.get('purchase_date') else None,
            purchase_price=data.get('purchase_price'),
            current_status=data.get('current_status', 'Active'),
            notes=data.get('notes')
        )
        
        db.session.add(cattle)
        db.session.commit()
        
        return jsonify(cattle.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cattle_bp.route('/<int:cattle_id>', methods=['PUT'])
def update_cattle(cattle_id):
    try:
        cattle = Cattle.query.get_or_404(cattle_id)
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            cattle.name = data['name']
        if 'breed' in data:
            cattle.breed = data['breed']
        if 'weight' in data:
            cattle.weight = data['weight']
        if 'health_status' in data:
            cattle.health_status = data['health_status']
        if 'location' in data:
            cattle.location = data['location']
        if 'current_status' in data:
            cattle.current_status = data['current_status']
        if 'notes' in data:
            cattle.notes = data['notes']
        
        cattle.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(cattle.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@cattle_bp.route('/<int:cattle_id>', methods=['DELETE'])
def delete_cattle(cattle_id):
    try:
        cattle = Cattle.query.get_or_404(cattle_id)
        db.session.delete(cattle)
        db.session.commit()
        
        return jsonify({'message': 'Cattle deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
