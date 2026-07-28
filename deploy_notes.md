# Hướng dẫn triển khai lên VPS Ubuntu (Production)

Tài liệu này hướng dẫn chi tiết các bước để deploy ứng dụng Node.js này lên VPS Ubuntu của bạn.

---

## 1. Chuẩn bị môi trường trên VPS Ubuntu

Đăng nhập vào VPS qua SSH và cài đặt các công cụ cần thiết:

### Cài đặt Node.js (Version 22.x) & npm
```bash
# Thêm repository NodeSource cho Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Cài đặt Python 3 (Dùng để chạy setup database SQLite ban đầu)
Ubuntu thường tích hợp sẵn Python 3. Kiểm tra bằng cách chạy:
```bash
python3 --version
```
Nếu chưa có, cài đặt bằng:
```bash
sudo apt-get update
sudo apt-get install -y python3
```

### Cài đặt PM2 (Công cụ quản lý process Node.js cho production)
```bash
sudo npm install -y -g pm2
```

---

## 2. Tải mã nguồn về VPS

Di chuyển đến thư mục bạn muốn chứa ứng dụng (ví dụ `/var/www/my-website`):
```bash
git clone <URL_REPOSITOY_GITHUB_CUA_BAN> /var/www/my-website
cd /var/www/my-website
```

---

## 3. Cấu hình biến môi trường (.env)

Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
nano .env
```

Điền các giá trị thật của bạn:
*   `PORT`: Cổng bạn muốn chạy server (Ví dụ: `3000`).
*   `RESEND_API_KEY`: API Key của Resend dùng để gửi email tự động.
*   `GOOGLE_SCRIPT_SEPAY_URL`: URL Web App Google Apps Script nhận API SePay kiểm tra thanh toán.
*   `GOOGLE_SCRIPT_SURVEY_URL`: URL Web App Google Apps Script lưu form khảo sát sang Google Sheets.

*(Nhấn `Ctrl + O` để lưu, `Enter`, và `Ctrl + X` để thoát nano).*

---

## 4. Cài đặt Dependencies & Cấu hình Database ban đầu

### Cài đặt Node modules:
```bash
npm install --production
```

### Tạo cấu trúc cơ sở dữ liệu SQLite ban đầu (`brain.db`):
Chạy script python để tự động tạo các bảng và import data waitlist ban đầu:
```bash
python3 setup_tables.py
```

---

## 5. Khởi chạy và quản lý Server với PM2

Sử dụng PM2 để chạy server trong background và đảm bảo tự động restart khi server bị lỗi hoặc khi VPS restart.

### Khởi chạy server:
```bash
# Khởi chạy server và đặt tên process là "my-website"
PORT=3000 pm2 start server.js --name "my-website"
```
*(Nếu bạn muốn chạy port khác, hãy thay đổi biến `PORT` trước lệnh chạy).*

### Quản lý ứng dụng với PM2:
*   Xem trạng thái ứng dụng: `pm2 status`
*   Xem log trực tiếp: `pm2 logs my-website`
*   Restart server: `pm2 restart my-website`
*   Stop server: `pm2 stop my-website`

### Thiết lập tự động khởi động server cùng hệ thống (VPS reboot):
```bash
pm2 startup
# Chạy lệnh xuất hiện trên màn hình để cấu hình startup
pm2 save
```

---

## 6. (Tùy chọn) Cấu hình Nginx làm Reverse Proxy (Port 80 / 443)

Để trỏ domain riêng (ví dụ `cothienxaykenh.com`) về port `3000` của Node.js server:

### Cài đặt Nginx:
```bash
sudo apt-get install -y nginx
```

### Cấu hình block server:
Tạo cấu hình Nginx mới:
```bash
sudo nano /etc/nginx/sites-available/my-website
```

Thêm nội dung:
```nginx
server {
    listen 80;
    server_name cothienxaykenh.com www.cothienxaykenh.com; # Thay domain của bạn vào đây

    location / {
        proxy_pass http://localhost:3000; # Proxy sang port Node.js đang chạy
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Enable cấu hình và restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/my-website /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Cài đặt SSL miễn phí (Let's Encrypt):
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cothienxaykenh.com -d www.cothienxaykenh.com
```
*(Certbot sẽ tự động cấu hình HTTPS và redirect HTTP sang HTTPS cho bạn).*
