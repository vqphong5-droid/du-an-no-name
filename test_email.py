import sys
import os
import urllib.request
import json

sys.stdout.reconfigure(encoding='utf-8')

def test():
    # Đọc API Key từ môi trường hoặc .env
    api_key = os.environ.get('RESEND_API_KEY')
    if not api_key and os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('RESEND_API_KEY='):
                    api_key = line.split('=', 1)[1].strip().strip('"\'')
                    break
                    
    if not api_key:
        print("Không tìm thấy RESEND_API_KEY trong file .env!")
        return

    recipient = "vqphong5@gmail.com"
    print(f"Đang gửi email thử nghiệm tới {recipient}...")
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    data = {
        "from": "Cô Thiện Xây Kênh <admin@cothienxaykenh.com>",
        "to": [recipient],
        "subject": "Thử nghiệm kết nối Resend - Cô Thiện Xây Kênh",
        "html": """
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2b6cb0; text-align: center;">Kết nối Resend thành công! 🎉</h2>
            <p>Xin chào,</p>
            <p>Nếu bạn nhận được email này, cấu hình gửi mail tự động từ tên miền riêng <strong>cothienxaykenh.com</strong> thông qua Resend đã hoạt động hoàn toàn chính xác.</p>
            <p>Các API đăng ký khách hàng mới và tạo đơn hàng trên website của bạn cũng đã sẵn sàng tự động gửi mail bằng cấu hình này.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #718096; text-align: center;">Email tự động gửi từ hệ thống thử nghiệm Cô Thiện Xây Kênh.</p>
          </div>
        """
    }
    
    req = urllib.request.Request(url, method="POST", headers=headers)
    body = json.dumps(data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req, data=body) as response:
            status = response.status
            res_body = response.read().decode("utf-8")
            print(f"✅ THÀNH CÔNG! Mã phản hồi: {status}")
            print(f"Kết quả: {res_body}")
    except urllib.error.HTTPError as e:
        status = e.code
        res_body = e.read().decode("utf-8")
        print(f"❌ THẤT BẠI! Mã lỗi: {status}")
        print(f"Nội dung lỗi: {res_body}")
    except Exception as e:
        print(f"❌ LỖI: {e}")

if __name__ == '__main__':
    test()
