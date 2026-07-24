// SePay Payment Configurations
const SEPAY_CONFIG = {
  BANK_ACC: '0010197779999', // MBBank Số tài khoản
  BANK_NAME: 'MBBank',
  ACCOUNT_HOLDER: 'VU QUANG PHONG',
  MEMO_PREFIX: 'PMEDIA'
};

// Global variables for intervals
let paymentCheckInterval = null;
let paymentCountdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Get registration data
  let regData = null;
  try {
    const stored = sessionStorage.getItem('registrationData');
    if (stored) {
      regData = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Lỗi khi đọc dữ liệu đăng ký từ sessionStorage:', e);
  }

  // Fallback to URL search parameters
  if (!regData) {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');
    const phone = urlParams.get('phone');
    const email = urlParams.get('email');
    const packageVal = urlParams.get('package');

    if (name && phone && email && packageVal) {
      regData = {
        fullName: name,
        phone: phone.replace(/[^0-9]/g, ''),
        email: email,
        package: packageVal
      };
    }
  }

  // If still no registration data, redirect to home page
  if (!regData) {
    alert('Không tìm thấy thông tin đăng ký! Bạn sẽ được chuyển hướng về trang chủ.');
    window.location.href = '/';
    return;
  }

  // 2. Setup checkout interface with user data
  setupCheckoutPage(regData);
});

// Format currency to VND standard
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(amount)
    .replace('₫', 'đ')
    .trim();
}

function setupCheckoutPage(regData) {
  // Select DOM elements
  const pkgBadge = document.getElementById('checkoutPackageBadge');
  const pkgDesc = document.getElementById('checkoutPackageDesc');
  const originalPriceText = document.getElementById('checkoutOriginalPrice');
  const discountText = document.getElementById('checkoutDiscount');
  const finalPriceText = document.getElementById('checkoutFinalPrice');
  
  const custNameText = document.getElementById('custName');
  const custPhoneText = document.getElementById('custPhone');
  const custEmailText = document.getElementById('custEmail');

  const bankNameText = document.getElementById('bankName');
  const bankHolderText = document.getElementById('bankHolder');
  const bankNumberText = document.getElementById('bankNumber');
  const bankAmountText = document.getElementById('bankAmount');
  const bankContentText = document.getElementById('bankContent');
  
  const qrImg = document.getElementById('checkoutQrImg');

  // Determine pricing based on package
  const packageVal = regData.package;
  let packageName = '';
  let packageDescription = '';
  let amount = 0;
  let originalAmount = 0;

  if (packageVal === '14days') {
    packageName = 'GÓI ĐỒNG HÀNH 14 NGÀY';
    packageDescription = 'Kèm cặp 1-1, tối ưu kênh cá nhân và thiết lập ngách nội dung độc bản trong 14 ngày.';
    amount = 50000;
    originalAmount = 100000;
  } else {
    // 30 days
    packageName = 'GÓI ĐỒNG HÀNH 30 NGÀY';
    packageDescription = 'Kèm cặp 1-1 trực tiếp, tối ưu toàn diện từ thiết lập kênh kỹ thuật đến kịch bản nội dung hoàn chỉnh trong 30 ngày.';
    amount = 6990000;
    originalAmount = 13980000;
  }

  const discountAmount = originalAmount - amount;

  // Render Left Side (Order Summary)
  if (pkgBadge) pkgBadge.textContent = packageName;
  if (pkgDesc) pkgDesc.textContent = packageDescription;
  if (originalPriceText) originalPriceText.textContent = formatCurrency(originalAmount);
  if (discountText) discountText.textContent = '-' + formatCurrency(discountAmount);
  if (finalPriceText) finalPriceText.textContent = formatCurrency(amount);

  // Render Customer Info
  if (custNameText) custNameText.textContent = regData.fullName;
  if (custPhoneText) custPhoneText.textContent = regData.phone;
  if (custEmailText) custEmailText.textContent = regData.email;

  // Render Right Side (Payment Details)
  const transferContent = (SEPAY_CONFIG.MEMO_PREFIX + regData.phone).toUpperCase();
  
  if (bankNameText) bankNameText.textContent = SEPAY_CONFIG.BANK_NAME;
  if (bankHolderText) bankHolderText.textContent = SEPAY_CONFIG.ACCOUNT_HOLDER;
  if (bankNumberText) bankNumberText.textContent = SEPAY_CONFIG.BANK_ACC;
  if (bankAmountText) bankAmountText.textContent = formatCurrency(amount);
  if (bankContentText) bankContentText.textContent = transferContent;

  // Generate VietQR URL
  const qrUrl = `https://vietqr.app/img?acc=${SEPAY_CONFIG.BANK_ACC}&bank=${SEPAY_CONFIG.BANK_NAME}&amount=${amount}&des=${transferContent}&template=compact&holder=${encodeURIComponent(SEPAY_CONFIG.ACCOUNT_HOLDER)}`;
  if (qrImg) qrImg.src = qrUrl;

  // Setup Copy Buttons
  setupCopyBtn('copyAccBtn', SEPAY_CONFIG.BANK_ACC);
  setupCopyBtn('copyAmountBtn', amount.toString());
  setupCopyBtn('copyContentBtn', transferContent);

  // Record start time
  const checkoutStartTime = new Date(Date.now() - 60000); // 1 minute buffer for clock drift

  // Start countdown and SePay polling
  startTimerAndPolling(amount, transferContent, checkoutStartTime, regData);
}

