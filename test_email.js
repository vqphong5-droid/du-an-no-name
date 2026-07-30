const fs = require('node:fs');
const path = require('node:path');

// Tải biến môi trường từ file .env nếu có
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
      }
    }
  });
}

// Đọc API Key
let resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.error("Không tìm thấy Resend API Key! Vui lòng kiểm tra lại file .env");
  process.exit(1);
}

// Nhận email nhận từ dòng lệnh
const recipient = process.argv[2];
if (!recipient) {
  console.log("Cách chạy: node test_email.js <email-cua-ban@gmail.com>");
  process.exit(1);
}

async function runTest() {
  console.log(`Đang gửi email thử nghiệm tới ${recipient}...`);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Cô Thiện Xây Kênh <admin@cothienxaykenh.com>',
        to: [recipient],
        subject: 'Thử nghiệm kết nối Resend - Cô Thiện Xây Kênh',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2b6cb0; text-align: center;">Kết nối Resend thành công! 🎉</h2>
            <p>Xin chào,</p>
            <p>Nếu bạn nhận được email này, cấu hình gửi mail tự động từ tên miền riêng <strong>cothienxaykenh.com</strong> thông qua Resend đã hoạt động hoàn toàn chính xác.</p>
            <p>Các API đăng ký khách hàng mới và tạo đơn hàng trên website của bạn cũng đã sẵn sàng tự động gửi mail bằng cấu hình này.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #718096; text-align: center;">Email tự động gửi từ hệ thống thử nghiệm Cô Thiện Xây Kênh.</p>
          </div>
        `
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log("\n✅ THÀNH CÔNG! Đã gửi email thử nghiệm.");
      console.log("ID phản hồi từ Resend:", data.id);
    } else {
      console.error("\n❌ THẤT BẠI! Lỗi từ Resend API:");
      console.error(data);
    }
  } catch (err) {
    console.error("\n❌ LỖI trong quá trình gửi:", err.message);
  }
}

runTest();
