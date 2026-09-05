from flask import Blueprint, request, jsonify
from database import db
from models.milk_production import MilkProduction
from models.cattle import Cattle
from datetime import datetime, timedelta
from sqlalchemy import func

milk_bp = Blueprint('milk', __name__)

@milk_bp.route('/', methods=['GET'])
def get_all_milk_records():
    try:
        cattle_id = request.args.get('cattle_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = MilkProduction.query
        
        if cattle_id:
            query = query.filter(MilkProduction.cattle_id == cattle_id)
        
        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(MilkProduction.date_recorded >= start_date)
        
        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(MilkProduction.date_recorded <= end_date)
        
        records = query.order_by(MilkProduction.date_recorded.desc()).all()
        return jsonify([r.to_dict() for r in records]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@milk_bp.route('/<int:record_id>', methods=['GET'])
def get_milk_record(record_id):
    try:
        record = MilkProduction.query.get_or_404(record_id)
        return jsonify(record.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@milk_bp.route('/', methods=['POST'])
def create_milk_record():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['cattle_id', 'quantity_liters']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Verify cattle exists
        cattle = Cattle.query.get_or_404(data['cattle_id'])
        
        record = MilkProduction(
            cattle_id=data['cattle_id'],
            date_recorded=datetime.strptime(data.get('date_recorded', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d').date(),
            quantity_liters=data['quantity_liters'],
            quality_score=data.get('quality_score'),
            notes=data.get('notes')
        )
        
        db.session.add(record)
        db.session.commit()
        
        return jsonify(record.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@milk_bp.route('/<int:record_id>', methods=['PUT'])
def update_milk_record(record_id):
    try:
        record = MilkProduction.query.get_or_404(record_id)
        data = request.get_json()
        
        if 'quantity_liters' in data:
            record.quantity_liters = data['quantity_liters']
        if 'quality_score' in data:
            record.quality_score = data['quality_score']
        if 'notes' in data:
            record.notes = data['notes']
        
        record.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(record.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@milk_bp.route('/<int:record_id>', methods=['DELETE'])
def delete_milk_record(record_id):
    try:
        record = MilkProduction.query.get_or_404(record_id)
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'message': 'Milk record deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@milk_bp.route('/summary', methods=['GET'])
def get_milk_summary():
    try:
        cattle_id = request.args.get('cattle_id')
        days = int(request.args.get('days', 30))
        
        start_date = datetime.now().date() - timedelta(days=days)
        
        query = db.session.query(
            MilkProduction.cattle_id,
            Cattle.name,
            Cattle.tag_number,
            func.sum(MilkProduction.quantity_liters).label('total_liters'),
            func.avg(MilkProduction.quantity_liters).label('avg_daily'),
            func.count(MilkProduction.id).label('record_count')
        ).join(Cattle).filter(MilkProduction.date_recorded >= start_date)
        
        if cattle_id:
            query = query.filter(MilkProduction.cattle_id == cattle_id)
        
        results = query.group_by(MilkProduction.cattle_id).all()
        
        summary = []
        for result in results:
            summary.append({
                'cattle_id': result.cattle_id,
                'cattle_name': result.name,
                'tag_number': result.tag_number,
                'total_liters': float(result.total_liters),
                'average_daily_liters': float(result.avg_daily),
                'record_count': result.record_count,
                'period_days': days
            })
        
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