// Copy button event setup
function setupCopyBtn(btnId, textToCopy) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Không thể sao chép văn bản: ', err);
    });
  });
}

function startTimerAndPolling(targetAmount, targetContent, checkoutStartTime, regData) {
  const timerText = document.getElementById('checkoutTimer');
  const liveStatusText = document.getElementById('liveStatusText');

  clearInterval(paymentCheckInterval);
  clearInterval(paymentCountdownInterval);

  // 1. Countdown timer (10 minutes = 600 seconds)
  let secondsLeft = 600;
  paymentCountdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(paymentCountdownInterval);
      clearInterval(paymentCheckInterval);
      if (timerText) timerText.textContent = "Giao dịch hết hạn";
      if (liveStatusText) {
        liveStatusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Giao dịch hết hạn thanh toán. Vui lòng quay lại đăng ký lại.`;
      }
      return;
    }
    
    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    if (timerText) {
      timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }, 1000);

  // 2. Poll SePay API through proxy every 5 seconds
  paymentCheckInterval = setInterval(() => {
    pollSepayApi(targetAmount, targetContent, checkoutStartTime, regData);
  }, 5000);
}

function pollSepayApi(targetAmount, targetContent, checkoutStartTime, regData) {
  const liveStatusText = document.getElementById('liveStatusText');
  const googleScriptUrl = "https://script.google.com/macros/s/AKfycbwLDNOODkV5ZgUJFQXl_ToJLUOIynsMkDb45fNijljY2Sv8kF4G3CoWcbD0a-DtVVpBDg/exec";

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
        const txDate = new Date(tx.transaction_date.replace(' ', 'T') + '+07:00');
        
        return amountIn === targetAmount && 
               content.toUpperCase().includes(targetContent.toUpperCase()) &&
               txDate >= checkoutStartTime;
      });

      if (matchedTx) {
        // Payment success! Stop timers
        clearInterval(paymentCheckInterval);
        clearInterval(paymentCountdownInterval);

        if (liveStatusText) {
          liveStatusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> Thanh toán thành công! Đang xử lý...`;
        }

        // Update sheet with Paid status
        const updateData = new URLSearchParams();
        updateData.append('action', 'updatePayment');
        updateData.append('phone', regData.phone);
        updateData.append('amount', matchedTx.amount_in);

        fetch(googleScriptUrl, {
          method: 'POST',
          body: updateData
        })
        .then(res => res.json())
        .then(result => console.log('Cập nhật trạng thái Google Sheet:', result))
        .catch(err => console.error("Lỗi cập nhật Google Sheet:", err));

        // Wait 1.5 seconds then show success screen
        setTimeout(() => {
          showSuccessScreen(matchedTx, regData);
        }, 1500);
      }
    }
  })
  .catch(error => {
    console.error('Lỗi khi gọi SePay API Proxy:', error);
  });
}

function showSuccessScreen(matchedTx, regData) {
  const checkoutGrid = document.getElementById('checkoutGrid');
  const successView = document.getElementById('checkoutSuccessView');

  // Hide the payment processing columns and show the success screen
  if (checkoutGrid) checkoutGrid.style.display = 'none';
  if (successView) successView.style.display = 'block';

  // Fill data in success screen
  const successTxId = document.getElementById('successTxId');
  const successCustName = document.getElementById('successCustName');
  const successCustPhone = document.getElementById('successCustPhone');
  const successPackageName = document.getElementById('successPackageName');
  const successAmount = document.getElementById('successAmount');
  const successPhoneRef = document.getElementById('successPhoneRef');

  const pkgVal = regData.package;
  const pkgName = pkgVal === '14days' ? 'GÓI ĐỒNG HÀNH 14 NGÀY' : 'GÓI ĐỒNG HÀNH 30 NGÀY';

  if (successTxId) successTxId.textContent = `Mã GD: ${matchedTx.transaction_id || 'SePay-' + Date.now().toString().slice(-6)}`;
  if (successCustName) successCustName.textContent = regData.fullName;
  if (successCustPhone) successCustPhone.textContent = regData.phone;
  if (successPackageName) successPackageName.textContent = pkgName;
  if (successAmount) successAmount.textContent = formatCurrency(matchedTx.amount_in);
  if (successPhoneRef) successPhoneRef.textContent = regData.phone;

  // Clear session data to prevent accidental page refresh repurchases
  try {
    sessionStorage.removeItem('registrationData');
  } catch(e) {}
}
