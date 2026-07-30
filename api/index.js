const fs = require('node:fs');
const path = require('node:path');

// --- ENV LOADER & RESEND CONFIGURATION ---
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    } catch (e) {
      console.warn('Could not parse .env file:', e.message);
    }
  }
}
loadEnv();

let resendApiKey = process.env.RESEND_API_KEY;

async function sendEmail({ to, subject, html }) {
  if (!resendApiKey) {
    console.error("Resend API Key is not configured. Email not sent.");
    return { success: false, error: "API Key missing" };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Cô Thiện Xây Kênh <admin@cothienxaykenh.com>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      })
    });
    
    const resData = await response.json();
    if (response.ok) {
      console.log(`Email sent successfully to ${to}. ID: ${resData.id}`);
      return { success: true, id: resData.id };
    } else {
      console.error(`Resend API Error:`, resData);
      return { success: false, error: resData };
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

// --- DATE UTILS FOR SCHEDULING ---
function getFormattedDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function addDays(dateTimeStr, days) {
  const parsed = new Date(dateTimeStr.replace(' ', 'T'));
  if (isNaN(parsed.getTime())) {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return getFormattedDateTime(now);
  }
  parsed.setDate(parsed.getDate() + days);
  return getFormattedDateTime(parsed);
}

// --- EMAIL SEQUENCE TEMPLATES ---
function getEmailTemplate(emailType, name, extra) {
  const checkoutUrl = typeof extra === 'string' ? extra : '';
  const emailWrapper = (subject, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif;
      background-color: #f7fafc;
      color: #2d3748;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f7fafc;
      padding: 30px 15px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1a365d 0%, #2a4365 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 30px;
      font-size: 16px;
      line-height: 1.8;
      color: #2d3748;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 20px;
    }
    .footer {
      background-color: #f7fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #718096;
      border-top: 1px solid #edf2f7;
    }
    .footer a {
      color: #3182ce;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 style="color: #ffffff; margin: 0;">CÔ THIỆN XÂY KÊNH</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>Đây là email tự động gửi từ hệ thống Cô Thiện Xây Kênh.</p>
        <p>Nếu bạn cần hỗ trợ, vui lòng phản hồi Zalo hoặc gọi hotline của chúng tôi.</p>
        <p>&copy; 2026 Cô Thiện Xây Kênh. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  if (emailType === 'waitlist_confirmation') {
    const subject = 'Chào mừng bạn đã đăng ký danh sách chờ Cô Thiện Xây Kênh!';
    const body = `
<p>Xin chào <strong>${name}</strong>,</p>
<p>Cảm ơn bạn đã đăng ký tham gia danh sách chờ (Waitlist) chương trình đồng hành của chúng tôi.</p>
<p>Dưới đây là thông tin đăng ký của bạn:</p>
<ul style="background-color: #f7fafc; padding: 15px; border-radius: 8px; list-style-type: none; line-height: 1.8; border: 1px solid #edf2f7; margin: 20px 0;">
  <li><strong>Họ và tên:</strong> ${name}</li>
  <li><strong>Số điện thoại:</strong> ${extra && extra.phone ? extra.phone : ''}</li>
  <li><strong>Thời gian đăng ký:</strong> ${extra && extra.registered_at ? extra.registered_at : ''}</li>
</ul>
<p>Đội ngũ của tụi mình sẽ sớm liên hệ trực tiếp với bạn qua Zalo hoặc số điện thoại để hỗ trợ tư vấn và cung cấp thêm thông tin chi tiết nhé.</p>
<p>Chào bạn và hẹn gặp lại sớm,<br><strong>Cô Thiện</strong></p>
    `;
    return { subject, html: emailWrapper(subject, body) };
  } else if (emailType === 'email_1') {
    const subject = 'Chào bạn! Cảm ơn bạn đã đăng ký nhé (Đọc ngay để làm quen nào)';
    const body = `
<p>Chào <strong>${name}</strong>,</p>
<p>Mừng bạn đã đăng ký tham gia danh sách chờ chương trình Đồng hành 1-1 & Thiết lập Kênh Nhân hiệu.</p>
<p>Thật ra, mình viết email này chỉ để nói lời cảm ơn bạn trước, và giới thiệu nhanh một chút để tụi mình làm quen với nhau.</p>
<p>Mình là <strong>Cô Thiện</strong> - người sẽ trực tiếp đồng hành cùng bạn trong hành trình sắp tới.</p>
<p>Mình không phải là "diễn giả" hay chuyên gia dạy lý thuyết suông đâu. Đơn giản thôi, mình là người thực chiến, đã đi qua đủ khó khăn từ lúc bắt đầu xây kênh đến khi có khách hàng chủ động tìm đến mỗi ngày.</p>
<p>Vì mình hiểu cái cảm giác cô đơn, mù tịt về công nghệ khi tự học xây kênh là thế nào, nên mình mới tạo ra chương trình đồng hành này.</p>
<p><strong>Vì sao bạn nên chờ đón những email tiếp theo từ mình?</strong></p>
<p>Vì trong 2 ngày tới, mình sẽ chia sẻ với bạn một câu chuyện rất thật: Cách một chị tư vấn viên bảo hiểm "mù công nghệ", cực kỳ sợ ống kính vẫn xây được kênh TikTok có video 18k views và mang về 5 khách hàng chủ động chỉ sau 3 tuần hoạt động.</p>
<p>Không lý thuyết dông dài đâu, toàn bộ là bài học xương máu và số liệu thật để bạn có thể áp dụng được ngay.</p>
<p>Thử xem hòm thư vào ngày kia nhé!</p>
<p>Chào bạn và hẹn gặp lại sớm,<br><strong>Cô Thiện</strong></p>
    `;
    return { subject, html: emailWrapper(subject, body) };
  } else if (emailType === 'email_2') {
    const subject = 'Đừng đợi hoàn hảo mới làm video (Bài học xương máu của mình)';
    const body = `
<p>Chào <strong>${name}</strong>,</p>
<p>Đúng hẹn tụi mình lại gặp nhau rồi.</p>
<p>Hôm nay mình muốn kể cho bạn nghe một câu chuyện ngắn thế này.</p>
<p>Hồi trước, mình quen một bạn làm tư vấn bảo hiểm. Bạn ấy rất muốn xây kênh để tìm khách chủ động, nhưng cứ loay hoay cả năm trời chỉ vì: "Chờ sắm cái mic xịn đã", "Để học xong khóa edit chuyên nghiệp đã", "Để viết kịch bản thật hoàn chỉnh đã"...</p>
<p>Kết quả là sau một năm, bạn ấy vẫn chưa bấm máy quay được video nào.</p>
<p>Trong khi đó, một chị đồng nghiệp khác cùng phòng - mù công nghệ hoàn toàn, chỉ dùng đúng cái điện thoại cũ - đã có kênh TikTok vài chục nghìn view và khách hỏi mua bảo hiểm đều đều mỗi tuần.</p>
<p>Thật ra, bài học ở đây đơn giản thôi:</p>
<p style="background-color: #f7fafc; border-left: 4px solid #3182ce; padding: 12px 20px; font-style: italic; margin: 20px 0; line-height: 1.6;">
  "Trong kinh doanh hay làm content cũng vậy, một quyết định 'đủ tốt' được đưa ra kịp thời luôn có giá trị hơn một quyết định 'hoàn hảo' nhưng mãi nằm trên giấy."
</p>
<p>Nếu bạn cứ rơi vào trạng thái phân tích quá mức (analysis paralysis) và chờ mọi thứ hoàn hảo, đối thủ của bạn đã đi trước bạn cả cây số rồi.</p>
<p>Bí quyết để chị đồng nghiệp kia làm được là gì?</p>
<p>Chị ấy không cần phức tạp hóa công nghệ hay kịch bản. Chị ấy chọn một ngách cực kỳ gần gũi với cuộc sống của mình: "Chia sẻ kinh nghiệm mua bảo hiểm thai sản cho mẹ đơn thân" (chị ấy cũng là single mom).</p>
<p>Khi nói về đúng trải nghiệm thật của bản thân, chị ấy không cần kịch bản hoa mỹ, cũng chẳng cần diễn sâu. Chị ấy chỉ quay cảnh dọn dẹp nhà cửa, chăm con rồi lồng tiếng chia sẻ thật lòng vào. Không cần lộ mặt trực diện luôn!</p>
<p><strong>Thử xem hành động này ngay hôm nay nhé:</strong></p>
<p>Viết ra 3 điều bạn cực kỳ am hiểu hoặc đang trải qua mỗi ngày (như chăm con, dọn dẹp nhà, quản lý tài chính...). Chọn ra 1 điều gần gũi nhất, và thử dùng điện thoại quay một đoạn video ngắn 30 giây kể về nó.</p>
<p>Chưa cần chỉnh sửa, chưa cần đăng lên mạng cũng được. Chỉ cần bấm máy quay để vượt qua cái rào cản ban đầu thôi.</p>
<p style="font-weight: bold; color: #2a4365; text-align: center; margin: 25px 0;">Đừng đợi hoàn hảo mới làm. Hãy làm để trở nên hoàn hảo hơn.</p>
<p>Ngày mai, mình sẽ gửi cho bạn giải pháp cụ thể giúp bạn làm phần này siêu nhanh mà không phải tự bơi một mình nhé.</p>
<p>Chào bạn,<br><strong>Cô Thiện</strong></p>
    `;
    return { subject, html: emailWrapper(subject, body) };
  } else if (emailType === 'email_3') {
    const subject = 'Đừng mua thêm khóa học tự học về lưu trong ổ cứng nữa!';
    const body = `
<p>Chào <strong>${name}</strong>,</p>
<p>Hôm qua mình đã chia sẻ về việc đừng đợi hoàn hảo mới bắt đầu. Nhưng mình biết, phần lớn mọi người vẫn chưa dám bấm máy vì vấp phải cục đá to đùng mang tên: "Mù kỹ thuật" và "Không biết chốt ngách thế nào".</p>
<p>Thật ra, ngoài kia có hàng trăm khóa học dạy bạn xây kênh. Nhưng đa phần họ chỉ quăng cho bạn một đống video quay sẵn, bắt bạn tự mò kỹ thuật và tự bơi giữa cộng đồng hàng nghìn người. Kết quả là bạn mua về, nản chí và bỏ cuộc sau vài ngày vì quá tải thông tin.</p>
<p>Nếu bạn đang tìm kiếm một lối đi khác tinh gọn hơn, có người dắt tay chỉ việc để ra kết quả thật, thì đây là câu trả lời dành cho bạn:</p>
<p style="font-size: 18px; color: #2b6cb0; font-weight: bold; margin-top: 20px; text-transform: uppercase;">Chương trình Đồng hành 1-1 & Thiết lập Kênh Nhân hiệu Trọn gói (14 Ngày)</p>
<p>Bên mình không bán lý thuyết suông để bạn tự bơi. Bên mình trực tiếp đồng hành 1-1 và làm hộ bạn những phần kỹ thuật khó nhất:</p>
<ol style="line-height: 1.8; padding-left: 20px; margin-bottom: 25px;">
  <li><strong>Chốt ngách độc bản 1-1:</strong> Mình và chuyên gia sẽ phỏng vấn trực tiếp bạn 1-1 trong tuần đầu tiên để tìm ra ngách phù hợp nhất với thế mạnh của bạn (không bắt bạn tự tìm qua workbook chung).</li>
  <li><strong>Thiết lập kênh từ A-Z:</strong> Tụi mình trực tiếp setup và chuẩn hóa giao diện, tối ưu SEO cho trang cá nhân (TikTok, Facebook Profile/Page) của bạn.</li>
  <li><strong>Edit 5 video đầu tiên:</strong> Bạn chỉ cần lên nội dung thô theo template sẵn và quay clip thô bằng điện thoại, đội kỹ thuật bên mình sẽ trực tiếp edit, dựng video hoàn chỉnh cực kỳ chuyên nghiệp để đăng kênh.</li>
  <li><strong>Có kênh hoạt động sau 14 ngày:</strong> Cam kết bàn giao kênh đi vào vận hành trơn tru và hướng dẫn bạn tự duy trì sau đó mà không cần phức tạp hóa công nghệ.</li>
</ol>
<p>Học phí trọn gói cho chương trình này là <strong>4.990.000 VNĐ</strong>.</p>
<p>Nhiều bạn lúc đầu chê đắt, nghĩ rằng bỏ vài trăm nghìn mua khóa học tự học cho rẻ. Nhưng thật ra, chi phí bên tự học rẻ hơn vì họ chỉ bán video quay sẵn rồi để bạn tự mày mò. Với bên mình, bạn đang đầu tư vào một gói đồng hành có người làm hộ phần khó và kèm cặp sát sao mỗi ngày để tiết kiệm 90% thời gian thử sai.</p>
<p>Thử xem, nếu tự mày mò, bạn có thể tốn vai ba tháng loay hoay, thậm chí nản lòng bỏ cuộc giữa chừng. Bỏ ra 4.990.000đ để đổi lấy một kênh nhân hiệu đi vào hoạt động ngay sau 14 ngày, thu hút khách hàng chủ động tìm đến - đây chắc chắn là khoản đầu tư cực kỳ xứng đáng.</p>
<p>Đơn giản thôi, số lượng mentor kèm 1-1 có giới hạn để đảm bảo chất lượng, nên tụi mình không nhận đại trà.</p>
<p>Nếu bạn đã sẵn sàng sở hữu một kênh nhân hiệu của riêng mình, hãy bấm vào link bên dưới để đăng ký tham gia ngay nhé:</p>
<div style="text-align: center; margin: 30px 0;">
  <a href="${checkoutUrl}" style="background: linear-gradient(135deg, #dd6b20 0%, #c05621 100%); color: #ffffff; padding: 16px 32px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08); font-size: 16px;">👉 ĐĂNG KÝ CHƯƠNG TRÌNH ĐỒNG HÀNH 1-1 TẠI ĐÂY</a>
</div>
<p style="text-align: center; font-size: 14px; margin-bottom: 30px;">
  <a href="${checkoutUrl}" style="color: #dd6b20; text-decoration: underline;">Hoặc bấm vào liên kết này nếu nút trên không hoạt động</a>
</p>
<p>Chào bạn và hẹn gặp lại trong buổi phỏng vấn 1-1!<br><strong>Cô Thiện</strong></p>
    `;
    return { subject, html: emailWrapper(subject, body) };
  } else if (emailType === 'order_confirmation') {
    const subject = 'Đơn hàng thành công rồi bạn nhé! (Đọc ngay hướng dẫn bắt đầu nào)';
    const { productName, amountFormatted, statusText, orderDate, deliveryInstructions } = extra;
    const body = `
<p>Chào <strong>${name}</strong>,</p>
<p>Mình là <strong>Cô Thiện</strong> đây. Rất vui và cảm ơn bạn đã tin tưởng lựa chọn đồng hành cùng mình!</p>
<p>Đơn đặt hàng của bạn cho dịch vụ <strong>${productName}</strong> đã được ghi nhận thành công trên hệ thống.</p>
<div style="background-color: #f7fafc; padding: 20px; border: 1px solid #edf2f7; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2b6cb0;">Thông tin chi tiết đơn hàng:</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.8;">
    <tr>
      <td style="padding: 6px 0; color: #718096; border-bottom: 1px solid #edf2f7;">Dịch vụ đăng ký:</td>
      <td style="padding: 6px 0; font-weight: bold; text-align: right; border-bottom: 1px solid #edf2f7;">${productName}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; color: #718096; border-bottom: 1px solid #edf2f7;">Tổng chi phí:</td>
      <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #e53e3e; border-bottom: 1px solid #edf2f7;">${amountFormatted} đ</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; color: #718096; border-bottom: 1px solid #edf2f7;">Trạng thái:</td>
      <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #3182ce; border-bottom: 1px solid #edf2f7;">${statusText}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; color: #718096; border-bottom: 1px solid #edf2f7;">Thời gian đặt hàng:</td>
      <td style="padding: 6px 0; text-align: right; border-bottom: 1px solid #edf2f7;">${orderDate}</td>
    </tr>
  </table>
</div>
<p><strong>Hướng dẫn nhận hàng và bắt đầu hành trình:</strong></p>
<p style="background-color: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px 20px; font-weight: 500; margin: 20px 0; line-height: 1.7; color: #2b6cb0;">
  ${deliveryInstructions}
</p>
<p>Tụi mình sẽ liên hệ trực tiếp qua Zalo/số điện thoại để hỗ trợ bạn sớm nhất. Nếu có bất kỳ câu hỏi nào hoặc muốn trao đổi thêm, bạn cứ phản hồi lại email này hoặc nhắn cho mình qua Zalo nhé.</p>
<p>Chúc bạn một ngày nhiều năng lượng!</p>
<p>Chào bạn,<br><strong>Cô Thiện</strong></p>
    `;
    return { subject, html: emailWrapper(subject, body) };
  }
}

// --- DELIVERY INSTRUCTIONS HELPER ---
function getDeliveryInstructions(product) {
  const pName = product.name || '';
  if (product.id === 1 || pName.includes('14')) {
    return 'Trong vòng 24 giờ tới, mình và chuyên gia sẽ liên hệ trực tiếp với bạn qua số điện thoại/Zalo để thống nhất lịch hẹn phỏng vấn 1-1. Bạn hãy chuẩn bị sẵn một số thông tin cơ bản về định hướng kênh của mình nhé!';
  } else if (product.id === 2 || pName.includes('30')) {
    return 'Trong vòng 24 giờ tới, mình và chuyên gia sẽ liên hệ trực tiếp với bạn qua số điện thoại/Zalo để xếp lịch Zoom 1-1 đầu tiên tư vấn chiến lược chuyên sâu và thiết lập phễu bán hàng. Bạn chuẩn bị sẵn các câu hỏi hoặc mong muốn của mình nhé!';
  } else if (product.type === 'physical') {
    return 'Đơn hàng vật lý của bạn đang được đóng gói và sẽ được giao tới địa chỉ của bạn trong vòng 3-5 ngày làm việc. Chúng mình sẽ nhắn mã vận đơn cho bạn ngay khi hàng được gửi đi.';
  } else if (product.type === 'digital') {
    return 'Tài liệu/Khóa học kỹ thuật số của bạn đã được kích hoạt. Bạn vui lòng kiểm tra tin nhắn Zalo hoặc số điện thoại để nhận thông tin tài khoản đăng nhập và truy cập nội dung nhé!';
  } else {
    return 'Chúng mình sẽ liên hệ trực tiếp với bạn qua Zalo hoặc số điện thoại trong vòng 24 giờ tới để hướng dẫn nhận hàng và bắt đầu dịch vụ nhé!';
  }
}

// --- QUEUE PROCESSOR FUNCTION ---
async function processDueEmails(origin = 'https://cothienxaykenh.com') {
  const nowStr = getFormattedDateTime();
  console.log(`[Email Worker] Processing pending emails due at or before ${nowStr}...`);
  
  try {
    const dueEmails = await db.all(`
      SELECT eq.id as queue_id, eq.email_type, eq.scheduled_at,
             c.id as customer_id, c.name, c.email, c.phone
      FROM email_queue eq
      JOIN customers c ON eq.customer_id = c.id
      WHERE eq.status = 'pending' AND eq.scheduled_at <= ?
    `, [nowStr]);
    
    if (dueEmails.length === 0) {
      console.log(`[Email Worker] No pending emails to process.`);
      return { processed: 0, sent: 0, failed: 0 };
    }
    
    console.log(`[Email Worker] Found ${dueEmails.length} emails to process.`);
    let sentCount = 0;
    let failedCount = 0;
    
    for (const item of dueEmails) {
      const { queue_id, email_type, customer_id, name, email, phone } = item;
      
      if (!email || email.trim() === '') {
        await db.run(`
          UPDATE email_queue
          SET status = 'failed', error_message = 'Customer has no email address'
          WHERE id = ?
        `, [queue_id]);
        failedCount++;
        continue;
      }
      
      try {
        let checkoutUrl = '';
        if (email_type === 'email_3') {
          const order = await db.get(`
            SELECT p.id as product_id, p.name as product_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.customer_id = ?
            ORDER BY o.id DESC
            LIMIT 1
          `, [customer_id]);
          
          let packageVal = '14days';
          if (order) {
            if (order.product_id === 2 || order.product_name.includes('30')) {
              packageVal = '30days';
            }
          }
          
          checkoutUrl = `${origin}/checkout?name=${encodeURIComponent(name)}&phone=${phone}&email=${encodeURIComponent(email)}&package=${packageVal}`;
        }
        
        const template = getEmailTemplate(email_type, name, checkoutUrl);
        const sendRes = await sendEmail({
          to: email.trim(),
          subject: template.subject,
          html: template.html
        });
        
        const nowTime = getFormattedDateTime();
        if (sendRes.success) {
          await db.run(`
            UPDATE email_queue
            SET status = 'sent', sent_at = ?, error_message = NULL
            WHERE id = ?
          `, [nowTime, queue_id]);
          sentCount++;
          console.log(`[Email Worker] Successfully sent ${email_type} to ${email}`);
        } else {
          await db.run(`
            UPDATE email_queue
            SET status = 'failed', error_message = ?
            WHERE id = ?
          `, [JSON.stringify(sendRes.error), queue_id]);
          failedCount++;
          console.error(`[Email Worker] Failed to send ${email_type} to ${email}:`, sendRes.error);
        }
      } catch (err) {
        await db.run(`
          UPDATE email_queue
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `, [err.message, queue_id]);
        failedCount++;
        console.error(`[Email Worker] Error processing email item ${queue_id}:`, err);
      }
    }
    
    return { processed: dueEmails.length, sent: sentCount, failed: failedCount };
  } catch (error) {
    console.error(`[Email Worker] Error in processDueEmails:`, error);
    throw error;
  }
}

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
    
    // Ensure email column exists (migration for existing databases)
    try {
      await db.run("SELECT email FROM customers LIMIT 1");
    } catch (e) {
      try {
        await db.run("ALTER TABLE customers ADD COLUMN email TEXT");
        console.log("Added email column to customers table via self-healing.");
      } catch (err) {
        console.error("Failed to add email column via self-healing:", err);
      }
    }

    // Ensure is_notified column exists in customers table
    try {
      await db.run("SELECT is_notified FROM customers LIMIT 1");
    } catch (e) {
      try {
        await db.run("ALTER TABLE customers ADD COLUMN is_notified INTEGER DEFAULT 0");
        console.log("Added is_notified column to customers table via self-healing.");
      } catch (err) {
        console.error("Failed to add is_notified column to customers:", err);
      }
    }

    // Ensure is_notified column exists in orders table
    try {
      await db.run("SELECT is_notified FROM orders LIMIT 1");
    } catch (e) {
      try {
        await db.run("ALTER TABLE orders ADD COLUMN is_notified INTEGER DEFAULT 0");
        console.log("Added is_notified column to orders table via self-healing.");
      } catch (err) {
        console.error("Failed to add is_notified column to orders:", err);
      }
    }

    // Ensure is_notified column exists in email_queue table
    try {
      await db.run("SELECT is_notified FROM email_queue LIMIT 1");
    } catch (e) {
      try {
        await db.run("ALTER TABLE email_queue ADD COLUMN is_notified INTEGER DEFAULT 0");
        console.log("Added is_notified column to email_queue table via self-healing.");
      } catch (err) {
        console.error("Failed to add is_notified column to email_queue:", err);
      }
    }
    
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
    
    // Create email_queue table
    await db.run(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        email_type TEXT NOT NULL CHECK(email_type IN ('email_1', 'email_2', 'email_3')),
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
        sent_at TEXT,
        error_message TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        UNIQUE(customer_id, email_type)
      )
    `);
    
    // Auto-populate products table if empty
    const productsCount = await db.get("SELECT COUNT(*) as count FROM products");
    if (productsCount && (productsCount.count === 0 || productsCount.count === '0')) {
      await db.run(`
        INSERT INTO products (id, name, type, price, description)
        VALUES (1, 'GÓI ĐỒNG HÀNH 14 NGÀY', 'service', 4990000.0, 'Kèm cặp 1-1, tối ưu kênh cá nhân và thiết lập ngách nội dung độc bản trong 14 ngày.')
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

// Helper to parse raw request body as text
function getRawBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      resolve(body);
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

  // 4. CRON API TO PROCESS EMAIL SEQUENCE QUEUE
  if (pathname === '/api/cron' || pathname === '/api/cron/process-emails') {
    if (method === 'GET' || method === 'POST') {
      try {
        let origin = 'https://cothienxaykenh.com';
        if (req.headers && req.headers.host) {
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          origin = `${protocol}://${req.headers.host}`;
        }
        
        const result = await processDueEmails(origin);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, timestamp: getFormattedDateTime(), ...result }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
      return;
    }
  }

  // 5. EMAIL QUEUE LIST API (for admin panel or monitoring)
  if (pathname === '/api/email-queue') {
    if (method === 'GET') {
      try {
        const rows = await db.all(`
          SELECT eq.id, eq.customer_id, c.name as customer_name, c.email as customer_email,
                 eq.email_type, eq.scheduled_at, eq.status, eq.sent_at, eq.error_message
          FROM email_queue eq
          JOIN customers c ON eq.customer_id = c.id
          ORDER BY eq.id DESC
        `);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 6. BUSINESS SIGNALS GET API
  if (pathname === '/api/business-signals') {
    if (method === 'GET') {
      try {
        const hours = parseInt(url.searchParams.get('hours') || '0');
        
        let customersQuery = `
          SELECT id, name, phone, email, zalo, registered_at
          FROM customers
          WHERE is_notified = 0 OR is_notified IS NULL
          ORDER BY id DESC
        `;
        let ordersQuery = `
          SELECT o.id, o.customer_id, c.name as customer_name, c.phone as customer_phone,
                 o.product_id, p.name as product_name, o.amount, o.status, o.created_at
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          JOIN products p ON o.product_id = p.id
          WHERE o.is_notified = 0 OR o.is_notified IS NULL
          ORDER BY o.id DESC
        `;
        let failedEmailsQuery = `
          SELECT eq.id, eq.customer_id, c.name as customer_name, c.email as customer_email,
                 eq.email_type, eq.scheduled_at, eq.status, eq.error_message
          FROM email_queue eq
          JOIN customers c ON eq.customer_id = c.id
          WHERE eq.status = 'failed' AND (eq.is_notified = 0 OR eq.is_notified IS NULL)
          ORDER BY eq.id DESC
        `;
        let queryParams = [];

        if (hours > 0) {
          const limitDate = new Date(Date.now() - hours * 60 * 60 * 1000);
          const limitStr = getFormattedDateTime(limitDate);
          
          customersQuery = `
            SELECT id, name, phone, email, zalo, registered_at
            FROM customers
            WHERE registered_at >= ?
            ORDER BY id DESC
          `;
          ordersQuery = `
            SELECT o.id, o.customer_id, c.name as customer_name, c.phone as customer_phone,
                   o.product_id, p.name as product_name, o.amount, o.status, o.created_at
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN products p ON o.product_id = p.id
            WHERE o.created_at >= ?
            ORDER BY o.id DESC
          `;
          failedEmailsQuery = `
            SELECT eq.id, eq.customer_id, c.name as customer_name, c.email as customer_email,
                   eq.email_type, eq.scheduled_at, eq.status, eq.error_message
            FROM email_queue eq
            JOIN customers c ON eq.customer_id = c.id
            WHERE eq.status = 'failed' AND eq.scheduled_at >= ?
            ORDER BY eq.id DESC
          `;
          queryParams = [limitStr];
        }

        const customers = await db.all(customersQuery, queryParams);
        const orders = await db.all(ordersQuery, queryParams);
        const failedEmails = await db.all(failedEmailsQuery, queryParams);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ customers, orders, failed_emails: failedEmails }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 7. BUSINESS SIGNALS MARK NOTIFIED POST API
  if (pathname === '/api/business-signals/mark-notified') {
    if (method === 'POST') {
      try {
        const body = await getJsonBody(req);
        const { customer_ids, order_ids, email_queue_ids } = body;

        let updatedCustomers = 0;
        let updatedOrders = 0;
        let updatedEmailQueue = 0;

        const queries = [];

        if (Array.isArray(customer_ids) && customer_ids.length > 0) {
          const placeholders = customer_ids.map(() => '?').join(',');
          queries.push({
            sql: `UPDATE customers SET is_notified = 1 WHERE id IN (${placeholders})`,
            args: customer_ids.map(id => parseInt(id))
          });
          updatedCustomers = customer_ids.length;
        }

        if (Array.isArray(order_ids) && order_ids.length > 0) {
          const placeholders = order_ids.map(() => '?').join(',');
          queries.push({
            sql: `UPDATE orders SET is_notified = 1 WHERE id IN (${placeholders})`,
            args: order_ids.map(id => parseInt(id))
          });
          updatedOrders = order_ids.length;
        }

        if (Array.isArray(email_queue_ids) && email_queue_ids.length > 0) {
          const placeholders = email_queue_ids.map(() => '?').join(',');
          queries.push({
            sql: `UPDATE email_queue SET is_notified = 1 WHERE id IN (${placeholders})`,
            args: email_queue_ids.map(id => parseInt(id))
          });
          updatedEmailQueue = email_queue_ids.length;
        }

        if (queries.length > 0) {
          await db.executeTransaction(queries);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          updated: {
            customers: updatedCustomers,
            orders: updatedOrders,
            email_queue: updatedEmailQueue
          }
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

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

        const cleanPhone = (phone || '').toString().trim().replace(/[\s.-]/g, '');
        const phoneValid = /^(?:0|\+?84)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9]|2[0-9]{2})\d{7}$/.test(cleanPhone);
        if (!phoneValid) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Số điện thoại không đúng định dạng Việt Nam (Ví dụ: 0987654321).' }));
          return;
        }

        if (email && email.trim() !== '') {
          const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
          if (!emailValid) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Địa chỉ Email không đúng định dạng (Ví dụ: name@gmail.com).' }));
            return;
          }
        }
        
        const runResult = await db.run(`
          INSERT INTO customers (name, phone, email, zalo, registered_at)
          VALUES (?, ?, ?, ?, ?)
        `, [name, cleanPhone, email || '', zalo || '', registered_at]);
        
        const customerId = runResult.lastInsertRowid;
        
        // Gửi email sequence hoặc lập lịch nếu có email
        if (email && email.trim() !== '') {
          const emailTrimmed = email.trim();
          const isTestMode = emailTrimmed.includes('+test');
          
          if (isTestMode) {
            console.log(`[Test Mode] Sending all 3 sequence emails + waitlist immediately to ${emailTrimmed}...`);
            const sleep = (ms) => new Promise(res => setTimeout(res, ms));
            
            // 1. Gửi Email Waitlist ngay lập tức
            const waitlistData = getEmailTemplate('waitlist_confirmation', name, { phone, registered_at });
            await sendEmail({
              to: emailTrimmed,
              subject: waitlistData.subject,
              html: waitlistData.html
            });

            // Trễ 1.5 giây
            await sleep(1500);

            // 2. Gửi Email 1
            const email1Data = getEmailTemplate('email_1', name);
            const sendRes1 = await sendEmail({
              to: emailTrimmed,
              subject: email1Data.subject,
              html: email1Data.html
            });
            let status = sendRes1.success ? 'sent' : 'failed';
            let errMsg = sendRes1.success ? null : JSON.stringify(sendRes1.error);
            let nowTime = getFormattedDateTime();
            try {
              await db.run(`
                INSERT INTO email_queue (customer_id, email_type, scheduled_at, status, sent_at, error_message)
                VALUES (?, 'email_1', ?, ?, ?, ?)
              `, [customerId, registered_at, status, sendRes1.success ? nowTime : null, errMsg]);
            } catch (dbErr) {
              console.error("Database log failed for email_1 (likely read-only on Vercel):", dbErr);
            }

            // Trễ 1.5 giây
            await sleep(1500);

            // 3. Gửi Email 2
            const email2Data = getEmailTemplate('email_2', name);
            const sendRes2 = await sendEmail({
              to: emailTrimmed,
              subject: email2Data.subject,
              html: email2Data.html
            });
            status = sendRes2.success ? 'sent' : 'failed';
            errMsg = sendRes2.success ? null : JSON.stringify(sendRes2.error);
            nowTime = getFormattedDateTime();
            try {
              await db.run(`
                INSERT INTO email_queue (customer_id, email_type, scheduled_at, status, sent_at, error_message)
                VALUES (?, 'email_2', ?, ?, ?, ?)
              `, [customerId, registered_at, status, sendRes2.success ? nowTime : null, errMsg]);
            } catch (dbErr) {
              console.error("Database log failed for email_2 (likely read-only on Vercel):", dbErr);
            }

            // Trễ 1.5 giây
            await sleep(1500);

            // 4. Gửi Email 3
            let origin = 'https://cothienxaykenh.com';
            if (req.headers && req.headers.host) {
              const protocol = req.headers['x-forwarded-proto'] || 'http';
              origin = `${protocol}://${req.headers.host}`;
            }
            const packageVal = body.package || '14days';
            const checkoutUrl = `${origin}/checkout?name=${encodeURIComponent(name)}&phone=${phone}&email=${encodeURIComponent(emailTrimmed)}&package=${packageVal}`;
            
            const email3Data = getEmailTemplate('email_3', name, checkoutUrl);
            const sendRes3 = await sendEmail({
              to: emailTrimmed,
              subject: email3Data.subject,
              html: email3Data.html
            });
            status = sendRes3.success ? 'sent' : 'failed';
            errMsg = sendRes3.success ? null : JSON.stringify(sendRes3.error);
            nowTime = getFormattedDateTime();
            try {
              await db.run(`
                INSERT INTO email_queue (customer_id, email_type, scheduled_at, status, sent_at, error_message)
                VALUES (?, 'email_3', ?, ?, ?, ?)
              `, [customerId, registered_at, status, sendRes3.success ? nowTime : null, errMsg]);
            } catch (dbErr) {
              console.error("Database log failed for email_3 (likely read-only on Vercel):", dbErr);
            }
            
          } else {
            // 1. Gửi Email Waitlist ngay lập tức
            const waitlistData = getEmailTemplate('waitlist_confirmation', name, { phone, registered_at });
            sendEmail({
              to: emailTrimmed,
              subject: waitlistData.subject,
              html: waitlistData.html
            }).then(() => {
              // 2. Gửi Email 1 ngay lập tức qua Resend
              const email1Data = getEmailTemplate('email_1', name);
              sendEmail({
                to: emailTrimmed,
                subject: email1Data.subject,
                html: email1Data.html
              }).then(async (sendRes) => {
                const status = sendRes.success ? 'sent' : 'failed';
                const errMsg = sendRes.success ? null : JSON.stringify(sendRes.error);
                const nowTime = getFormattedDateTime();
                
                await db.run(`
                  INSERT INTO email_queue (customer_id, email_type, scheduled_at, status, sent_at, error_message)
                  VALUES (?, 'email_1', ?, ?, ?, ?)
                `, [customerId, registered_at, status, sendRes.success ? nowTime : null, errMsg]);
              }).catch(err => console.error("Error sending immediate email_1:", err));
            }).catch(err => console.error("Error sending waitlist confirmation:", err));
            
            // 2. Lập lịch Email 2 (2 ngày sau) và Email 3 (3 ngày sau)
            const timeEmail2 = addDays(registered_at, 2);
            const timeEmail3 = addDays(registered_at, 3);
            
            await db.run(`
              INSERT INTO email_queue (customer_id, email_type, scheduled_at, status)
              VALUES (?, 'email_2', ?, 'pending')
            `, [customerId, timeEmail2]);
            
            await db.run(`
              INSERT INTO email_queue (customer_id, email_type, scheduled_at, status)
              VALUES (?, 'email_3', ?, 'pending')
            `, [customerId, timeEmail3]);
            
            console.log(`Scheduled Email sequence for customer ${name} (${emailTrimmed}): Email 2 at ${timeEmail2}, Email 3 at ${timeEmail3}`);
          }
        }
        
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

        const cleanPhone = (phone || '').toString().trim().replace(/[\s.-]/g, '');
        const phoneValid = /^(?:0|\+?84)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9]|2[0-9]{2})\d{7}$/.test(cleanPhone);
        if (!phoneValid) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Số điện thoại không đúng định dạng Việt Nam (Ví dụ: 0987654321).' }));
          return;
        }

        if (email && email.trim() !== '') {
          const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
          if (!emailValid) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Địa chỉ Email không đúng định dạng (Ví dụ: name@gmail.com).' }));
            return;
          }
        }
        
        await db.run(`
          UPDATE customers
          SET name = ?, phone = ?, email = ?, zalo = ?, registered_at = ?
          WHERE id = ?
        `, [name, cleanPhone, email || '', zalo || '', registered_at, id]);
        
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

        // Gửi email xác nhận đơn hàng nếu khách hàng có điền email
        if (customer.email && customer.email.trim() !== '') {
          const amountFormatted = parseFloat(amount).toLocaleString('vi-VN');
          const statusText = status === 'completed' ? 'Đã thanh toán (Hoàn tất)' : 'Chờ thanh toán / Đang xử lý';
          const deliveryInstructions = getDeliveryInstructions(product);
          
          const emailData = getEmailTemplate('order_confirmation', customer.name, {
            productName: product.name,
            amountFormatted,
            statusText,
            orderDate: created_at,
            deliveryInstructions
          });
          
          sendEmail({
            to: customer.email.trim(),
            subject: emailData.subject,
            html: emailData.html
          }).catch(err => console.error("Error in background order email send:", err));
        }

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

  // --- GOOGLE APPS SCRIPT PROXY ENDPOINTS (SECRETS PROTECTION) ---

  // 1. Proxy GET request to SePay Google Apps Script
  if (pathname === '/api/check-payment') {
    if (method === 'GET') {
      try {
        const targetUrl = process.env.GOOGLE_SCRIPT_SEPAY_URL;
        if (!targetUrl) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'GOOGLE_SCRIPT_SEPAY_URL is not configured' }));
          return;
        }

        const response = await fetch(`${targetUrl}?action=checkPayment`);
        const data = await response.json();
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // 2. Proxy POST request to Google Sheets Survey Google Apps Script
  if (pathname === '/api/survey') {
    if (method === 'POST') {
      try {
        const targetUrl = process.env.GOOGLE_SCRIPT_SURVEY_URL;
        if (!targetUrl) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'GOOGLE_SCRIPT_SURVEY_URL is not configured' }));
          return;
        }

        const rawBody = await getRawBody(req);
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded'
          },
          body: rawBody
        });

        const resText = await response.text();
        
        res.writeHead(response.status || 200, { 
          'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8' 
        });
        res.end(resText);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // Fallback for API route not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API endpoint not found' }));
};
