# Nhật Ký Kiểm Thử Luồng Khách Hàng (Customer Flow Test Log)

**Dự án:** Xây Kênh 5.0 - Landing Page & Checkout System  
**Ngày kiểm thử:** 26/07/2026  
**Phạm vi kiểm thử:** Toàn bộ luồng khách hàng từ Trang chủ (`index.html`), Khảo sát & Đăng ký (`script.js`), Chuyển hướng Thanh toán (`checkout.html` & `checkout.js`), Tích hợp VietQR / SePay API, đến Xử lý dữ liệu backend (`server.js`, `api/index.js`, CSDL SQLite `brain.db`).

---

## 📊 1. Tổng Quan Kết Quả Kiểm Thử (Executive Summary)

Kiểm thử toàn bộ luồng từ lúc khách hàng xem thông tin khóa học đến khi hoàn tất chuyển khoản thanh toán. Phát hiện **8 lỗi (bugs)** ảnh hưởng trực tiếp đến trải nghiệm người dùng, tỷ lệ chuyển đổi và tính chính xác của dữ liệu đơn hàng.

| Mức độ nghiêm trọng | Số lượng | Mô tả ngắn |
| :--- | :---: | :--- |
| 🔴 **Nghiêm trọng (Critical)** | 3 | Form khảo sát không gửi được dữ liệu; Lỗi so sánh nội dung chuyển khoản VietQR bỏ sót giao dịch; Crash vòng lặp kiểm tra thanh toán SePay. |
| 🟠 **Cao (High)** | 3 | Lỗi tìm kiếm số điện thoại trùng lặp khi đăng ký; Chuyển hướng Checkout bị block nếu thiếu URL Query Params; Mất thông tin Order ID khi fallback local. |
| 🟡 **Trung bình (Medium)** | 2 | Chênh lệch múi giờ (UTC vs GMT+7) khi tạo đơn hàng; Lỗi CORS khi cập nhật Google Apps Script. |

---

## 🛠️ 2. Chi Tiết Các Bug Theo Luồng Khách Hàng

### 🚨 Giai đoạn 1: Trang Chủ & Điền Form Đăng Ký / Khảo Sát

