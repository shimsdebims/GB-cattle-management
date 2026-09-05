import os
import sys

# Ensure backend package path is discoverable when running from GB/backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Use in-memory SQLite for tests
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

from app import app  # app initializes DB on import via init_db


def run_smoke_tests():
    client = app.test_client()

    # Health
    resp = client.get('/api/health')
    assert resp.status_code == 200
    print('Health endpoint OK')

    # Create cattle
    cattle_payload = {
        'tag_number': 'COW-TEST-001',
        'name': 'Test Cow',
        'breed': 'Jersey',
        'date_of_birth': '2020-01-01',
        'gender': 'Female'
    }

    r = client.post('/api/cattle', json=cattle_payload)
    assert r.status_code == 201, f"Create cattle failed: {r.get_data(as_text=True)}"
    created = r.get_json()
    cattle_id = created.get('id')
    print('Create cattle OK, id=', cattle_id)

    # Create milk
    milk_payload = {
        'cattle_id': cattle_id,
        'quantity_liters': 12.5,
        'date_recorded': '2024-07-18'
    }

    r2 = client.post('/api/milk', json=milk_payload)
    assert r2.status_code == 201, f"Create milk failed: {r2.get_data(as_text=True)}"
    print('Create milk OK')

    # Summary
    r3 = client.get('/api/milk/summary?days=7')
    assert r3.status_code == 200, f"Summary failed: {r3.get_data(as_text=True)}"
    summary = r3.get_json()
    assert isinstance(summary, list)
    print('Summary OK, entries=', len(summary))

    print('All smoke tests passed')


if __name__ == '__main__':
    run_smoke_tests()
