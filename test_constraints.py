import sqlite3
import sys

db_path = 'brain.db'

def test():
    # Make sure stdout uses UTF-8 to display Vietnamese correctly
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("=== Testing Database Constraints ===")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("PRAGMA foreign_keys = ON;")
    
    # Test 1: Insert digital product without remaining_quantity (should succeed)
    try:
        c.execute("""
        INSERT INTO products (name, type, price, description, remaining_quantity)
        VALUES ('Khóa học xây kênh', 'digital', 199.99, 'Khóa học xây dựng thương hiệu cá nhân', NULL)
        """)
        conn.commit()
        prod_id_digital = c.lastrowid
        print(f"[SUCCESS] Test 1: Digital product created successfully with ID {prod_id_digital}.")
    except Exception as e:
        print(f"[FAIL] Test 1: Digital product insert failed: {e}")
        
    # Test 2: Insert physical product without remaining_quantity (should fail constraint check)
    try:
        c.execute("""
        INSERT INTO products (name, type, price, description, remaining_quantity)
        VALUES ('Micro thu âm Rode', 'physical', 89.00, 'Micro Rode Wireless Go II', NULL)
        """)
        conn.commit()
        print("[FAIL] Test 2: Physical product without remaining_quantity succeeded! CHECK constraint is not working.")
    except sqlite3.IntegrityError as e:
        print(f"[SUCCESS] Test 2: Failed correctly on physical product without remaining_quantity. Error: {e}")
        
    # Test 3: Insert physical product WITH remaining_quantity (should succeed)
    try:
        c.execute("""
        INSERT INTO products (name, type, price, description, remaining_quantity)
        VALUES ('Micro thu âm Rode', 'physical', 89.00, 'Micro Rode Wireless Go II', 10)
        """)
        conn.commit()
        prod_id_physical = c.lastrowid
        print(f"[SUCCESS] Test 3: Physical product created successfully with ID {prod_id_physical}.")
    except Exception as e:
        print(f"[FAIL] Test 3: Physical product insert failed: {e}")
        
    # Test 4: Insert duplicate customer phone (should fail UNIQUE constraint)
    try:
        c.execute("""
        INSERT INTO customers (name, phone, zalo, registered_at)
        VALUES ('Duplicate Person', '0912345678', 'dup_zalo', '2026-07-24 12:00:00')
        """)
        conn.commit()
        print("[FAIL] Test 4: Duplicate phone number succeeded! UNIQUE constraint is not working.")
    except sqlite3.IntegrityError as e:
        print(f"[SUCCESS] Test 4: Failed correctly on duplicate phone number. Error: {e}")
        
    # Test 5: Foreign key constraint - Insert order with invalid customer_id (should fail)
    try:
        c.execute("""
        INSERT INTO orders (customer_id, product_id, amount, status, created_at)
        VALUES (999, ?, 199.99, 'completed', '2026-07-24 12:00:00')
        """, (prod_id_digital,))
        conn.commit()
        print("[FAIL] Test 5: Order with invalid customer_id succeeded! FOREIGN KEY constraint is not working.")
    except sqlite3.IntegrityError as e:
        print(f"[SUCCESS] Test 5: Failed correctly on invalid customer_id. Error: {e}")
        
    # Test 6: Insert valid order (should succeed)
    try:
        c.execute("""
        INSERT INTO orders (customer_id, product_id, amount, status, created_at)
        VALUES (1, ?, 199.99, 'completed', '2026-07-24 12:00:00')
        """, (prod_id_digital,))
        conn.commit()
        order_id = c.lastrowid
        print(f"[SUCCESS] Test 6: Valid order created successfully with ID {order_id}.")
    except Exception as e:
        print(f"[FAIL] Test 6: Valid order insert failed: {e}")
        
    # Clean up test rows to keep DB clean
    print("\nCleaning up test data...")
    if 'order_id' in locals():
        c.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    if 'prod_id_digital' in locals():
        c.execute("DELETE FROM products WHERE id = ?", (prod_id_digital,))
    if 'prod_id_physical' in locals():
        c.execute("DELETE FROM products WHERE id = ?", (prod_id_physical,))
    conn.commit()
    conn.close()
    print("=== Testing Complete ===")

if __name__ == '__main__':
    test()
