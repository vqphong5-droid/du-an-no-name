# Hướng Dẫn Deploy & Vận Hành Hệ Thống Cô Thiện Xây Kênh

Tài liệu hướng dẫn chi tiết cách cấu hình, triển khai và sao lưu dữ liệu cho dự án **Landing Page & Hệ Quản Trị Đào Tạo Cô Thiện Xây Kênh**.

---

## 1. Tổng Quan Kiến Trúc
- **Frontend**: HTML5, Vanilla CSS3, Javascript (Responsive, Dark Theme, Animations, VietQR).
- **Backend API**: Node.js HTTP Server (`server.js` khi chạy VPS local hoặc `api/index.js` khi chạy Serverless).
- **Cơ sở dữ liệu**: SQLite local (`brain.db`) hoặc Turso Cloud Database (`libsql`).
- **Email Service**: Resend API (`RESEND_API_KEY`) gửi mail xác nhận Waitlist và chuỗi Email Sequence 1-2-3.
- **Trang Admin**: Quản lý thông tin khách hàng, đơn hàng, hàng đợi email tại giao diện `/admin`.

---

## 2. Cấu Hình Biến Môi Trường (`.env`)
Tạo file `.env` tại thư mục gốc của dự án (file này đã được đưa vào `.gitignore` để bảo mật):

```env
# 1. Resend API Key (Bắt buộc để gửi email tự động)
RESEND_API_KEY=your_resend_api_key

# 2. Turso Cloud Database Configuration (Tùy chọn - Dùng khi deploy Vercel Serverless)
# TURSO_DATABASE_URL=libsql://your-db-name.turso.io
# TURSO_AUTH_TOKEN=your-turso-token
```

---

## 3. Hướng Dẫn Deploy

### Phương Án 1: Deploy lên VPS / Server riêng (Linux / Windows Server) - KHUYÊN DÙNG
Phương án này giữ nguyên cơ sở dữ liệu SQLite local `brain.db` chạy liên tục 24/7.

1. **Cài đặt Node.js**: Cài đặt Node.js v18 hoặc v20+ trên server.
2. **Tải mã nguồn**: Clone hoặc upload toàn bộ mã nguồn dự án lên thư mục server.
3. **Cài đặt dependencies**:
   ```bash
   npm install
   ```
4. **Khởi tạo cơ sở dữ liệu (Nếu chưa có `brain.db`)**:
   ```bash
   python setup_tables.py
   ```
5. **Quản lý tiến trình ứng dụng bằng PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "cothienxaykenh"
   pm2 save
   pm2 startup
   ```
6. **Cấu hình Nginx Proxy Pass (Tùy chọn)**:
   Trỏ tên miền về IP server và cấu hình Nginx proxy pass port `3000`.

---

### Phương Án 2: Deploy lên Vercel (Serverless)

1. **Đưa mã nguồn lên GitHub**.
2. **Import Project trên Vercel**: Đăng nhập Vercel, chọn **Add New Project** và chọn repository.
3. **Cấu hình Environment Variables** trong Vercel Dashboard:
   - Key: `RESEND_API_KEY` | Value: API Key của Resend.
   - (Tùy chọn) `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` nếu sử dụng Cloud DB Turso.
4. **Deploy**: Bấm nút **Deploy**. Vercel sẽ tự động đọc cấu hình `vercel.json` để định tuyến API và tạo Vercel Cron tự động gọi `/api/cron`.

---

## 4. Sao Lưu & Phục Hồi Dữ Liệu (`brain.db`)

### Sao lưu thủ công
- Sao lưu file `brain.db` thành `brain.db.bak` hoặc tạo thư mục `backups/` và lưu file `backups/brain_backup_YYYYMMDD.db`.

### Phục hồi
- Đổi tên file backup lại thành `brain.db` và khởi động lại server (`pm2 restart cothienxaykenh`).

---

## 5. Các Đường Dẫn API & Giao Diện
- **Trang chủ**: `http://<domain>/`
- **Trang thanh toán**: `http://<domain>/checkout`
- **Trang quản trị Admin**: `http://<domain>/admin`
- **API Khách hàng**: `/api/customers` (GET, POST, PUT, DELETE)
- **API Đơn hàng**: `/api/orders` (GET, POST, PUT, DELETE)
- **API Cron Email**: `/api/cron` (GET)
