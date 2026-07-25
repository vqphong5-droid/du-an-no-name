const fs = require('node:fs');
const path = require('node:path');

let db;

// 1. DATABASE ADAPTER SELECTION (TURSO CLOUD SQLite vs LOCAL SQLite)
if (process.env.TURSO_DATABASE_URL) {
  // Use Turso Cloud DB (for Vercel persistence)
  const { createClient } = require('@libsql/client');
  
  let rawUrl = process.env.TURSO_DATABASE_URL;
  // Automatically rewrite protocol from libsql:// to https:// for serverless compatibility
  if (rawUrl.startsWith('libsql://')) {
    rawUrl = rawUrl.replace('libsql://', 'https://');
  }
  
  const client = createClient({
    url: rawUrl,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  db = {
    all: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return res.rows;
    },
    run: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return { lastInsertRowid: Number(res.lastInsertRowid) };
    },
    get: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return res.rows[0] || null;
    },
    executeTransaction: async (queries) => {
      const res = await client.batch(queries, "write");
      const lastInsertRes = res[res.length - 1];
      return { lastInsertRowid: Number(lastInsertRes.lastInsertRowid) };
    }
  };
} else {
  // Use local SQLite (synchronous underlying, wrapped in async interface)
  const { DatabaseSync } = require('node:sqlite');
  
  let dbPath;
  if (process.env.VERCEL) {
    // Vercel fallback (should copy default brain.db to writable /tmp)
    const srcDbPath = path.join(process.cwd(), 'brain.db');
    dbPath = path.join('/tmp', 'brain.db');
    if (!fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(srcDbPath, dbPath);
      } catch (e) {
        console.error("Failed to copy database to /tmp:", e);
        dbPath = srcDbPath;
      }
    }
  } else {
    // Local dev environment
    dbPath = path.join(process.cwd(), 'brain.db');
  }

  const localDb = new DatabaseSync(dbPath);
  localDb.prepare("PRAGMA foreign_keys = ON;").run();

  db = {
    all: async (sql, params = []) => {
      return localDb.prepare(sql).all(...params);
    },
    run: async (sql, params = []) => {
      const info = localDb.prepare(sql).run(...params);
      return { lastInsertRowid: Number(info.lastInsertRowid) };
    },
    get: async (sql, params = []) => {
      return localDb.prepare(sql).get(...params);
    },
    executeTransaction: async (queries) => {
      localDb.prepare("BEGIN TRANSACTION;").run();
      try {
        let lastInsertRowid = null;
        for (const q of queries) {
          const info = localDb.prepare(q.sql).run(...q.args);
          lastInsertRowid = info.lastInsertRowid;
        }
        localDb.prepare("COMMIT;").run();
        return { lastInsertRowid: Number(lastInsertRowid) };
      } catch (err) {
        localDb.prepare("ROLLBACK;").run();
        throw err;
      }
    }
  };
}

