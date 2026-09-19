from flask import Blueprint, request, jsonify
from database import db
from models.expenses import Expenses
from models.revenue import Revenue
from datetime import datetime
from sqlalchemy import func

financial_bp = Blueprint('financial', __name__)

@financial_bp.route('/expenses', methods=['GET'])
def get_expenses():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = Expenses.query

        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Expenses.date_recorded >= start_date)

        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Expenses.date_recorded <= end_date)

        expenses = query.order_by(Expenses.date_recorded.desc()).all()
        return jsonify([e.to_dict() for e in expenses]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@financial_bp.route('/revenue', methods=['GET'])
def get_revenue():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = Revenue.query

        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Revenue.date_recorded >= start_date)

        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Revenue.date_recorded <= end_date)

        revenues = query.order_by(Revenue.date_recorded.desc()).all()
        return jsonify([r.to_dict() for r in revenues]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@financial_bp.route('/expenses', methods=['POST'])
def create_expense():
    try:
        data = request.get_json()

        required_fields = ['category', 'description', 'amount']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        expense = Expenses(
            date_recorded=datetime.strptime(data.get('date_recorded', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d').date(),
            category=data['category'],
            description=data['description'],
            amount=data['amount'],
            supplier=data.get('supplier'),
            receipt_number=data.get('receipt_number'),
            notes=data.get('notes')
        )

        db.session.add(expense)
        db.session.commit()

        return jsonify(expense.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@financial_bp.route('/revenue', methods=['POST'])
def create_revenue():
    try:
        data = request.get_json()

        required_fields = ['source', 'description', 'amount']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        revenue = Revenue(
            date_recorded=datetime.strptime(data.get('date_recorded', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d').date(),
            source=data['source'],
            description=data['description'],
            amount=data['amount'],
            notes=data.get('notes')
        )

        db.session.add(revenue)
        db.session.commit()

        return jsonify(revenue.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@financial_bp.route('/summary', methods=['GET'])
def get_financial_summary():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query_expenses = Expenses.query
        query_revenue = Revenue.query

        if start_date:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query_expenses = query_expenses.filter(Expenses.date_recorded >= start_date)
            query_revenue = query_revenue.filter(Revenue.date_recorded >= start_date)

        if end_date:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query_expenses = query_expenses.filter(Expenses.date_recorded <= end_date)
            query_revenue = query_revenue.filter(Revenue.date_recorded <= end_date)

        total_expenses = query_expenses.with_entities(func.sum(Expenses.amount)).scalar() or 0
        total_revenue = query_revenue.with_entities(func.sum(Revenue.amount)).scalar() or 0
        net_income = total_revenue - total_expenses

        summary = {
            'total_expenses': total_expenses,
            'total_revenue': total_revenue,
            'net_income': net_income,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None
        }

        return jsonify(summary), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
