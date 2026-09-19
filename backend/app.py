from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from database import init_db

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///cattle_management.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-string')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)
CORS(app)

# Initialize database
init_db(app)

# Import and register blueprints
from routes.cattle_routes import cattle_bp
from routes.milk_routes import milk_bp
from routes.feeding_routes import feeding_bp
from routes.analytics_routes import analytics_bp
from routes.financial_routes import financial_bp

app.register_blueprint(cattle_bp, url_prefix='/api/cattle')
app.register_blueprint(milk_bp, url_prefix='/api/milk')
app.register_blueprint(feeding_bp, url_prefix='/api/feeding')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
app.register_blueprint(financial_bp, url_prefix='/api/financial')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
