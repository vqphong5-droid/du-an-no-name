// SePay Payment Configurations
// Hãy dán thông tin tài khoản ngân hàng và API token của bạn vào đây
const SEPAY_CONFIG = {
  BANK_ACC: '0010197779999', // Dán Số tài khoản ngân hàng nhận tiền vào đây
  BANK_NAME: 'MBBank', // Ví dụ: MBBank, Vietcombank, ACB, VPBank, Techcombank...
  ACCOUNT_HOLDER: 'VU QUANG PHONG', // Ví dụ: NGUYEN VAN A (Viết hoa không dấu)
  MEMO_PREFIX: 'PMEDIA' // Tiền tố nội dung chuyển khoản (Ví dụ: XK0987654321)
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initSlider();
  initFaq();
  initForm();
  initSmoothScroll();
  initVideoPlayer();
  initChatbot();
});

// 1. Countdown Timer (Count down to midnight of the current day)
function initCountdown() {
  const hoursVal = document.getElementById('hours');
  const minutesVal = document.getElementById('minutes');
  const secondsVal = document.getElementById('seconds');

  if (!hoursVal || !minutesVal || !secondsVal) return;

  function updateTimer() {
    const now = new Date();
    
    // Set target time to 23:59:59 of today
    const target = new Date();
    target.setHours(23, 59, 59, 999);
    
    let diff = target - now;
    
    // If it's somehow past midnight, set target to tomorrow
    if (diff < 0) {
      target.setDate(target.getDate() + 1);
      diff = target - now;
    }

    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    hoursVal.textContent = String(hours).padStart(2, '0');
    minutesVal.textContent = String(minutes).padStart(2, '0');
    secondsVal.textContent = String(seconds).padStart(2, '0');
  }

  // Run immediately and then every second
  updateTimer();
  setInterval(updateTimer, 1000);
}

// 2. Testimonials Slider
function initSlider() {
  const track = document.getElementById('sliderTrack');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const dotsContainer = document.getElementById('dots');
  const slides = document.querySelectorAll('.slide');

  if (!track || slides.length === 0) return;

  let currentIndex = 0;
  const slideCount = slides.length;

  // Create dots
  for (let i = 0; i < slideCount; i++) {
    const dot = document.createElement('div');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  }

  const dots = document.querySelectorAll('.dot');

  function updateSliderPosition() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    // Update dots
    dots.forEach((dot, index) => {
      if (index === currentIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function goToSlide(index) {
    currentIndex = index;
    updateSliderPosition();
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % slideCount;
    updateSliderPosition();
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + slideCount) % slideCount;
    updateSliderPosition();
  }

  // Event Listeners
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);

  // Auto slide every 8 seconds
  let autoSlideInterval = setInterval(nextSlide, 8000);

  // Stop auto slide on interaction
  const stopAutoSlide = () => {
    clearInterval(autoSlideInterval);
    // Restart after 15s of no interaction
    autoSlideInterval = setInterval(nextSlide, 15000);
  };

  if (nextBtn) nextBtn.addEventListener('click', stopAutoSlide);
  if (prevBtn) prevBtn.addEventListener('click', stopAutoSlide);
  dots.forEach(dot => dot.addEventListener('click', stopAutoSlide));
}

// 3. FAQ Accordion Toggle
function initFaq() {
  const faqHeaders = document.querySelectorAll('.faq-header');

  faqHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const body = item.querySelector('.faq-body');
      const isActive = item.classList.contains('active');

      // Close all other items
      document.querySelectorAll('.faq-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-body').style.maxHeight = null;
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        body.style.maxHeight = null;
      } else {
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });
}