#### 🔴 BUG-01: Form "Khảo Sát Nhu Cầu Xây Kênh" (`#surveyForm`) không có Event Listener xử lý
- **Vị trí code:** [index.html:L547-L612](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/index.html#L547-L612), [script.js](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/script.js)
- **Mô tả:** Trong `index.html` có form khảo sát nhu cầu khách hàng `#surveyForm` với nút `id="surveySubmitBtn"`. Tuy nhiên, trong `script.js` hoàn toàn **không có code bắt sự kiện `submit`** cho form này.
- **Tác động:** Khi khách hàng bấm nút "GỬI KHẢO SÁT", trình duyệt thực hiện hành vi mặc định (Submit GET/POST truyền thống làm reload lại trang). Toàn bộ câu trả lời của khách hàng bị mất sạch, không lưu được vào CSDL hay Google Sheet và không chuyển hướng tiếp.
- **Khuyến nghị khắc phục:** Bổ sung `document.getElementById('surveyForm').addEventListener('submit', ...)` trong `script.js` để gửi dữ liệu về API hoặc lưu vào `sessionStorage` trước khi chuyển hướng.

#### 🟠 BUG-02: Lỗi đối soát Số Điện Thoại trùng lặp khiến luồng đăng ký rớt vào Catch-block
- **Vị trí code:** [script.js:L348-L355](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/script.js#L348-L355), [api/index.js:L853](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/api/index.js#L853)
- **Mô tả:** Khi khách hàng đã từng đăng ký nhập lại số điện thoại (ví dụ: `0987654321`), backend `/api/customers` trả về lỗi 400 (do `UNIQUE constraint failed: customers.phone`). Code `script.js` cố gắng khôi phục bằng cách fetch toàn bộ danh sách khách hàng và thực hiện:
  ```javascript
  const found = customers.find(c => c.phone === phone);
  ```
  Tuy nhiên, backend `api/index.js` thực hiện chuẩn hóa `cleanPhone` (loại bỏ đầu `+84` thành `84...` hoặc giữ nguyên). Nếu định dạng chuỗi trong CSDL không khớp chính xác từng ký tự với `phone` nhập từ client, `found` trả về `undefined`, dẫn đến ném lỗi `Không tạo hoặc tìm thấy khách hàng trong CSDL.`.
- **Tác động:** Khách hàng cũ đăng ký lại bị đẩy xuống khối catch fallback, tạo ra dữ liệu đăng ký thiếu `orderId` và `customerId`.

---

### 💳 Giai đoạn 2: Chuyển Hướng & Hiển Thị Trang Thanh Toán (`/checkout`)

#### 🟠 BUG-03: Trang Checkout bắt buộc đủ 4 tham số URL, gây lỗi cho người dùng truy cập trực tiếp
- **Vị trí code:** [checkout.js:L27-L48](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L27-L48)
- **Mô tả:** Khi kiểm tra dữ liệu từ URL Query Parameters (`urlParams`), code yêu cầu cả 4 tham số:
  ```javascript
  if (name && phone && email && packageVal) { ... }
  ```
  Nếu khách hàng click vào link giới thiệu/email chỉ có `?phone=0987654321&package=14days` (thiếu `name` hoặc `email`), `regData` vẫn bị bằng `null`.
- **Tác động:** Trình duyệt lập tức bật `alert('Không tìm thấy thông tin đăng ký!')` và cưỡng chế đẩy người dùng về lại trang chủ `/`, làm gián đoạn trải nghiệm thanh toán.
- **Khuyến nghị khắc phục:** Hỗ trợ giá trị mặc định cho `name` và `email` khi đọc URL params thay vì hủy bỏ toàn bộ phiên giao dịch.

#### 🟡 BUG-04: Chênh lệch Múi giờ (UTC vs GMT+7) khi tạo đơn hàng Fallback trên Checkout
- **Vị trí code:** [checkout.js:L262](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L262)
- **Mô tả:** Trong `checkout.js`, khi tạo đơn hàng dự phòng bằng API `/api/orders`, thời gian được tạo bằng:
  ```javascript
  const formattedTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  ```
  Hàm `toISOString()` trả về giờ chuẩn UTC (chậm hơn 7 giờ so với giờ Việt Nam GMT+7). Trong khi đó, `script.js` và `api/index.js` sử dụng giờ địa phương `getFormattedDateTime()`.
- **Tác động:** Thời gian tạo đơn hàng lưu trong CSDL SQLite bị lệch 7 tiếng, gây khó khăn cho việc thống kê báo cáo và đối soát doanh thu.

---

### 🔄 Giai đoạn 3: Kiểm Tra Giao Dịch & Tích Hợp VietQR / SePay

#### 🔴 BUG-05: Khớp nội dung chuyển khoản quá cứng nhắc (`PMEDIA0987654321`), bỏ sót giao dịch thực tế
- **Vị trí code:** [checkout.js:L117](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L117), [checkout.js:L214](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L214)
- **Mô tả:** Code sinh nội dung chuyển khoản là `PMEDIA0987654321` (Prefix + SĐT). Khi đọc webhook/API từ SePay, code kiểm tra:
  ```javascript
  content.toUpperCase().includes(targetContent.toUpperCase())
  ```
  Trong thực tế thanh toán tại Việt Nam:
  1. Ứng dụng ngân hàng hoặc người dùng thường bỏ số `0` ở đầu số điện thoại khi gõ tay (`PMEDIA987654321`).
  2. Ngân hàng tự động thêm khoảng trắng giữa tiền tố và số điện thoại (`PMEDIA 0987654321` hoặc `PMEDIA 987654321`).
  Hàm `.includes('PMEDIA0987654321')` sẽ trả về `false`.
- **Tác động:** Khách hàng **đã chuyển khoản thành công và mất tiền**, nhưng hệ thống **không bao giờ xác nhận thanh toán thành công**, màn hình mãi ở trạng thái "Đang chờ quét giao dịch...".

#### 🔴 BUG-06: Crash vòng lặp Polling SePay do đọc thuộc tính `undefined`
- **Vị trí code:** [checkout.js:L211](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L211)
- **Mô tả:** Trong hàm `pollSepayApi`, code xử lý ngày tháng giao dịch:
  ```javascript
  const txDate = new Date(tx.transaction_date.replace(' ', 'T') + '+07:00');
  ```
  Nếu API SePay hoặc Google Apps Script trả về một giao dịch mà `tx.transaction_date` bị `null` hoặc `undefined`, phương thức `.replace()` sẽ gây ra lỗi nghiêm trọng: `TypeError: Cannot read properties of undefined (reading 'replace')`.
- **Tác động:** Vòng lặp `setInterval` kiểm tra thanh toán bị ngưng trệ hoặc throw unhandled rejection, khiến toàn bộ tiến trình tự động xác nhận bị dừng lại.

---

### 📝 Giai đoạn 4: Hoàn Tất Thanh Toán & Lưu CSDL

#### 🟠 BUG-07: Hardcode Product ID (ID 1 & ID 2) trong Client Scripts
- **Vị trí code:** [script.js:L362](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/script.js#L362), [checkout.js:L245](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L245), [checkout.js:L290](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/checkout.js#L290)
- **Mô tả:** Cả 2 file JS ở phía client đều fix cứng ID sản phẩm:
  ```javascript
  const productId = packageVal === '14days' ? 1 : 2;
  ```
- **Tác động:** Nếu Quản trị viên (Admin) thay đổi danh mục sản phẩm, xóa sản phẩm cũ hoặc thêm gói mới trong Admin Panel làm thay đổi ID sản phẩm trong CSDL SQLite, việc tạo đơn hàng từ Landing Page / Checkout sẽ gán sai sản phẩm hoặc lỗi khóa ngoại Foreign Key constraint.

#### 🟡 BUG-08: Rào cản CHECK Constraint của bảng `email_queue` đối với các loại Email Hệ Thống
- **Vị trí code:** [api/index.js:L573](file:///c:/Users/Admin/Desktop/landing-page-xay-kenh/api/index.js#L573)
- **Mô tả:** Bảng `email_queue` định nghĩa ràng buộc:
  ```sql
  CHECK(email_type IN ('email_1', 'email_2', 'email_3'))
  ```
  Khi hệ thống gửi email xác nhận đăng ký waitlist (`waitlist_confirmation`) hoặc email xác nhận đơn hàng thanh toán (`order_confirmation`), kết quả gửi không thể lưu vào `email_queue` để theo dõi nhật ký trong Admin Panel.
- **Tác động:** Quản trị viên không thể kiểm tra xem email xác nhận thanh toán/đơn hàng của khách hàng đã gửi thành công hay thất bại trên giao diện Admin.

---

## 📋 3. Bảng Kiểm Tra Trạng Thái Luồng Khách Hàng (Customer Flow Matrix)

| Bước trong luồng | Mô tả bước | Trạng thái | Ghi chú / Lỗi liên quan |
| :--- | :--- | :---: | :--- |
| **1. Đọc thông tin** | Xem Landing Page, bảng giá, countdown | ✅ PASS | Giao diện hiển thị tốt, responsive |
| **2. Chọn gói đồng hành** | Click nút "ĐĂNG KÝ NGAY" trên bảng giá | ⚠️ WARNING | Cuộn mượt đến `#register`, nhưng chưa tự động submit |
| **3. Điền Khảo sát 1 phút** | Gửi form `#surveyForm` | ❌ FAIL | **BUG-01**: Form không có handler, bị reload trang |
| **4. Điền Form đăng ký** | Gửi form `#registrationForm` | ✅ PASS | Đã validate Email & SĐT chính xác |
| **5. Lưu CSDL & Chuyển hướng** | Gọi API `/api/customers` & `/api/orders` | ⚠️ WARNING | **BUG-02**: SĐT trùng bị rớt vào catch fallback |
| **6. Hiển thị Trang Checkout** | Tải thông tin đơn hàng & Mã VietQR | ⚠️ WARNING | **BUG-03**: Thiếu URL params bị redirect về trang chủ |
| **7. Quét mã / Chuyển khoản** | Người dùng quét VietQR từ ứng dụng Bank | ✅ PASS | Mã QR VietQR sinh chuẩn định dạng SePay |
| **8. Tự động kiểm tra giao dịch** | Polling SePay API 5s/lần | ❌ FAIL | **BUG-05, BUG-06**: Không nhận được tiền nếu nội dung lệch format; Crash JS nếu date null |
| **9. Xác nhận & Chuyển màn hình** | Cập nhật đơn hàng 'completed' & Hiện màn hình thành công | ⚠️ WARNING | **BUG-04, BUG-07**: Giờ bị lệch UTC, hardcode product_id |

---

## 💡 4. Đề Xuất Hướng Khắc Phục (Action Items)

1. **Thêm Event Listener cho `#surveyForm`**:
   Lắng nghe sự kiện submit, lưu dữ liệu khảo sát vào `sessionStorage` hoặc gửi API trước khi chuyển người dùng sang bước đăng ký/thanh toán.
2. **Nâng cấp thuật toán So sánh Nội dung Thanh toán (`checkout.js`)**:
   Loại bỏ toàn bộ khoảng trắng và số `0` ở đầu SĐT trước khi so sánh chuỗi nội dung chuyển khoản:
   ```javascript
   function normalizeMemo(str) {
     return (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
   }
   ```
3. **Thêm kiểm tra an toàn cho `tx.transaction_date`**:
   Bọc kiểm tra `if (!tx || !tx.transaction_date) return false;` để tránh crash vòng lặp polling.
4. **Chuẩn hóa Múi giờ và Đồng bộ Product ID từ API**:
   Sử dụng định dạng thời gian ISO/Local nhất quán và fetch thông tin gói từ `/api/products` thay vì hardcode `1` và `2`.

---
*Báo cáo được khởi tạo tự động bởi Hệ thống Antigravity QA Tester.*
