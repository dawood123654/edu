let quizzes = [];
let currentQuizId = null;
let questions = [];
let quizStartTime = Date.now();

window.addEventListener('load', async () => {
    const user = await ApiClient.ensureLoggedIn();
    if (!user) return;
    await loadQuizzes();
    bindActions();
});

async function loadQuizzes() {
    try {
        quizzes = await ApiClient.request('list_quizzes');
        quizzes = quizzes.filter(q => q.id !== 1 && q.is_active); // exclude survey

        const selector = document.getElementById('quizSelector');
        selector.innerHTML = '';

        if (quizzes.length === 0) {
            selector.disabled = true;
            document.getElementById('quizTitle').textContent = 'لا توجد اختبارات متاحة حالياً';
            document.getElementById('quizDescription').textContent = 'اطلب من المسؤول إضافة اختبارات جديدة للتخصصات.';
            document.getElementById('submitBtn').disabled = true;
            return;
        }

        quizzes.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = q.title;
            selector.appendChild(opt);
        });

        const urlQuizId = parseInt(new URLSearchParams(location.search).get('quiz_id'), 10);
        const initial = quizzes.find(q => q.id === urlQuizId) ? urlQuizId : quizzes[0].id;
        selector.value = initial;
        await switchQuiz(initial);
    } catch (err) {
        console.warn(err);
        showToast('تعذر تحميل الاختبارات', 'error');
    }
}

function bindActions() {
    const selector = document.getElementById('quizSelector');
    if (selector) {
        selector.addEventListener('change', async (e) => {
            const id = parseInt(e.target.value, 10);
            await switchQuiz(id);
        });
    }

    document.getElementById('quizForm').addEventListener('submit', submitQuiz);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    document.getElementById('questionsContainer').addEventListener('change', updateProgress);
}

async function switchQuiz(id) {
    currentQuizId = id;
    quizStartTime = Date.now();
    const quiz = quizzes.find(q => q.id === id);
    if (quiz) {
        document.getElementById('quizTitle').textContent = quiz.title;
        document.getElementById('quizDescription').textContent = quiz.description || 'اختبار تخصصي';
    }
    await loadQuestions(id);
    updateProgress();
    const params = new URLSearchParams(location.search);
    params.set('quiz_id', id);
    const newUrl = `${location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

async function loadQuestions(quizId) {
    try {
        questions = await ApiClient.request('list_questions', { params: { quiz_id: quizId } });
        renderQuestions(questions);
    } catch (err) {
        console.warn(err);
        showToast('تعذر تحميل أسئلة الاختبار', 'error');
    }
}

function renderQuestions(qs) {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    qs.forEach(q => {
        const card = document.createElement('div');
        card.className = 'mq-question';

        const title = document.createElement('h4');
        title.innerHTML = `${q.question_text}${q.is_required ? ' <span class="required-mark">*</span>' : ''}`;
        card.appendChild(title);

        const fieldName = `q_${q.id}`;
        let field = null;

        if (q.question_type === 'choice' && Array.isArray(q.options) && q.options.length) {
            const optsWrap = document.createElement('div');
            optsWrap.className = 'mq-options';
            q.options.forEach(opt => {
                const label = document.createElement('label');
                label.className = 'mq-option';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = fieldName;
                input.value = opt;
                if (q.is_required) input.required = true;
                label.appendChild(input);
                const span = document.createElement('span');
                span.textContent = opt;
                label.appendChild(span);
                optsWrap.appendChild(label);
            });
            field = optsWrap;
        } else if (q.question_type === 'boolean') {
            const optsWrap = document.createElement('div');
            optsWrap.className = 'mq-options';
            ['نعم', 'لا'].forEach((opt, idx) => {
                const label = document.createElement('label');
                label.className = 'mq-option';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = fieldName;
                input.value = idx === 0 ? 'yes' : 'no';
                if (q.is_required) input.required = true;
                label.appendChild(input);
                const span = document.createElement('span');
                span.textContent = opt;
                label.appendChild(span);
                optsWrap.appendChild(label);
            });
            field = optsWrap;
        } else if (q.question_type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'mq-input';
            input.name = fieldName;
            if (q.is_required) input.required = true;
            field = input;
        } else if (q.question_type === 'text') {
            const textarea = document.createElement('textarea');
            textarea.className = 'mq-textarea';
            textarea.name = fieldName;
            if (q.is_required) textarea.required = true;
            field = textarea;
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'mq-input';
            input.name = fieldName;
            if (q.is_required) input.required = true;
            field = input;
        }

        card.appendChild(field);
        container.appendChild(card);
    });
}

function collectAnswers() {
    const answers = {};
    questions.forEach(q => {
        const key = `q_${q.id}`;
        const fields = document.getElementsByName(key);
        if (!fields || fields.length === 0) return;
        const first = fields[0];
        if (first.type === 'radio') {
            const checked = Array.from(fields).find(f => f.checked);
            answers[key] = checked ? checked.value : '';
        } else if (first.tagName === 'TEXTAREA') {
            answers[key] = first.value.trim();
        } else {
            answers[key] = first.value.trim();
        }
    });
    return answers;
}

function updateProgress() {
    if (!questions.length) return;
    const answers = collectAnswers();
    const answered = questions.filter(q => {
        const val = answers[`q_${q.id}`];
        return val !== undefined && val !== '';
    }).length;
    const total = questions.length;
    document.getElementById('progressCount').textContent = `${answered}/${total}`;
    document.getElementById('progressFill').style.width = `${Math.round((answered / total) * 100)}%`;
}

async function submitQuiz(e) {
    e.preventDefault();
    if (!currentQuizId) {
        showToast('اختر اختباراً أولاً', 'error');
        return;
    }

    const form = document.getElementById('quizForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const answers = collectAnswers();
    const durationSeconds = Math.round((Date.now() - quizStartTime) / 1000);

    try {
        await ApiClient.request('save_attempt', {
            method: 'POST',
            body: {
                quiz_id: currentQuizId,
                duration_seconds: durationSeconds,
                answers
            }
        });
        showToast('تم حفظ محاولتك بنجاح', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
    } catch (err) {
        console.warn(err);
        showToast('تعذر حفظ المحاولة، حاول مجدداً', 'error');
    }
}
