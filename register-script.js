// Toggle Password Visibility
const togglePassword = document.getElementById('togglePassword');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

togglePassword.addEventListener('click', function () {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '🙈';
});

toggleConfirmPassword.addEventListener('click', function () {
    const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPasswordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '🙈';
});

// Password Strength Checker
passwordInput.addEventListener('input', function () {
    const password = this.value;
    const strengthBar = document.getElementById('strengthBar');

    strengthBar.className = 'strength-bar';

    if (password.length === 0) {
        strengthBar.style.width = '0%';
    } else if (password.length < 6) {
        strengthBar.classList.add('strength-weak');
    } else if (password.length < 10) {
        strengthBar.classList.add('strength-medium');
    } else {
        strengthBar.classList.add('strength-strong');
    }
});

// Real-time Password Match Validation
confirmPasswordInput.addEventListener('input', function () {
    const password = passwordInput.value;
    const confirmPassword = this.value;

    if (confirmPassword.length > 0) {
        if (password !== confirmPassword) {
            this.style.borderColor = '#ff4444';
        } else {
            this.style.borderColor = '#00C851';
        }
    } else {
        this.style.borderColor = '#e0e0e0';
    }
});

// Handle Registration Form Submission
const registerForm = document.getElementById('registerForm');

registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const birthdate = document.getElementById('birthdate').value;
    const gender = document.getElementById('gender').value;

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const termsAccepted = document.getElementById('terms').checked;

    if (!firstName || !lastName || !email || !phone || !birthdate || !gender) {
        showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showToast('الرجاء إدخال بريد إلكتروني صحيح', 'error');
        return;
    }



    if (phone.length !== 10 || !phone.startsWith('05')) {
        showToast('رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام', 'error');
        return;
    }

    if (password.length < 8) {
        showToast('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('كلمة المرور غير متطابقة', 'error');
        return;
    }

    if (!termsAccepted) {
        showToast('يجب الموافقة على الشروط والأحكام', 'error');
        return;
    }

    const birthDate = new Date(birthdate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 13) {
        showToast('يجب أن يكون عمرك 13 سنة على الأقل', 'error');
        return;
    }


    try {
        const data = await ApiClient.request('register', {
            method: 'POST',
            body: {
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                birthdate,
                gender,
                password
            }
        });
        if (data.user) {
            ApiClient.saveSession(data.user);
        }
        localStorage.setItem('isRegistered', 'true');
        showToast('تم إنشاء الحساب بنجاح! 🎉', 'success');



        setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } catch (err) {
        const msg = err?.message || 'تعذر إنشاء الحساب';
        showToast(msg, 'error');
    }
});





console.log('EduPath KSA - Register Page Loaded Successfully ✅');
