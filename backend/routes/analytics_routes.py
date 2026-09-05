from flask import Blueprint, request, jsonify, send_file
from database import db
from models.milk_production import MilkProduction
from models.feeding import Feeding
from models.cattle import Cattle
from models.expenses import Expenses
from models.revenue import Revenue
from datetime import datetime, timedelta
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import io
import base64
import pandas as pd
from sqlalchemy import func

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/milk-production-chart', methods=['GET'])
def milk_production_chart():
    try:
        cattle_id = request.args.get('cattle_id')
        days = int(request.args.get('days', 30))
        chart_type = request.args.get('chart_type', 'line')  # line, bar
        
        start_date = datetime.now().date() - timedelta(days=days)
        
        query = db.session.query(
            MilkProduction.date_recorded,
            func.sum(MilkProduction.quantity_liters).label('total_liters')
        ).filter(MilkProduction.date_recorded >= start_date)
        
        if cattle_id:
            query = query.filter(MilkProduction.cattle_id == cattle_id)
        
        results = query.group_by(MilkProduction.date_recorded).order_by(MilkProduction.date_recorded).all()
        
        if not results:
            return jsonify({'error': 'No data found for the specified period'}), 404
        
        # Prepare data
        dates = [result.date_recorded for result in results]
        quantities = [float(result.total_liters) for result in results]
        
        # Create plot
        plt.figure(figsize=(12, 6))
        if chart_type == 'bar':
            plt.bar(dates, quantities, color='skyblue')
        else:
            plt.plot(dates, quantities, marker='o', linewidth=2, markersize=6)
        
        plt.title(f'Milk Production Over Last {days} Days', fontsize=16)
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Liters', fontsize=12)
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        # Convert to base64 string
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return jsonify({
            'chart': img_base64,
            'data': {
                'dates': [d.isoformat() for d in dates],
                'quantities': quantities
            }
        }), 200
        
    except Exception as e:
        plt.close()
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/cattle-comparison', methods=['GET'])
def cattle_comparison():
    try:
        days = int(request.args.get('days', 30))
        start_date = datetime.now().date() - timedelta(days=days)
        
        # Get milk production by cattle
        query = db.session.query(
            Cattle.name,
            Cattle.tag_number,
            func.sum(MilkProduction.quantity_liters).label('total_liters'),
            func.avg(MilkProduction.quantity_liters).label('avg_daily')
        ).join(MilkProduction).filter(
            MilkProduction.date_recorded >= start_date
        ).group_by(Cattle.id, Cattle.name, Cattle.tag_number).all()
        
        if not query:
            return jsonify({'error': 'No data found for the specified period'}), 404
        
        # Prepare data
        cattle_names = [f"{result.name} ({result.tag_number})" for result in query]
        total_production = [float(result.total_liters) for result in query]
        avg_daily = [float(result.avg_daily) for result in query]
        
        # Create comparison chart
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Total production chart
        ax1.bar(cattle_names, total_production, color='lightgreen')
        ax1.set_title(f'Total Milk Production - Last {days} Days')
        ax1.set_ylabel('Total Liters')
        ax1.tick_params(axis='x', rotation=45)
        
        # Average daily production chart
        ax2.bar(cattle_names, avg_daily, color='lightcoral')
        ax2.set_title(f'Average Daily Production - Last {days} Days')
        ax2.set_ylabel('Average Liters/Day')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        
        # Convert to base64
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return jsonify({
            'chart': img_base64,
            'data': {
                'cattle_names': cattle_names,
                'total_production': total_production,
                'average_daily': avg_daily
            }
        }), 200
        
    except Exception as e:
        plt.close()
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/financial-overview', methods=['GET'])
def financial_overview():
    try:
        days = int(request.args.get('days', 30))
        start_date = datetime.now().date() - timedelta(days=days)
        
        # Get expenses by category
        expense_query = db.session.query(
            Expenses.category,
            func.sum(Expenses.amount).label('total_amount')
        ).filter(Expenses.date_recorded >= start_date).group_by(Expenses.category).all()
        
        # Get revenue by source
        revenue_query = db.session.query(
            Revenue.source,
            func.sum(Revenue.amount).label('total_amount')
        ).filter(Revenue.date_recorded >= start_date).group_by(Revenue.source).all()
        
        # Create financial overview chart
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        if expense_query:
            expense_categories = [result.category for result in expense_query]
            expense_amounts = [float(result.total_amount) for result in expense_query]
            ax1.pie(expense_amounts, labels=expense_categories, autopct='%1.1f%%', startangle=90)
            ax1.set_title(f'Expenses by Category - Last {days} Days')
        else:
            ax1.text(0.5, 0.5, 'No expense data', ha='center', va='center', transform=ax1.transAxes)
            ax1.set_title('No Expense Data')
        
        if revenue_query:
            revenue_sources = [result.source for result in revenue_query]
            revenue_amounts = [float(result.total_amount) for result in revenue_query]
            ax2.pie(revenue_amounts, labels=revenue_sources, autopct='%1.1f%%', startangle=90)
            ax2.set_title(f'Revenue by Source - Last {days} Days')
        else:
            ax2.text(0.5, 0.5, 'No revenue data', ha='center', va='center', transform=ax2.transAxes)
            ax2.set_title('No Revenue Data')
        
        plt.tight_layout()
        
        # Convert to base64
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return jsonify({
            'chart': img_base64,
            'data': {
                'expenses': {
                    'categories': expense_categories if expense_query else [],
                    'amounts': expense_amounts if expense_query else []
                },
                'revenue': {
                    'sources': revenue_sources if revenue_query else [],
                    'amounts': revenue_amounts if revenue_query else []
                }
            }
        }), 200
        
    except Exception as e:
        plt.close()
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/feeding-cost-analysis', methods=['GET'])
def feeding_cost_analysis():
    try:
        cattle_id = request.args.get('cattle_id')
        days = int(request.args.get('days', 30))
        start_date = datetime.now().date() - timedelta(days=days)
        
        query = db.session.query(
            Feeding.feed_type,
            func.sum(Feeding.quantity_kg).label('total_quantity'),
            func.sum(Feeding.total_cost).label('total_cost')
        ).filter(Feeding.date_recorded >= start_date)
        
        if cattle_id:
            query = query.filter(Feeding.cattle_id == cattle_id)
        
        results = query.group_by(Feeding.feed_type).all()
        
        if not results:
            return jsonify({'error': 'No feeding data found for the specified period'}), 404
        
        # Prepare data
        feed_types = [result.feed_type for result in results]
        quantities = [float(result.total_quantity) for result in results]
        costs = [float(result.total_cost) if result.total_cost else 0 for result in results]
        
        # Create feeding analysis chart
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Quantity by feed type
        ax1.bar(feed_types, quantities, color='orange')
        ax1.set_title(f'Feed Quantity by Type - Last {days} Days')
        ax1.set_ylabel('Quantity (kg)')
        ax1.tick_params(axis='x', rotation=45)
        
        # Cost by feed type
        ax2.bar(feed_types, costs, color='red')
        ax2.set_title(f'Feed Cost by Type - Last {days} Days')
        ax2.set_ylabel('Cost ($)')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        
        # Convert to base64
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return jsonify({
            'chart': img_base64,
            'data': {
                'feed_types': feed_types,
                'quantities': quantities,
                'costs': costs
            }
        }), 200
        
    except Exception as e:
        plt.close()
        return jsonify({'error': str(e)}), 500