// 4. Registration Form and Success Modal
let paymentCheckInterval = null;
let paymentCountdownInterval = null;

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function setupCopyBtn(btnId, textElementId, isAmount = false) {
  const btn = document.getElementById(btnId);
  const textEl = document.getElementById(textElementId);
  if (!btn || !textEl) return;
  
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  newBtn.addEventListener('click', () => {
    let text = textEl.textContent.trim();
    if (isAmount) {
      text = text.replace(/[^0-9]/g, '');
    }
    navigator.clipboard.writeText(text).then(() => {
      const originalText = newBtn.innerHTML;
      newBtn.innerHTML = `<i class="fa-solid fa-check"></i> Đã chép`;
      newBtn.classList.add('copied');
      setTimeout(() => {
        newBtn.innerHTML = originalText;
        newBtn.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Lỗi sao chép:', err);
    });
  });
}

function initForm() {
  const form = document.getElementById('registrationForm');
  const modal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  // SePay Payment Modal Elements
  const paymentModal = document.getElementById('paymentModal');
  const closePaymentModalBtn = document.getElementById('closePaymentModalBtn');
  
  if (!form || !modal || !closeModalBtn || !submitBtn || !paymentModal || !closePaymentModalBtn) return;

  const originalBtnText = submitBtn.innerHTML;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Simple validation check
    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
    const email = document.getElementById('email').value.trim();
    const packageVal = document.getElementById('package').value;

    if (!name || !phone || !email || !packageVal) {
      alert('Vui lòng điền đầy đủ thông tin đăng ký và chọn gói học!');
      return;
    }

    // Show loading state on button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang xử lý đăng ký...`;

    // Submit to Google Sheets Web App
    fetch("https://script.google.com/macros/s/AKfycbwLDNOODkV5ZgUJFQXl_ToJLUOIynsMkDb45fNijljY2Sv8kF4G3CoWcbD0a-DtVVpBDg/exec", {
      method: "POST",
      body: new FormData(form)
    })
    .then(() => {
      // Setup and Show Payment Modal instead of direct success
      startPaymentProcess(phone, packageVal);
      
      // Reset form
      form.reset();
      
      // Reset button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    })
    .catch((error) => {
      alert("Có lỗi xảy ra khi gửi đăng ký. Vui lòng thử lại!");
      console.error(error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    });
  });

  // Close success modal event
  closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Close payment modal event (cancel payment)
  closePaymentModalBtn.addEventListener('click', () => {
    stopPaymentProcess();
  });
}

function startPaymentProcess(phone, packageVal) {
  const paymentModal = document.getElementById('paymentModal');
  const qrImg = document.getElementById('paymentQrImg');
  const timerText = document.getElementById('paymentCountdown');
  const bankNameText = document.getElementById('paymentBankName');
  const holderText = document.getElementById('paymentAccountHolder');
  const accText = document.getElementById('paymentAccountNumber');
  const amountText = document.getElementById('paymentAmount');
  const contentText = document.getElementById('paymentContent');
  const statusText = document.getElementById('paymentStatusText');
  const statusGroup = document.querySelector('.payment-status');

  if (!paymentModal) return;

  // Clear any existing intervals
  clearInterval(paymentCheckInterval);
  clearInterval(paymentCountdownInterval);

  // Reset status UI
  statusGroup.classList.remove('success');
  statusText.textContent = "Đang chờ quét giao dịch từ ngân hàng...";

  // Calculate amount and description content
  const amount = packageVal === '14days' ? 50000 : 6990000;
  const content = (SEPAY_CONFIG.MEMO_PREFIX + phone).toUpperCase();

  // Update payment UI info
  bankNameText.textContent = SEPAY_CONFIG.BANK_NAME;
  holderText.textContent = SEPAY_CONFIG.ACCOUNT_HOLDER;
  accText.textContent = SEPAY_CONFIG.BANK_ACC;
  amountText.textContent = formatCurrency(amount);
  contentText.textContent = content;

  // Generate dynamic VietQR code URL
  const qrUrl = `https://vietqr.app/img?acc=${SEPAY_CONFIG.BANK_ACC}&bank=${SEPAY_CONFIG.BANK_NAME}&amount=${amount}&des=${content}&template=compact&holder=${encodeURIComponent(SEPAY_CONFIG.ACCOUNT_HOLDER)}`;
  qrImg.src = qrUrl;

  // Setup copy buttons
  setupCopyBtn('btn-copy-acc', 'paymentAccountNumber');
  setupCopyBtn('btn-copy-amount', 'paymentAmount', true);
  setupCopyBtn('btn-copy-content', 'paymentContent');

  // Record the start time of the checkout process (with 1-minute buffer for clock drift)
  const checkoutStartTime = new Date(Date.now() - 60000);

  // Open modal
  paymentModal.classList.add('active');

  // Countdown timer logic (10 minutes)
  let secondsLeft = 600;
  paymentCountdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(paymentCountdownInterval);
      clearInterval(paymentCheckInterval);
      timerText.textContent = "Giao dịch hết hạn";
      statusText.textContent = "Giao dịch đã hết hạn thanh toán. Vui lòng thử lại.";
      return;
    }
    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, 1000);

  // Polling SePay API
  paymentCheckInterval = setInterval(() => {
    pollSepayApi(amount, content, checkoutStartTime);
  }, 5000);
}

function stopPaymentProcess() {
  const paymentModal = document.getElementById('paymentModal');
  if (paymentModal) {
    paymentModal.classList.remove('active');
  }
  clearInterval(paymentCheckInterval);
  clearInterval(paymentCountdownInterval);
}

function pollSepayApi(targetAmount, targetContent, checkoutStartTime) {
  const statusText = document.getElementById('paymentStatusText');
  const statusGroup = document.querySelector('.payment-status');
  const successModal = document.getElementById('successModal');
  const paymentModal = document.getElementById('paymentModal');

  // URL Web App Google Apps Script của bạn
  const googleScriptUrl = "https://script.google.com/macros/s/AKfycbwLDNOODkV5ZgUJFQXl_ToJLUOIynsMkDb45fNijljY2Sv8kF4G3CoWcbD0a-DtVVpBDg/exec";

  // Gọi API SePay thông qua proxy Google Apps Script để bypass CORS và bảo mật Token
  fetch(`${googleScriptUrl}?action=checkPayment`, {
    method: 'GET',
    mode: 'cors'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 200 && data.transactions) {
      // Find matching transaction
      const matchedTx = data.transactions.find(tx => {
        const amountIn = parseFloat(tx.amount_in);
        const content = tx.transaction_content || '';
        // Phân tích ngày giao dịch theo múi giờ Việt Nam (GMT+7)
        const txDate = new Date(tx.transaction_date.replace(' ', 'T') + '+07:00');
        
        // Kiểm tra khớp số tiền, nội dung chứa mã thanh toán, và thời gian giao dịch phải sau lúc tạo đơn hàng
        return amountIn === targetAmount && 
               content.toUpperCase().includes(targetContent.toUpperCase()) &&
               txDate >= checkoutStartTime;
      });

      if (matchedTx) {
        // Payment success!
        clearInterval(paymentCheckInterval);
        clearInterval(paymentCountdownInterval);

        // Update modal UI to success state
        statusGroup.classList.add('success');
        statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Thanh toán thành công! Đang xác nhận...`;

        setTimeout(() => {
          // Close payment modal
          paymentModal.classList.remove('active');
          // Open success modal
          successModal.classList.add('active');
        }, 2500);
      }
    }
  })
  .catch(error => {
    console.error('Lỗi khi gọi Google Apps Script Proxy:', error);
  });
}

// 5. Smooth Scroll for CTA buttons
function initSmoothScroll() {
  const ctaButtons = document.querySelectorAll('a[href^="#"]');
  const packageSelect = document.getElementById('package');
  
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      // Pre-select package in form if data-package exists
      const packageVal = this.getAttribute('data-package');
      if (packageSelect && packageVal) {
        packageSelect.value = packageVal;
      }
      
      if (targetElement) {
        // Offset for sticky header
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// 6. Video Player Embed (Play YouTube video on thumbnail click)
function initVideoPlayer() {
  const playBtn = document.getElementById('playBtn');
  const thumbnail = document.querySelector('.video-thumbnail');
  const container = document.querySelector('.video-container');

  if (!playBtn || !thumbnail || !container) return;

  function playVideo(e) {
    e.stopPropagation(); // Prevent duplicate triggers if clicking button inside thumbnail
    container.innerHTML = `
      <iframe src="https://www.youtube.com/embed/e1iJAiZPqbY?autoplay=1" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowfullscreen 
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 21px;">
      </iframe>
    `;
  }

  thumbnail.addEventListener('click', playVideo);
}

// 7. Chatbot Widget Logic
function initChatbot() {
  const chatbotWrapper = document.getElementById('workspace-chatbot');
  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const chatWindow = document.getElementById('chatbot-window');
  const chatBody = document.getElementById('chatbot-body');
  const chatOptions = document.getElementById('chatbot-options');
  const badge = toggleBtn ? toggleBtn.querySelector('.chatbot-badge') : null;
  const inputForm = document.getElementById('chatbot-input-form');
  const textInput = document.getElementById('chatbot-text-input');

  if (!toggleBtn || !chatWindow || !chatBody || !chatOptions) return;

  // Toggle chatbot visibility
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = chatWindow.classList.contains('active');
    if (isActive) {
      closeChat();
    } else {
      openChat();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChat();
    });
  }

  function openChat() {
    chatWindow.classList.add('active');
    const openIcon = toggleBtn.querySelector('.chatbot-icon-open');
    const closeIcon = toggleBtn.querySelector('.chatbot-icon-close');
    if (openIcon && closeIcon) {
      openIcon.style.display = 'none';
      closeIcon.style.display = 'block';
    }
    if (badge) {
      badge.style.display = 'none'; // Clear notification badge
    }
    scrollToBottom();
  }

  function closeChat() {
    chatWindow.classList.remove('active');
    const openIcon = toggleBtn.querySelector('.chatbot-icon-open');
    const closeIcon = toggleBtn.querySelector('.chatbot-icon-close');
    if (openIcon && closeIcon) {
      openIcon.style.display = 'block';
      closeIcon.style.display = 'none';
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 50);
  }

  // FAQ Database matching sales_script.md exactly
  const faqData = [
    {
      id: 1,
      q: "Khóa học học qua hình thức nào? Thời gian ra sao? Có linh hoạt không?",
      a: "Học qua Zoom trực tuyến nha bạn. Nhưng đừng lo là học lý thuyết suông xong rồi tự bơi đâu. Bọn mình kết hợp Zoom với một nhóm chat hỗ trợ 1-1 hàng ngày. Bạn viết kịch bản hay quay video thô xong cứ quăng vào đấy, mentor sẽ trực tiếp sửa từng giây đầu tiên để giữ chân người xem. Buổi tối học Zoom, còn nhóm hỗ trợ thì hoạt động cả ngày, có video record xem lại nên bận mấy vẫn theo được nha."
    },
    {
      id: 2,
      q: "Mình không biết gì về công nghệ, chưa từng quay dựng video ngắn bao giờ thì có học được không?",
      a: "Được chứ bạn ơi, đơn giản thôi. 80% học viên bên mình ban đầu còn không biết bấm nút lưu video cơ. Bọn mình sẽ cầm tay chỉ việc, hướng dẫn bạn dùng CapCut trên điện thoại từ những bước nhỏ nhất như cắt ghép, chèn chữ tự động, chỉnh màu... Chỉ cần một chiếc smartphone đang dùng là làm được ngay, không cần máy tính phức tạp đâu."
    },
    {
      id: 3,
      q: "Mình rất sợ đứng trước ống kính, nói hay vấp thì làm sao xây kênh được?",
      a: "Thật ra, ai mới đầu quay clip cũng run hết á. Đơn giản thôi: nếu ngại lộ mặt, bạn có thể chọn các ngách video review sản phẩm lồng tiếng, làm video dạng hoạt cảnh hoặc dùng AI minh họa. Còn nếu bạn vẫn muốn lộ mặt để làm thương hiệu chất hơn, mình sẽ chỉ bạn mẹo dùng app nhắc chữ trên điện thoại. Bạn cứ nhìn màn hình đọc thôi, đảm bảo nói trôi chảy như MC ngay."
    },
    {
      id: 4,
      q: "Mình cần phải mua thêm thiết bị gì đắt tiền để học không?",
      a: "Không cần phức tạp đâu bạn. Thiết bị duy nhất bạn cần là chiếc điện thoại bạn đang cầm trên tay thôi. Không cần máy ảnh xịn, không cần studio lung linh gì hết. Nếu được, bạn chỉ cần sắm thêm chiếc micro cài áo không dây khoảng 200k - 300k để lọc bớt tiếng ồn là quá ngon lành rồi."
    },
    {
      id: 5,
      q: "Sau 14 hoặc 30 ngày đồng hành kết thúc thì mình có được hỗ trợ nữa không?",
      a: "Không hề bị bỏ rơi đâu nha. Học xong bạn sẽ được chuyển vào Cộng đồng kín THCN 5.0 trọn đời. Bọn mình vẫn ở đó, liên tục cập nhật các xu hướng kịch bản mới, âm thanh hot trend và thuật toán mới của TikTok, Reels để bạn luôn đi đúng hướng."
    },
    {
      id: 6,
      q: "Học phí cao thế, trên mạng mình thấy nhiều khóa tự học có vài trăm nghìn thôi?",
      a: "Thật ra, các khóa tự học rẻ là vì họ chỉ quăng cho bạn một đống video quay sẵn rồi bắt bạn tự bơi. Kết quả là bạn mua về xong nản rồi bỏ xó, tính ra lại thành đắt nhất. Còn ở đây, bạn đang đầu tư vào một gói đồng hành: có chuyên gia chốt ngách hộ bạn, làm hộ bạn các phần kỹ thuật khó nhất (thiết lập kênh, làm ảnh bìa, edit sẵn 5 video đầu tiên, thậm chí làm Landing Page phễu bán hàng). Bạn bỏ tiền ra để mua kết quả thật và sự đồng hành, chứ không phải mua lý thuyết suông."
    },
    {
      id: 7,
      q: "Gói 14 ngày khác gói 30 ngày ở chỗ nào? Nên chọn gói nào?",
      a: "Đơn giản thôi bạn:<br><br>• <strong>Gói 14 ngày (4.99M):</strong> Tập trung chốt ngách, setup kênh chuyên nghiệp và giúp bạn vượt qua nỗi sợ công nghệ (bọn mình edit hộ 5 video đầu). Phù hợp để khởi động nhanh.<br>• <strong>Gói 30 ngày (6.99M):</strong> Đồng hành gấp đôi thời gian, giúp bạn xây dựng hẳn một phễu bán hàng hoàn chỉnh (bọn mình thiết kế hộ Landing Page, tặng kịch bản tuyển sỉ/chốt đơn riêng cho ngành của bạn, chỉ cách dùng AI viết kịch bản nhanh hàng tuần, và có Zoom 1-1 với Cô Thiện).<br><br>Nếu bạn muốn xây kênh để tạo doanh thu và bán hàng thực tế luôn thì mình khuyên thật lòng nên chọn gói 30 ngày nha.",
      cta: "buy"
    },
    {
      id: 8,
      q: "Có cam kết đầu ra gì không bạn?",
      a: "Riêng với Gói 30 ngày, bọn mình cam kết hoàn tiền 100% trong 30 ngày. Nếu bạn tham gia học đầy đủ, làm đúng hướng dẫn của mentor mà kênh không có tiến triển gì, bọn mình trả lại tiền luôn, không hỏi nhiều. Rủi ro của bạn bằng 0. Ngoài ra, học viên xuất sắc còn có cơ hội nhận dự án làm việc trực tiếp tại Học viện Vinmaredu nữa đó.",
      cta: "buy"
    },
    {
      id: 9,
      q: "Nếu mình bận đột xuất có được học bù hoặc bảo lưu không?",
      a: "Được nha bạn, thoải mái luôn. Bạn có thể xem lại video record buổi học bất cứ lúc nào. Còn nếu bận quá không theo kịp, cứ nhắn mentor để được bảo lưu sang khóa tiếp theo hoàn toàn miễn phí."
    },
    {
      id: 10,
      q: "Mình chưa có sản phẩm để bán, chỉ muốn học để kiếm tiền thì làm thế nào?",
      a: "Thật ra, chưa có sản phẩm lại càng dễ bắt đầu. Bạn có thể chọn làm tiếp thị liên kết (Affiliate Marketing) như bạn Trần Minh Nam (học viên cũ bên mình, giờ kiếm 50M+/tháng nhờ affiliate). Bọn mình sẽ hướng dẫn bạn cách chọn các sản phẩm hot dễ bán trên TikTok Shop, cách gắn link và cách làm video review thu hút người xem click mua."
    }
  ];

  // Helper to add message in chat body
  function addMessage(sender, text, hasCTA = null) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chatbot-msg', sender === 'bot' ? 'msg-bot' : 'msg-user');
    
    let contentHtml = `<div class="msg-content">${text}`;
    
    if (hasCTA === 'buy') {
      contentHtml += `<br><a href="#register" class="chatbot-action-btn cta-scroll-btn"><i class="fa-solid fa-fire"></i> Đăng Ký Giữ Chỗ Ngay</a>`;
    } else if (hasCTA === 'survey') {
      contentHtml += `<br><a href="#khao-sat" class="chatbot-action-btn btn-sec cta-scroll-btn"><i class="fa-solid fa-file-signature"></i> Điền Khảo Sát 1 Phút</a>`;
    }
    contentHtml += `</div>`;
    
    msgDiv.innerHTML = contentHtml;
    chatBody.appendChild(msgDiv);
    scrollToBottom();

    // Smooth scroll configuration
    const ctaBtns = msgDiv.querySelectorAll('.cta-scroll-btn');
    ctaBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('href');
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          const headerOffset = 80;
          const elementPosition = targetEl.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          
          // Flash target form border
          targetEl.style.transition = 'all 0.5s ease';
          targetEl.style.boxShadow = '0 0 30px rgba(139, 92, 246, 0.8)';
          setTimeout(() => {
            targetEl.style.boxShadow = '';
          }, 3000);
        }
      });
    });
  }

  // Show typing effect
  function showBotTyping(action) {
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('chatbot-msg', 'msg-bot', 'typing-msg');
    typingDiv.innerHTML = `
      <div class="msg-content">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    chatBody.appendChild(typingDiv);
    scrollToBottom();

    setTimeout(() => {
      typingDiv.remove();
      action();
    }, 800 + Math.random() * 500);
  }

  // Show main menu options
  function showMainMenu() {
    chatOptions.innerHTML = `
      <button class="option-btn" data-action="goi-hoc">Các gói đồng hành 14 & 30 ngày khác thế nào? <i class="fa-solid fa-chevron-right"></i></button>
      <button class="option-btn" data-action="cong-nghe-ong-kinh">Yếu công nghệ & Sợ ống kính có làm được không? <i class="fa-solid fa-chevron-right"></i></button>
      <button class="option-btn" data-action="list-faqs">Xem 10 câu hỏi thường gặp nhất (FAQs) <i class="fa-solid fa-list-ul"></i></button>
      <button class="option-btn btn-cta" data-action="chot-don">👉 ĐĂNG KÝ NHẬN ƯU ĐÃI GIẢM 50%</button>
      <button class="option-btn btn-sec-cta" data-action="khao-sat-tu-van">Nhận tư vấn lộ trình riêng (Khảo sát 1 phút)</button>
    `;
    hookOptionClicks();
  }

  // Show FAQ list
  function showFAQList() {
    let faqButtonsHtml = faqData.map(item => `
      <button class="option-btn" data-faq-id="${item.id}">${item.id}. ${item.q.substring(0, 48)}... <i class="fa-solid fa-chevron-right"></i></button>
    `).join('');
    
    chatOptions.innerHTML = faqButtonsHtml + `
      <button class="option-btn btn-sec-cta" data-action="main-menu"><i class="fa-solid fa-arrow-left"></i> Quay lại Menu chính</button>
    `;
    hookOptionClicks();
  }

  // Hook option click events
  function hookOptionClicks() {
    const btns = chatOptions.querySelectorAll('.option-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const faqId = btn.getAttribute('data-faq-id');

        if (faqId) {
          const faq = faqData.find(item => item.id == faqId);
          if (faq) {
            addMessage('user', faq.q);
            showBotTyping(() => {
              addMessage('bot', faq.a, faq.cta || null);
              chatOptions.innerHTML = `
                <button class="option-btn btn-cta" data-action="chot-don">👉 ĐĂNG KÝ NHẬN ƯU ĐÃI NGAY</button>
                <button class="option-btn" data-action="list-faqs"><i class="fa-solid fa-arrow-left"></i> Quay lại danh sách câu hỏi</button>
                <button class="option-btn btn-sec-cta" data-action="main-menu">Menu chính</button>
              `;
              hookOptionClicks();
            });
          }
        } else if (action === 'main-menu') {
          showMainMenu();
        } else if (action === 'list-faqs') {
          showFAQList();
        } else if (action === 'goi-hoc') {
          addMessage('user', "Các gói đồng hành 14 ngày & 30 ngày khác nhau thế nào? Nên chọn gói nào?");
          showBotTyping(() => {
            const answer = faqData.find(item => item.id == 7).a;
            addMessage('bot', answer, 'buy');
            showMainMenu();
          });
        } else if (action === 'cong-nghe-ong-kinh') {
          addMessage('user', "Mình không giỏi công nghệ và rất sợ đứng trước ống kính...");
          showBotTyping(() => {
            const ans2 = faqData.find(item => item.id == 2).a;
            const ans3 = faqData.find(item => item.id == 3).a;
            const combinedAns = `${ans2}<br><br>${ans3}`;
            addMessage('bot', combinedAns, 'survey');
            showMainMenu();
          });
        } else if (action === 'chot-don') {
          addMessage('user', "Tôi muốn đăng ký học / Nhận ưu đãi giảm 50%");
          showBotTyping(() => {
            const closingText = "Tuyệt vời quá, nghe bạn chia sẻ là mình thấy bạn có ngách rất tiềm năng rồi đó. Thử xem, nếu bạn đã sẵn sàng để sở hữu một kênh thương hiệu cá nhân của riêng mình, hãy chốt luôn gói đồng hành nhé. Hiện tại vẫn đang còn ưu đãi giảm giá 50% trong hôm nay đó. Bấm nút phía dưới để đăng ký giữ chỗ và nhận ưu đãi ngay nha!";
            addMessage('bot', closingText, 'buy');
            showMainMenu();
          });
        } else if (action === 'khao-sat-tu-van') {
          addMessage('user', "Tôi chưa sẵn sàng mua ngay, cần tư vấn lộ trình riêng");
          showBotTyping(() => {
            const surveyText = "Không sao nè, việc xây kênh là chặng đường dài nên bạn cứ cân nhắc kỹ nha. Để mình hiểu rõ hơn về thế mạnh cũng như khó khăn hiện tại của bạn, thử xem qua form khảo sát ngắn này nhé. Chỉ mất 1 phút thôi, dựa vào đó mình sẽ gợi ý thêm cho bạn một lộ trình phù hợp nhất. Điền thông tin khảo sát ở nút dưới này nha:";
            addMessage('bot', surveyText, 'survey');
            showMainMenu();
          });
        }
      });
    });
  }

  // Handle direct text query search
  function handleUserTextQuery(query) {
    const text = query.toLowerCase().trim();

    // 1. Chốt đơn / Đăng ký
    if (text.includes('đăng ký') || text.includes('mua') || text.includes('học phí') || text.includes('bao nhiêu tiền') || text.includes('giá') || text.includes('chốt đơn') || text.includes('ưu đãi') || text.includes('gói 14') || text.includes('gói 30') || text.includes('chi phí') || text.includes('tốn tiền')) {
      if (text.includes('khác nhau') || text.includes('so sánh') || text.includes('gói nào')) {
        const answer = faqData.find(item => item.id == 7).a;
        addMessage('bot', answer, 'buy');
      } else {
        const closingText = "Tuyệt vời quá, nghe bạn chia sẻ là mình thấy bạn có ngách rất tiềm năng rồi đó. Thử xem, nếu bạn đã sẵn sàng để sở hữu một kênh thương hiệu cá nhân của riêng mình, hãy chốt luôn gói đồng hành nhé. Hiện tại vẫn đang còn ưu đãi giảm giá 50% trong hôm nay đó. Bấm nút phía dưới để đăng ký giữ chỗ và nhận ưu đãi ngay nha!";
        addMessage('bot', closingText, 'buy');
      }
      return;
    }

    // 2. Chưa sẵn sàng / khảo sát
    if (text.includes('khảo sát') || text.includes('chưa sẵn sàng') || text.includes('tư vấn') || text.includes('lộ trình') || text.includes('chưa muốn mua') || text.includes('tìm hiểu thêm')) {
      const surveyText = "Không sao nè, việc xây kênh là chặng đường dài nên bạn cứ cân nhắc kỹ nha. Để mình hiểu rõ hơn về thế mạnh cũng như khó khăn hiện tại của bạn, thử xem qua form khảo sát ngắn này nhé. Chỉ mất 1 phút thôi, dựa vào đó mình sẽ gợi ý thêm cho bạn một lộ trình phù hợp nhất. Điền thông tin khảo sát ở nút dưới này nha:";
      addMessage('bot', surveyText, 'survey');
      return;
    }

    // 3. Công nghệ / CapCut / Quay dựng
    if (text.includes('công nghệ') || text.includes('quay dựng') || text.includes('capcut') || text.includes('edit') || text.includes('dựng video') || text.includes('chỉnh sửa') || text.includes('mù công nghệ')) {
      const answer = faqData.find(item => item.id == 2).a;
      addMessage('bot', answer);
      return;
    }

    // 4. Sợ camera / Ống kính / Lộ mặt
    if (text.includes('ngại') || text.includes('ống kính') || text.includes('camera') || text.includes('lộ mặt') || text.includes('nói vấp') || text.includes('giọng nói') || text.includes('sợ camera') || text.includes('không muốn xuất hiện')) {
      const answer = faqData.find(item => item.id == 3).a;
      addMessage('bot', answer);
      return;
    }

    // 5. Thiết bị / Micro / Điện thoại
    if (text.includes('thiết bị') || text.includes('chuẩn bị') || text.includes('điện thoại') || text.includes('micro') || text.includes('studio') || text.includes('máy ảnh') || text.includes('dụng cụ')) {
      const answer = faqData.find(item => item.id == 4).a;
      addMessage('bot', answer);
      return;
    }

    // 6. Thời gian / Bận / Linh hoạt
    if (text.includes('thời gian') || text.includes('bận') || text.includes('giờ học') || text.includes('lịch học') || text.includes('bao lâu') || text.includes('rảnh')) {
      const answer = faqData.find(item => item.id == 1).a;
      addMessage('bot', answer);
      return;
    }

    // 7. Hoàn tiền / Cam kết
    if (text.includes('cam kết') || text.includes('hoàn tiền') || text.includes('trả lại tiền') || text.includes('uy tín') || text.includes('chất lượng')) {
      const answer = faqData.find(item => item.id == 8).a;
      addMessage('bot', answer, 'buy');
      return;
    }

    // 8. Hỗ trợ sau khóa học / Trọn đời
    if (text.includes('hỗ trợ') || text.includes('sau khóa') || text.includes('học xong') || text.includes('kết thúc') || text.includes('bỏ rơi') || text.includes('trọn đời')) {
      const answer = faqData.find(item => item.id == 5).a;
      addMessage('bot', answer);
      return;
    }

    // 9. Học bù / Bảo lưu
    if (text.includes('học bù') || text.includes('bảo lưu') || text.includes('nghỉ học') || text.includes('bận đột xuất')) {
      const answer = faqData.find(item => item.id == 9).a;
      addMessage('bot', answer);
      return;
    }

    // 10. Chưa có sản phẩm / Affiliate / Kiếm tiền
    if (text.includes('chưa có sản phẩm') || text.includes('affiliate') || text.includes('tiếp thị liên kết') || text.includes('kiếm tiền') || text.includes('chưa có gì để bán') || text.includes('bán gì')) {
      const answer = faqData.find(item => item.id == 10).a;
      addMessage('bot', answer);
      return;
    }

    // Fallback response matching Brand Voice
    const fallbackText = "Thật ra câu này mình chưa rõ lắm. Đơn giản thôi, bạn thử gõ ngắn gọn các câu hỏi liên quan đến: học phí, bận rộn, sợ camera, công nghệ, thiết bị, hoàn tiền, hoặc affiliate xem sao nha.<br><br>Hoặc không cần phức tạp đâu, bạn thử click chọn trực tiếp mấy câu hỏi nhanh ở menu phía dưới này nè!";
    addMessage('bot', fallbackText);
    showMainMenu();
  }

  // Bind direct input submit event
  if (inputForm && textInput) {
    inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userText = textInput.value.trim();
      if (!userText) return;

      // Add user query to chat logs
      addMessage('user', userText);
      textInput.value = '';

      // Set bot typing state and resolve query
      showBotTyping(() => {
        handleUserTextQuery(userText);
      });
    });
  }

  showMainMenu();
}
