// Toggle Password Visibility
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Change eye icon
    this.textContent = type === 'password' ? '👁️' : '🙈';
});

// Handle Login Form Submission
const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!email || !password) {
        showToast('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
        return;
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showToast('الرجاء إدخال بريد إلكتروني صحيح', 'error');
        return;
    }
    
    try {
        const data = await ApiClient.request('login', {
            method: 'POST',
            body: { email, password }
        });
        if (data.user) {
            ApiClient.saveSession(data.user);
        }
        if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('rememberEmail', email);
        } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('rememberEmail');
        }
        showToast('تم تسجيل الدخول بنجاح! 🎉', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
    } catch (err) {
        const msg = err?.message || 'تعذر تسجيل الدخول';
        showToast(msg, 'error');
    }
});

// Social Login Buttons
document.getElementById('googleBtn').addEventListener('click', function() {
    showToast('تسجيل الدخول عبر Google قريباً', 'info');
});

document.getElementById('twitterBtn').addEventListener('click', function() {
    showToast('تسجيل الدخول عبر Twitter قريباً', 'info');
});

// Check if user is already logged in
window.addEventListener('load', async function() {
    const rememberMe = localStorage.getItem('rememberMe');
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberMe === 'true' && rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('rememberMe').checked = true;
    }

    try {
        const me = await ApiClient.ensureLoggedIn(false);
        if (me) {
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        ApiClient.clearSession();
    }
});

console.log('EduPath KSA - Login Page Loaded Successfully ✅');
