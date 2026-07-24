import sqlite3
import json
import os
import sys

db_path = 'brain.db'
json_path = 'waitlist.json'

def setup():
    # Make sure stdout uses UTF-8 to display Vietnamese correctly
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("=== Start Setting Up Database ===")
    
    # 1. Connect to SQLite database
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Enable foreign keys
    c.execute("PRAGMA foreign_keys = ON;")
    
    # 2. Create products table
    # remaining_quantity is only required for physical products.
    # We use a CHECK constraint: CHECK (type != 'physical' OR remaining_quantity IS NOT NULL)
    c.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('physical', 'digital', 'service')),
        price REAL NOT NULL,
        description TEXT,
        remaining_quantity INTEGER,
        CHECK (type != 'physical' OR remaining_quantity IS NOT NULL)
    )
    """)
    print("Table 'products' created/verified.")
    
    # Seed products if empty
    c.execute("SELECT COUNT(*) FROM products")
    if c.fetchone()[0] == 0:
        c.execute("""
        INSERT INTO products (id, name, type, price, description)
        VALUES 
        (1, 'GÓI ĐỒNG HÀNH 14 NGÀY', 'service', 50000.0, 'Kèm cặp 1-1, tối ưu kênh cá nhân và thiết lập ngách nội dung độc bản trong 14 ngày.'),
        (2, 'GÓI ĐỒNG HÀNH 30 NGÀY', 'service', 6990000.0, 'Kèm cặp 1-1 trực tiếp, tối ưu toàn diện từ thiết lập kênh kỹ thuật đến kịch bản nội dung hoàn chỉnh trong 30 ngày.')
        """)
        conn.commit()
        print("Default products seeded in database.")
    
    # 3. Create customers table
    # Unique phone number constraint to prevent duplicates.
    c.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        zalo TEXT,
        registered_at TEXT NOT NULL
    )
    """)
    print("Table 'customers' created/verified.")
    
    # 4. Create orders table
    c.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'cancelled', 'refunded')),
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
    """)
    print("Table 'orders' created/verified.")
    
    # Commit table creation
    conn.commit()
    
    # 5. Import waitlist.json data into customers table
    if os.path.exists(json_path):
        print(f"\nImporting data from {json_path}...")
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error parsing JSON: {e}")
                data = []
        
        imported_count = 0
        skipped_count = 0
        
        for item in data:
            name = item.get('name')
            phone = item.get('phone')
            zalo = item.get('zalo', '')
            registered_at = item.get('registered_at')
            
            if not name or not phone or not registered_at:
                print(f"Skipped invalid record: {item}")
                continue
                
            try:
                c.execute("""
                INSERT INTO customers (name, phone, zalo, registered_at)
                VALUES (?, ?, ?, ?)
                """, (name, phone, zalo, registered_at))
                conn.commit()
                imported_count += 1
                print(f"  + Imported customer: {name} ({phone})")
            except sqlite3.IntegrityError as e:
                if "UNIQUE constraint failed: customers.phone" in str(e):
                    skipped_count += 1
                    print(f"  - Skipped duplicate phone number: {name} ({phone})")
                else:
                    print(f"  x Error importing {name}: {e}")
                    
        print(f"Import complete: {imported_count} imported, {skipped_count} skipped duplicates.")
    else:
        print(f"\n{json_path} not found. Skipped import.")
        
    # 6. Verify and output database tables
    print("\n=== Database Verification ===")
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = c.fetchall()
    print("Available tables in database:")
    for t in tables:
        t_name = t[0]
        c.execute(f"SELECT COUNT(*) FROM [{t_name}]")
        count = c.fetchone()[0]
        print(f"  * Table '{t_name}': {count} rows")
        
    # Show imported customers
    print("\nImported Customers:")
    c.execute("SELECT * FROM customers")
    rows = c.fetchall()
    for row in rows:
        print(f"  ID: {row[0]}, Name: {row[1]}, Phone: {row[2]}, Zalo: {row[3]}, Registered At: {row[4]}")
        
    conn.close()
    print("\n=== Setup Complete ===")

if __name__ == '__main__':
    setup()
