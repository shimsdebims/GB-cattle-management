from flask import Blueprint, request, jsonify
from database import db
from models.feeding import Feeding
from models.cattle import Cattle
from datetime import datetime, timedelta
from sqlalchemy import func

feeding_bp = Blueprint('feeding', __name__)

@feeding_bp.route('/', methods=['GET'])
def get_all_feeding_records():
    try:
        cattle_id = request.args.get('cattle_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = Feeding.query
        
        if cattle_id:
            query = query.filter(Feeding.cattle_id == cattle_id)
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Feeding.date_recorded >= start_date)
        
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Feeding.date_recorded <= end_date)
        
        records = query.order_by(Feeding.date_recorded.desc()).all()
        return jsonify([r.to_dict() for r in records]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@feeding_bp.route('/', methods=['POST'])
def create_feeding_record():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['cattle_id', 'feed_type', 'quantity_kg']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Verify cattle exists
        cattle = Cattle.query.get_or_404(data['cattle_id'])
        
        record = Feeding(
            cattle_id=data['cattle_id'],
            date_recorded=datetime.strptime(data.get('date_recorded', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d').date(),
            feed_type=data['feed_type'],
            quantity_kg=data['quantity_kg'],
            cost_per_unit=data.get('cost_per_unit'),
            total_cost=data.get('total_cost'),
            supplier=data.get('supplier'),
            notes=data.get('notes')
        )
        
        db.session.add(record)
        db.session.commit()
        
        return jsonify(record.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@feeding_bp.route('/<int:record_id>', methods=['PUT'])
def update_feeding_record(record_id):
    try:
        record = Feeding.query.get_or_404(record_id)
        data = request.get_json()
        
        if 'feed_type' in data:
            record.feed_type = data['feed_type']
        if 'quantity_kg' in data:
            record.quantity_kg = data['quantity_kg']
        if 'cost_per_unit' in data:
            record.cost_per_unit = data['cost_per_unit']
        if 'total_cost' in data:
            record.total_cost = data['total_cost']
        if 'supplier' in data:
            record.supplier = data['supplier']
        if 'notes' in data:
            record.notes = data['notes']
        
        record.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(record.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@feeding_bp.route('/<int:record_id>', methods=['DELETE'])
def delete_feeding_record(record_id):
    try:
        record = Feeding.query.get_or_404(record_id)
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'message': 'Feeding record deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