// 2. SELF-HEALING DATABASE INITIALIZATION
let dbInitialized = false;
async function ensureDbInitialized() {
  if (dbInitialized) return;
  
  try {
    // Create products table
    await db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('physical', 'digital', 'service')),
        price REAL NOT NULL,
        description TEXT,
        remaining_quantity INTEGER,
        CHECK (type != 'physical' OR remaining_quantity IS NOT NULL)
      )
    `);
    
    // Create customers table
    await db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        zalo TEXT,
        registered_at TEXT NOT NULL
      )
    `);
    
    // Create orders table
    await db.run(`
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
    `);
    
    // Auto-populate products table if empty
    const productsCount = await db.get("SELECT COUNT(*) as count FROM products");
    if (productsCount && (productsCount.count === 0 || productsCount.count === '0')) {
      await db.run(`
        INSERT INTO products (id, name, type, price, description)
        VALUES (1, 'GÓI ĐỒNG HÀNH 14 NGÀY', 'service', 50000.0, 'Kèm cặp 1-1, tối ưu kênh cá nhân và thiết lập ngách nội dung độc bản trong 14 ngày.')
      `);
      await db.run(`
        INSERT INTO products (id, name, type, price, description)
        VALUES (2, 'GÓI ĐỒNG HÀNH 30 NGÀY', 'service', 6990000.0, 'Kèm cặp 1-1 trực tiếp, tối ưu toàn diện từ thiết lập kênh kỹ thuật đến kịch bản nội dung hoàn chỉnh trong 30 ngày.')
      `);
      console.log("Default products populated in database.");
    }
    
    // Auto-import waitlist if customers table is empty
    const customersCount = await db.get("SELECT COUNT(*) as count FROM customers");
    if (customersCount && (customersCount.count === 0 || customersCount.count === '0')) {
      const waitlistPath = path.join(process.cwd(), 'waitlist.json');
      if (fs.existsSync(waitlistPath)) {
        try {
          const fileData = fs.readFileSync(waitlistPath, 'utf-8');
          const data = JSON.parse(fileData);
          for (const item of data) {
            const { name, phone, email, zalo, registered_at } = item;
            if (name && phone && registered_at) {
              try {
                await db.run(`
                  INSERT INTO customers (name, phone, email, zalo, registered_at)
                  VALUES (?, ?, ?, ?, ?)
                `, [name, phone, email || '', zalo || '', registered_at]);
              } catch (e) {
                // Ignore duplicates
              }
            }
          }
          console.log("Waitlist data auto-imported to database.");
        } catch (err) {
          console.error("Auto-import waitlist failed:", err);
        }
      }
    }
    
    dbInitialized = true;
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// Helper to parse JSON request body
function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Exported Request Handler for Vercel Serverless Function & Local server
module.exports = async (req, res) => {
  // Ensure tables and initial data exist
  await ensureDbInitialized();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- DEBUG ROUTE ---
  if (pathname === '/api/debug') {
    const urlVal = process.env.TURSO_DATABASE_URL || '';
    const tokenVal = process.env.TURSO_AUTH_TOKEN || '';
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      isVercel: !!process.env.VERCEL,
      hasTursoUrl: !!urlVal,
      tursoUrlInfo: urlVal ? `${urlVal.substring(0, 15)}... (${urlVal.length} chars)` : 'empty',
      hasTursoToken: !!tokenVal,
      tursoTokenInfo: tokenVal ? `${tokenVal.substring(0, 15)}... (${tokenVal.length} chars)` : 'empty',
      activeDriver: process.env.TURSO_DATABASE_URL ? 'turso' : 'local',
      tmpDbExists: fs.existsSync('/tmp/brain.db'),
      processEnvKeys: Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('VERCEL'))
    }));
    return;
  }

  // --- API ROUTES ---

  // 1. PRODUCTS API
  if (pathname === '/api/products') {
    if (method === 'GET') {
      try {
        const rows = await db.all("SELECT * FROM products ORDER BY id DESC");
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    
    if (method === 'POST') {
      try {
        const body = await getJsonBody(req);
        const { name, type, price, description, remaining_quantity } = body;
        
        if (!name || !type || price === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc (tên, loại, giá)' }));
          return;
        }

        if (type === 'physical' && (remaining_quantity === undefined || remaining_quantity === null)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Sản phẩm vật lý bắt buộc phải nhập số lượng còn lại!' }));
          return;
        }

        const qty = type === 'physical' ? parseInt(remaining_quantity) : null;
        
        const runResult = await db.run(`
          INSERT INTO products (name, type, price, description, remaining_quantity)
          VALUES (?, ?, ?, ?, ?)
        `, [name, type, parseFloat(price), description || '', qty]);
        
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: runResult.lastInsertRowid, name, type, price, description, remaining_quantity: qty }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/products/')) {
    const id = parseInt(pathname.substring('/api/products/'.length));
    
    if (method === 'PUT') {
      try {
        const body = await getJsonBody(req);
        const { name, type, price, description, remaining_quantity } = body;
        
        if (!name || !type || price === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }));
          return;
        }

        if (type === 'physical' && (remaining_quantity === undefined || remaining_quantity === null)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Sản phẩm vật lý bắt buộc phải có số lượng!' }));
          return;
        }

        const qty = type === 'physical' ? parseInt(remaining_quantity) : null;
        
        await db.run(`
          UPDATE products
          SET name = ?, type = ?, price = ?, description = ?, remaining_quantity = ?
          WHERE id = ?
        `, [name, type, parseFloat(price), description || '', qty, id]);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id, name, type, price, description, remaining_quantity: qty }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (method === 'DELETE') {
      try {
        await db.run("DELETE FROM products WHERE id = ?", [id]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 2. CUSTOMERS API
  if (pathname === '/api/customers') {
    if (method === 'GET') {
      try {
        const rows = await db.all("SELECT * FROM customers ORDER BY id DESC");
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    
    if (method === 'POST') {
      try {
        const body = await getJsonBody(req);
        const { name, phone, email, zalo, registered_at } = body;
        
        if (!name || !phone || !registered_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu tên, số điện thoại, hoặc ngày đăng ký!' }));
          return;
        }
        
        const runResult = await db.run(`
          INSERT INTO customers (name, phone, email, zalo, registered_at)
          VALUES (?, ?, ?, ?, ?)
        `, [name, phone, email || '', zalo || '', registered_at]);
        
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: runResult.lastInsertRowid, name, phone, email, zalo, registered_at }));
      } catch (e) {
        let errMsg = e.message;
        if (errMsg.includes('UNIQUE constraint failed: customers.phone')) {
          errMsg = 'Số điện thoại này đã tồn tại trong danh sách khách hàng!';
        }
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/customers/')) {
    const id = parseInt(pathname.substring('/api/customers/'.length));
    
    if (method === 'PUT') {
      try {
        const body = await getJsonBody(req);
        const { name, phone, email, zalo, registered_at } = body;
        
        if (!name || !phone || !registered_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }));
          return;
        }
        
        await db.run(`
          UPDATE customers
          SET name = ?, phone = ?, email = ?, zalo = ?, registered_at = ?
          WHERE id = ?
        `, [name, phone, email || '', zalo || '', registered_at, id]);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id, name, phone, email, zalo, registered_at }));
      } catch (e) {
        let errMsg = e.message;
        if (errMsg.includes('UNIQUE constraint failed: customers.phone')) {
          errMsg = 'Số điện thoại này đã tồn tại!';
        }
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }

    if (method === 'DELETE') {
      try {
        await db.run("DELETE FROM customers WHERE id = ?", [id]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 3. ORDERS API
  if (pathname === '/api/orders') {
    if (method === 'GET') {
      try {
        const rows = await db.all(`
          SELECT o.id, o.customer_id, c.name as customer_name, c.phone as customer_phone,
                 o.product_id, p.name as product_name, p.type as product_type,
                 o.amount, o.status, o.created_at
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          JOIN products p ON o.product_id = p.id
          ORDER BY o.id DESC
        `);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    
    if (method === 'POST') {
      try {
        const body = await getJsonBody(req);
        const { customer_id, product_id, amount, status, created_at } = body;
        
        if (!customer_id || !product_id || amount === undefined || !status || !created_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin đơn hàng!' }));
          return;
        }

        const product = await db.get("SELECT * FROM products WHERE id = ?", [parseInt(product_id)]);
        if (!product) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Sản phẩm không tồn tại!' }));
          return;
        }

        const customer = await db.get("SELECT * FROM customers WHERE id = ?", [parseInt(customer_id)]);
        if (!customer) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Khách hàng không tồn tại!' }));
          return;
        }

        if (product.type === 'physical') {
          if (product.remaining_quantity === null || product.remaining_quantity === undefined) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi: Sản phẩm vật lý không có số lượng tồn kho hợp lệ!' }));
            return;
          }
          if (product.remaining_quantity <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: `Sản phẩm '${product.name}' đã hết hàng!` }));
            return;
          }
        }

        // Build transaction query batch
        const queries = [];
        if (product.type === 'physical') {
          queries.push({
            sql: `UPDATE products SET remaining_quantity = remaining_quantity - 1 WHERE id = ?`,
            args: [product.id]
          });
        }
        queries.push({
          sql: `INSERT INTO orders (customer_id, product_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)`,
          args: [parseInt(customer_id), parseInt(product_id), parseFloat(amount), status, created_at]
        });

        const runResult = await db.executeTransaction(queries);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          id: runResult.lastInsertRowid,
          customer_id,
          customer_name: customer.name,
          product_id,
          product_name: product.name,
          product_type: product.type,
          amount,
          status,
          created_at
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/orders/')) {
    const id = parseInt(pathname.substring('/api/orders/'.length));
    
    if (method === 'PUT') {
      try {
        const body = await getJsonBody(req);
        const { customer_id, product_id, amount, status, created_at } = body;
        
        if (!customer_id || !product_id || amount === undefined || !status || !created_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin đơn hàng!' }));
          return;
        }
        
        await db.run(`
          UPDATE orders
          SET customer_id = ?, product_id = ?, amount = ?, status = ?, created_at = ?
          WHERE id = ?
        `, [parseInt(customer_id), parseInt(product_id), parseFloat(amount), status, created_at, id]);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id, customer_id, product_id, amount, status, created_at }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (method === 'DELETE') {
      try {
        await db.run("DELETE FROM orders WHERE id = ?", [id]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // Fallback for API route not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API endpoint not found' }));
};
