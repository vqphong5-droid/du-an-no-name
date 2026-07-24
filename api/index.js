const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let dbPath;

if (process.env.VERCEL) {
  // On Vercel: copy DB to /tmp to allow read/write operations in read-only environment
  const srcDbPath = path.join(process.cwd(), 'brain.db');
  dbPath = path.join('/tmp', 'brain.db');
  
  if (!fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(srcDbPath, dbPath);
    } catch (e) {
      console.error("Failed to copy database to /tmp:", e);
      // Fallback to source database if copy fails
      dbPath = srcDbPath;
    }
  }
} else {
  // Local development: connect directly to local workspace file for persistence
  dbPath = path.join(process.cwd(), 'brain.db');
}

const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.prepare("PRAGMA foreign_keys = ON;").run();

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

  // --- API ROUTES ---

  // 1. PRODUCTS API
  if (pathname === '/api/products') {
    if (method === 'GET') {
      try {
        const rows = db.prepare("SELECT * FROM products ORDER BY id DESC").all();
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
        
        const stmt = db.prepare(`
          INSERT INTO products (name, type, price, description, remaining_quantity)
          VALUES (?, ?, ?, ?, ?)
        `);
        const runResult = stmt.run(name, type, parseFloat(price), description || '', qty);
        
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
        
        const stmt = db.prepare(`
          UPDATE products
          SET name = ?, type = ?, price = ?, description = ?, remaining_quantity = ?
          WHERE id = ?
        `);
        stmt.run(name, type, parseFloat(price), description || '', qty, id);
        
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
        db.prepare("DELETE FROM products WHERE id = ?").run(id);
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
        const rows = db.prepare("SELECT * FROM customers ORDER BY id DESC").all();
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
        const { name, phone, zalo, registered_at } = body;
        
        if (!name || !phone || !registered_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu tên, số điện thoại, hoặc ngày đăng ký!' }));
          return;
        }
        
        const stmt = db.prepare(`
          INSERT INTO customers (name, phone, zalo, registered_at)
          VALUES (?, ?, ?, ?)
        `);
        const runResult = stmt.run(name, phone, zalo || '', registered_at);
        
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: runResult.lastInsertRowid, name, phone, zalo, registered_at }));
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
        const { name, phone, zalo, registered_at } = body;
        
        if (!name || !phone || !registered_at) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }));
          return;
        }
        
        const stmt = db.prepare(`
          UPDATE customers
          SET name = ?, phone = ?, zalo = ?, registered_at = ?
          WHERE id = ?
        `);
        stmt.run(name, phone, zalo || '', registered_at, id);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id, name, phone, zalo, registered_at }));
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
        db.prepare("DELETE FROM customers WHERE id = ?").run(id);
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
        const rows = db.prepare(`
          SELECT o.id, o.customer_id, c.name as customer_name, c.phone as customer_phone,
                 o.product_id, p.name as product_name, p.type as product_type,
                 o.amount, o.status, o.created_at
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          JOIN products p ON o.product_id = p.id
          ORDER BY o.id DESC
        `).all();
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

        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(parseInt(product_id));
        if (!product) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Sản phẩm không tồn tại!' }));
          return;
        }

        const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(parseInt(customer_id));
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

        db.prepare("BEGIN TRANSACTION;").run();
        try {
          if (product.type === 'physical') {
            db.prepare(`
              UPDATE products
              SET remaining_quantity = remaining_quantity - 1
              WHERE id = ?
            `).run(product.id);
          }

          const stmt = db.prepare(`
            INSERT INTO orders (customer_id, product_id, amount, status, created_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          const runResult = stmt.run(
            parseInt(customer_id),
            parseInt(product_id),
            parseFloat(amount),
            status,
            created_at
          );
          
          db.prepare("COMMIT;").run();

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
        } catch (err) {
          db.prepare("ROLLBACK;").run();
          throw err;
        }
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
        
        const stmt = db.prepare(`
          UPDATE orders
          SET customer_id = ?, product_id = ?, amount = ?, status = ?, created_at = ?
          WHERE id = ?
        `);
        stmt.run(parseInt(customer_id), parseInt(product_id), parseFloat(amount), status, created_at, id);
        
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
        db.prepare("DELETE FROM orders WHERE id = ?").run(id);
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
