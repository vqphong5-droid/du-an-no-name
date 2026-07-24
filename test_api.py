import urllib.request
import json
import sys

BASE_URL = 'http://localhost:3000'

def request(path, method='GET', data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header('Content-Type', 'application/json')
    
    body = None
    if data:
        body = json.dumps(data).encode('utf-8')
        
    try:
        with urllib.request.urlopen(req, data=body) as response:
            status = response.status
            res_body = response.read().decode('utf-8')
            return status, json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        status = e.code
        res_body = e.read().decode('utf-8')
        return status, json.loads(res_body) if res_body else None

def test_api():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
        
    print("=== Testing Admin Panel Backend API ===")
    
    # 1. Get products
    status, prods = request('/api/products')
    print(f"Products count: {len(prods)}")
    
    # 2. Add a physical product
    physical_product_data = {
        'name': 'Test Physical Product',
        'type': 'physical',
        'price': 150000,
        'description': 'Description for physical product',
        'remaining_quantity': 10
    }
    status, new_phys_prod = request('/api/products', 'POST', physical_product_data)
    print(f"Created physical product: ID={new_phys_prod.get('id')}, Qty={new_phys_prod.get('remaining_quantity')}")
    phys_id = new_phys_prod.get('id')
    
    # 3. Add a digital product
    digital_product_data = {
        'name': 'Test Digital Product',
        'type': 'digital',
        'price': 99000,
        'description': 'Description for digital product',
        'remaining_quantity': None
    }
    status, new_dig_prod = request('/api/products', 'POST', digital_product_data)
    print(f"Created digital product: ID={new_dig_prod.get('id')}, Qty={new_dig_prod.get('remaining_quantity')}")
    dig_id = new_dig_prod.get('id')
    
    # 4. Create a test customer
    customer_data = {
        'name': 'Test Client API',
        'phone': '0999999999',
        'zalo': 'zalo_api',
        'registered_at': '2026-07-24 12:00:00'
    }
    status, new_cust = request('/api/customers', 'POST', customer_data)
    print(f"Created customer: ID={new_cust.get('id')}, Name={new_cust.get('name')}")
    cust_id = new_cust.get('id')
    
    # 5. Create an order for physical product (should decrement stock)
    order_phys_data = {
        'customer_id': cust_id,
        'product_id': phys_id,
        'amount': 150000,
        'status': 'completed',
        'created_at': '2026-07-24 12:01:00'
    }
    status, new_order_phys = request('/api/orders', 'POST', order_phys_data)
    print(f"Created order for physical product. Response status={status}")
    
    # Verify stock of physical product is decremented (should be 9)
    status, prods_after = request('/api/products')
    updated_phys_prod = next(p for p in prods_after if p['id'] == phys_id)
    print(f"Physical product stock after order: {updated_phys_prod.get('remaining_quantity')} (Expected: 9)")
    
    # 6. Create an order for digital product (should NOT decrement stock)
    order_dig_data = {
        'customer_id': cust_id,
        'product_id': dig_id,
        'amount': 99000,
        'status': 'completed',
        'created_at': '2026-07-24 12:02:00'
    }
    status, new_order_dig = request('/api/orders', 'POST', order_dig_data)
    print(f"Created order for digital product. Response status={status}")
    
    # Verify stock of digital product is still null
    status, prods_after2 = request('/api/products')
    updated_dig_prod = next(p for p in prods_after2 if p['id'] == dig_id)
    print(f"Digital product stock after order: {updated_dig_prod.get('remaining_quantity')} (Expected: None)")
    
    # 7. Clean up test rows
    print("\nCleaning up test records from database...")
    request(f"/api/orders/{new_order_phys.get('id')}", 'DELETE')
    request(f"/api/orders/{new_order_dig.get('id')}", 'DELETE')
    request(f"/api/products/{phys_id}", 'DELETE')
    request(f"/api/products/{dig_id}", 'DELETE')
    request(f"/api/customers/{cust_id}", 'DELETE')
    print("Clean up finished.")
    print("=== API Testing Complete ===")

if __name__ == '__main__':
    test_api()
