window.addEventListener('load', () => {
    initDashboard();
});

async function initDashboard() {
    const user = await ApiClient.ensureLoggedIn();
    if (!user) return;
    await loadUserProfile();
    await loadUserStats();
    await loadMajorQuizzes();
    animateStats();
    setupCardAnimations();
    bindLogout();
    bindLangToggle();
    updateGreeting();
    await setupAdminPanel(user);
    greetNewUser();
}

async function loadUserProfile() {
    try {
        const user = await ApiClient.request('me');
        ApiClient.saveSession(user);
        const firstName = user.first_name || 'طالب';
        document.getElementById('userName').textContent = firstName;
        document.getElementById('welcomeName').textContent = firstName;
        const avatar = document.querySelector('.user-avatar');
        if (avatar) {
            const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || firstName;
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=667eea&color=fff&size=40`;
        }
        return user;
    } catch (err) {
        ApiClient.clearSession();
        window.location.href = 'login.html';
        return null;
    }
}

async function loadUserStats() {
    try {
        const attempts = await ApiClient.request('list_attempts');
        const completed = attempts.length;
        const scores = attempts.map(a => parseFloat(a.composite_score) || 0);
        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const totalTime = attempts.reduce((acc, a) => acc + (parseInt(a.duration_seconds) || 0), 0);

        document.getElementById('completedTests').textContent = completed || '0';
        document.getElementById('avgScore').textContent = `${avgScore}%`;
        document.getElementById('recommendations').textContent = '5';
        document.getElementById('totalTime').textContent = totalTime.toString();

        if (attempts[0]) {
            localStorage.setItem('latestAttemptId', attempts[0].id);
        }
    } catch (err) {
        console.warn('Unable to load stats', err);
    }
}

async function loadMajorQuizzes() {
    const container = document.getElementById('majorQuizList');
    if (!container) return;
    container.innerHTML = '<p style="color:#666;">جارٍ تحميل الاختبارات...</p>';
    try {
        let quizzes = await ApiClient.request('list_quizzes');
        quizzes = quizzes.filter(q => q.id !== 1 && q.is_active);
        if (!quizzes.length) {
            container.innerHTML = '<p style="color:#666;">لا توجد اختبارات تخصص متاحة حالياً.</p>';
            return;
        }
        container.innerHTML = '';
        quizzes.forEach(q => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '10px 12px';
            row.style.border = '1px solid #e6e6f3';
            row.style.borderRadius = '10px';
            row.style.background = '#f8f9ff';
            row.innerHTML = `
                <div>
                    <strong>${q.title}</strong>
                    <p style="margin:4px 0 0 0;color:#555;font-size:13px;">${q.description || ''}</p>
                </div>
                <button class="btn-start" style="margin:0;" onclick="location.href='major-quiz.html?quiz_id=${q.id}'">بدء</button>
            `;
            container.appendChild(row);
        });
    } catch (err) {
        console.warn(err);
        container.innerHTML = '<p style="color:#c00;">تعذر تحميل اختبارات التخصص.</p>';
    }
}

function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-info h3');
    statNumbers.forEach((stat, index) => {
        stat.style.opacity = '0';
        stat.style.transform = 'translateY(20px)';
        setTimeout(() => {
            stat.style.transition = 'all 0.5s ease';
            stat.style.opacity = '1';
            stat.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function bindLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', async function() {
        if (!confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
        try {
            await ApiClient.request('logout', { method: 'POST' });
        } catch (err) {
            console.warn('Logout cleanup failed', err);
        }
        ApiClient.clearSession();
        showToast('تم تسجيل الخروج بنجاح', 'success');
        setTimeout(() => window.location.href = 'index.html', 800);
    });
}

function bindLangToggle() {
    let currentLang = 'ar';
    const langBtn = document.getElementById('langBtn');
    if (!langBtn) return;
    langBtn.addEventListener('click', function() {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        this.textContent = currentLang === 'ar' ? 'EN' : 'AR';
    });
}

function setupCardAnimations() {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.course-card, .activity-item, .recommendation-card, .admin-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });

    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function updateGreeting() {
    const hour = new Date().getHours();
    const welcomeCard = document.querySelector('.welcome-content h2');
    const userName = document.getElementById('welcomeName').textContent;
    let greeting = 'مرحباً';
    if (hour < 12) greeting = 'صباح الخير';
    else if (hour < 18) greeting = 'مساء الخير';
    else greeting = 'مساء الخير';
    if (welcomeCard) {
        welcomeCard.innerHTML = `${greeting}، <span id="welcomeName">${userName}</span>! 👋`;
    }
}

function greetNewUser() {
    const isNewUser = localStorage.getItem('isRegistered');
    if (isNewUser === 'true') {
        showToast('مرحباً بك في EduPath KSA! 🎉', 'success');
        localStorage.removeItem('isRegistered');
    }
}

async function setupAdminPanel(user) {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel || !user || user.role !== 'admin') {
        if (adminPanel) adminPanel.style.display = 'none';
        return;
    }
    adminPanel.style.display = 'block';
    await refreshQuizList();

    const createQuizBtn = document.getElementById('createQuizBtn');
    if (createQuizBtn) {
        createQuizBtn.addEventListener('click', createQuiz);
    }

    const addQuestionBtn = document.getElementById('addQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', addQuestion);
    }
}

async function refreshQuizList() {
    try {
        const quizzes = await ApiClient.request('list_quizzes');
        const selector = document.getElementById('quizSelector');
        const list = document.getElementById('quizList');
        if (selector) {
            selector.innerHTML = '';
            quizzes.forEach(q => {
                const opt = document.createElement('option');
                opt.value = q.id;
                opt.textContent = q.title;
                selector.appendChild(opt);
            });
        }
        if (list) {
            list.innerHTML = '';
            quizzes.forEach(q => {
                const row = document.createElement('div');
                row.className = 'quiz-row';
                row.innerHTML = `<strong>${q.title}</strong><span>${q.description || ''}</span>`;
                list.appendChild(row);
            });
        }
    } catch (err) {
        console.warn('Failed to load quizzes', err);
    }
}

async function createQuiz() {
    const titleInput = document.getElementById('quizTitleInput');
    const descInput = document.getElementById('quizDescriptionInput');
    const title = titleInput.value.trim();
    if (!title) {
        showToast('أدخل عنوان الاختبار', 'error');
        return;
    }
    try {
        await ApiClient.request('create_quiz', {
            method: 'POST',
            body: { title, description: descInput.value.trim(), is_active: 1 }
        });
        titleInput.value = '';
        descInput.value = '';
        showToast('تم إنشاء اختبار جديد', 'success');
        await refreshQuizList();
    } catch (err) {
        showToast(err?.message || 'تعذر إنشاء الاختبار', 'error');
    }
}

async function addQuestion() {
    const quizSelector = document.getElementById('quizSelector');
    const questionInput = document.getElementById('questionTextInput');
    const typeSelect = document.getElementById('questionTypeSelect');
    const optionsInput = document.getElementById('questionOptionsInput');
    const requiredCheckbox = document.getElementById('questionRequired');

    if (!quizSelector.value) {
        showToast('اختر اختباراً لإضافة سؤال', 'error');
        return;
    }
    if (!questionInput.value.trim()) {
        showToast('اكتب نص السؤال', 'error');
        return;
    }

    const options = optionsInput.value
        ? optionsInput.value.split(',').map(o => o.trim()).filter(Boolean)
        : null;

    try {
        await ApiClient.request('add_question', {
            method: 'POST',
            body: {
                quiz_id: parseInt(quizSelector.value, 10),
                question_text: questionInput.value.trim(),
                question_type: typeSelect.value,
                options: options,
                is_required: requiredCheckbox.checked ? 1 : 0
            }
        });
        questionInput.value = '';
        optionsInput.value = '';
        requiredCheckbox.checked = true;
        showToast('تمت إضافة السؤال', 'success');
        await refreshQuizList();
    } catch (err) {
        showToast(err?.message || 'تعذر إضافة السؤال', 'error');
    }
}
