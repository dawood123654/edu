// Load Results
window.addEventListener('load', function() {
    loadResults();
});

let currentUserId = null;
function userKey(base) {
    return currentUserId ? `${base}_${currentUserId}` : base;
}

function resetIfDifferentUser(user) {
    const lastId = localStorage.getItem('lastQuizUserId');
    const newId = user?.id ? String(user.id) : null;
    if (newId && lastId && lastId !== newId) {
        ['academicFormData', 'academicResults', 'certificateBase64', 'certificateFileName', 'aiRecommendation'].forEach(k => {
            localStorage.removeItem(`${k}_${lastId}`);
            localStorage.removeItem(k);
        });
    }
    if (newId) localStorage.setItem('lastQuizUserId', newId);
}

async function loadResults() {
    const user = await ApiClient.ensureLoggedIn(false);
    if (user) {
        currentUserId = user.id || null;
        resetIfDifferentUser(user);
    }

    let results = null;
    const resultsData = localStorage.getItem(userKey('academicResults'));
    if (resultsData) {
        results = JSON.parse(resultsData);
    }

    if (user) {
        try {
            const attempt = await ApiClient.request('latest_attempt', { params: { quiz_id: 1 } });
            const answers = attempt.answers || {};
            const compositeScore = attempt.composite_score ?? (results ? results.compositeScore : 0);
            if (results) {
                results.formData = answers;
                results.compositeScore = compositeScore;
            } else {
                results = { formData: answers, compositeScore: compositeScore, recommendations: [] };
            }
        } catch (err) {
            console.warn('Falling back to local results', err);
        }
    }

    const storedAi = localStorage.getItem(userKey('aiRecommendation'));
    if (storedAi && results) {
        results.aiRecommendation = storedAi;
    }

    if (!results) {
        alert('لم يتم العثور على نتائج. الرجاء إكمال الاستبيان أولاً.');
        window.location.href = 'quiz.html';
        return;
    }

    displayResults(results);
}

function displayResults(results) {
    const { formData, compositeScore } = results;
    const recommendations = results.recommendations || [];
    
    // Display composite score
    document.getElementById('finalScore').textContent = compositeScore + '%';
    document.getElementById('accuracyRate').textContent = compositeScore + '%';
    
    // Animate score ring
    animateScoreRing(parseFloat(compositeScore));
    
    // Display student information
    displayStudentInfo(formData);
    
    // Display performance badge
    displayPerformanceBadge(parseFloat(compositeScore));
    
    // Display statistics
    displayStatistics(formData, compositeScore);
    
    // Display recommendations
    displayRecommendations(recommendations, formData);
    
    // Display detailed analysis
    displayAnalysis(formData, compositeScore, recommendations);

    renderAiRecommendation(results, formData);
}

function animateScoreRing(score) {
    const ring = document.getElementById('scoreRing');
    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (score / 100) * circumference;
    
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;
    
    setTimeout(() => {
        ring.style.transition = 'stroke-dashoffset 2s ease-out';
        ring.style.strokeDashoffset = offset;
    }, 100);
}

function displayStudentInfo(formData) {
    // Update correct answers with GPA
    document.getElementById('correctAnswers').textContent = formData.gpa || 'N/A';
    document.querySelector('#correctAnswers').parentElement.querySelector('p').textContent = 'المعدل التراكمي';
    
    // Update wrong answers with track
    const trackNames = {
        'science': 'علمي',
        'humanities': 'أدبي',
        'sharia': 'شرعي',
        'admin': 'إداري',
        'computer': 'حاسب آلي'
    };
    document.getElementById('wrongAnswers').textContent = trackNames[formData.track] || formData.track;
    document.querySelector('#wrongAnswers').parentElement.querySelector('p').textContent = 'المسار الدراسي';
    
    // Update time taken with Qudurat score
    const quduratScore = formData.quduratScore || 'لم يتم الاختبار';
    document.getElementById('timeTaken').textContent = quduratScore;
    document.querySelector('#timeTaken').parentElement.querySelector('p').textContent = 'درجة القدرات';
}

function displayPerformanceBadge(score) {
    const badge = document.getElementById('performanceBadge');
    const badgeText = badge.querySelector('.badge-text');
    const badgeIcon = badge.querySelector('.badge-icon');
    
    if (score >= 90) {
        badgeText.textContent = 'ممتاز جداً';
        badgeIcon.textContent = '🏆';
        badge.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
    } else if (score >= 80) {
        badgeText.textContent = 'ممتاز';
        badgeIcon.textContent = '⭐';
        badge.style.background = 'linear-gradient(135deg, #00C851, #007E33)';
    } else if (score >= 70) {
        badgeText.textContent = 'جيد جداً';
        badgeIcon.textContent = '👍';
        badge.style.background = 'linear-gradient(135deg, #33b5e5, #0099CC)';
    } else {
        badgeText.textContent = 'جيد';
        badgeIcon.textContent = '✓';
        badge.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }
}

function renderAiRecommendation(results, formData) {
    const card = document.getElementById('aiRecommendationCard');
    if (!card) return;
    const textEl = document.getElementById('aiRecommendationText');
    const noteEl = document.getElementById('aiStatusNote');
    const retryBtn = document.getElementById('retryAiBtn');

    const recommendation = results.aiRecommendation || localStorage.getItem(userKey('aiRecommendation'));
    if (recommendation) {
        textEl.textContent = recommendation;
        noteEl.textContent = 'تم توليد التوصية اعتماداً على شهادتك ودرجاتك.';
        card.classList.remove('pending');
    } else {
        textEl.textContent = 'لم يتم الحصول على توصية بعد';
        noteEl.textContent = 'اضغط إعادة التحليل لإرسال الشهادة للنموذج.';
        card.classList.add('pending');
    }

    if (retryBtn) {
        retryBtn.onclick = () => retryAiAnalysis(formData);
    }
}

function normalizeBase64(dataUrl) {
    if (!dataUrl) return '';
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

async function retryAiAnalysis(formData) {
    const storedForm = localStorage.getItem(userKey('academicFormData'));
    const parsedForm = storedForm ? JSON.parse(storedForm) : {};
    const certificateBase64 = parsedForm.certificateBase64 || localStorage.getItem(userKey('certificateBase64'));
    if (!certificateBase64) {
        showToast('لا يوجد ملف شهادة محفوظ. أعد الرفع من صفحة الاستبيان.', 'error');
        return;
    }

    try {
        const aiResult = await ApiClient.request('ai_suggest_major', {
            method: 'POST',
            body: {
                gat_score: parseFloat(formData.quduratScore) || 0,
                tahsili_score: parseFloat(formData.tahsiliScore) || 0,
                gpa: parseFloat(formData.gpa) || 0,
                certificate_base64: normalizeBase64(certificateBase64),
                subject_scores: []
            }
        });
        const recommendation = typeof aiResult === 'string'
            ? aiResult
            : (aiResult.major || aiResult.recommendation || aiResult.suggestion || null);
        if (recommendation) {
            localStorage.setItem(userKey('aiRecommendation'), recommendation);
            document.getElementById('aiRecommendationText').textContent = recommendation;
            document.getElementById('aiStatusNote').textContent = 'تم توليد التوصية اعتماداً على شهادتك ودرجاتك.';
            document.getElementById('aiRecommendationCard').classList.remove('pending');
            showToast('تم تحديث توصية الذكاء الاصطناعي', 'success');
        }
    } catch (err) {
        console.warn('AI retry failed', err);
        showToast('تعذر إرسال الشهادة حالياً', 'error');
    }
}

function displayStatistics(formData, compositeScore) {
    // Display Tahsili score
    const tahsiliScore = formData.tahsiliScore || 'لم يتم الاختبار';
    document.getElementById('accuracyRate').textContent = tahsiliScore;
    document.querySelector('#accuracyRate').parentElement.querySelector('p').textContent = 'درجة التحصيلي';
}

function displayRecommendations(recommendations, formData) {
    const container = document.querySelector('.recommendations-grid');
    container.innerHTML = '';
    
    if (recommendations.length === 0) {
        container.innerHTML = `
            <div class="no-recommendations">
                <h3>⚠️ لم يتم العثور على توصيات مطابقة</h3>
                <p>للأسف، لم نتمكن من إيجاد تخصصات تطابق معاييرك الحالية. يرجى مراجعة بياناتك أو التواصل مع المستشار الأكاديمي.</p>
            </div>
        `;
        return;
    }
    
    // Display top recommendations
    const topRecommendations = recommendations.slice(0, 6);
    
    topRecommendations.forEach((rec, index) => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        const icon = getIconForMajor(rec.major);
        const typeText = rec.type === 'government' ? 'حكومية' : 'خاصة';
        
        card.innerHTML = `
            <div class="recommendation-header">
                <div class="rec-icon">${icon}</div>
                <span class="match-badge">مطابقة ${rec.matchPercentage}%</span>
            </div>
            <h3>${rec.major}</h3>
            <p class="university-name">🏛️ ${rec.university}</p>
            <p class="university-city">📍 ${rec.city} • ${typeText}</p>
            <div class="rec-details">
                <div class="detail-item">
                    <span class="detail-label">الحد الأدنى:</span>
                    <span class="detail-value">${rec.minScore}%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">درجتك:</span>
                    <span class="detail-value ${parseFloat(rec.studentScore) >= rec.minScore ? 'success' : 'warning'}">${rec.studentScore}%</span>
                </div>
            </div>
            ${rec.hasInterest ? '<div class="interest-badge">✨ يتوافق مع اهتماماتك</div>' : ''}
        `;
        
        container.appendChild(card);
    });
}

function getIconForMajor(majorName) {
    const icons = {
        'الطب': '⚕️',
        'الهندسة': '🔧',
        'الحاسب': '💻',
        'إدارة': '💼',
        'الصيدلة': '💊',
        'القانون': '⚖️',
        'الشريعة': '📖',
        'التصميم': '🎨',
        'اللغات': '🌍',
        'العلوم': '🔬',
        'الاقتصاد': '📈',
        'التربية': '👨‍🏫'
    };
    
    for (let key in icons) {
        if (majorName.includes(key)) {
            return icons[key];
        }
    }
    
    return '🎓';
}

function displayAnalysis(formData, compositeScore, recommendations) {
    const analysisTitle = document.getElementById('performanceTitle');
    const analysisDescription = document.getElementById('performanceDescription');
    const strengthList = document.getElementById('strengthList');
    
    // Set title based on score
    if (compositeScore >= 90) {
        analysisTitle.textContent = 'أداء استثنائي! 🌟';
        analysisDescription.textContent = `معدلك التراكمي ${formData.gpa}% ودرجاتك في الاختبارات المعيارية تؤهلك للتنافس على أفضل التخصصات في أرقى الجامعات. لديك فرص ممتازة للقبول في التخصصات الطبية والهندسية المرموقة.`;
    } else if (compositeScore >= 80) {
        analysisTitle.textContent = 'أداء متميز! ⭐';
        analysisDescription.textContent = `معدلك التراكمي ${formData.gpa}% يفتح لك أبواب العديد من التخصصات المرموقة. لديك فرص جيدة جداً للقبول في معظم التخصصات التي تطمح إليها.`;
    } else if (compositeScore >= 70) {
        analysisTitle.textContent = 'أداء جيد جداً! 👍';
        analysisDescription.textContent = `معدلك التراكمي ${formData.gpa}% يؤهلك للقبول في مجموعة واسعة من التخصصات. ننصحك بالتركيز على التخصصات التي تتوافق مع اهتماماتك وقدراتك.`;
    } else {
        analysisTitle.textContent = 'أداء جيد! ✓';
        analysisDescription.textContent = `معدلك التراكمي ${formData.gpa}% يفتح لك فرصاً في العديد من التخصصات. ننصحك بالتركيز على تطوير مهاراتك في المجالات التي تهتم بها.`;
    }
    
    // Display strengths based on interests
    strengthList.innerHTML = '';
    const interests = formData.interests || [];
    const interestNames = {
        'medicine': 'العلوم الطبية والصحية',
        'engineering': 'الهندسة والتقنية',
        'computer': 'علوم الحاسب والبرمجة',
        'science': 'العلوم الطبيعية',
        'business': 'إدارة الأعمال والاقتصاد',
        'humanities': 'العلوم الإنسانية',
        'law': 'القانون والشريعة',
        'arts': 'الفنون والتصميم'
    };
    
    if (interests.length > 0) {
        interests.forEach(interest => {
            const li = document.createElement('li');
            li.textContent = interestNames[interest] || interest;
            strengthList.appendChild(li);
        });
    } else {
        strengthList.innerHTML = '<li>التفكير المنطقي والتحليلي</li><li>القدرة على التعلم</li><li>المثابرة والاجتهاد</li>';
    }
    
    // Display detailed results
    displayDetailedResults(recommendations);
}

function displayDetailedResults(recommendations) {
    const container = document.getElementById('questionsReview');
    container.innerHTML = '';
    
    if (recommendations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">لا توجد توصيات متاحة</p>';
        return;
    }
    
    const title = document.createElement('h3');
    title.textContent = 'جميع التخصصات المتاحة لك';
    title.style.cssText = 'color: #667eea; margin-bottom: 20px; font-size: 22px;';
    container.appendChild(title);
    
    const table = document.createElement('div');
    table.className = 'recommendations-table';
    table.style.cssText = 'overflow-x: auto;';
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden;">
            <thead>
                <tr style="background: linear-gradient(135deg, #667eea, #764ba2); color: white;">
                    <th style="padding: 15px; text-align: right;">#</th>
                    <th style="padding: 15px; text-align: right;">التخصص</th>
                    <th style="padding: 15px; text-align: right;">الجامعة</th>
                    <th style="padding: 15px; text-align: right;">المدينة</th>
                    <th style="padding: 15px; text-align: right;">النوع</th>
                    <th style="padding: 15px; text-align: right;">نسبة المطابقة</th>
                    <th style="padding: 15px; text-align: right;">الحد الأدنى</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    recommendations.forEach((rec, index) => {
        const typeText = rec.type === 'government' ? 'حكومية' : 'خاصة';
        const rowColor = index % 2 === 0 ? '#f8f8f8' : 'white';
        const matchColor = rec.matchPercentage >= 85 ? '#00C851' : rec.matchPercentage >= 70 ? '#33b5e5' : '#667eea';
        
        tableHTML += `
            <tr style="background: ${rowColor}; border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 15px; text-align: right;">${index + 1}</td>
                <td style="padding: 15px; text-align: right; font-weight: 600;">${rec.major}</td>
                <td style="padding: 15px; text-align: right;">${rec.university}</td>
                <td style="padding: 15px; text-align: right;">${rec.city}</td>
                <td style="padding: 15px; text-align: right;">${typeText}</td>
                <td style="padding: 15px; text-align: right;">
                    <span style="background: ${matchColor}; color: white; padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                        ${rec.matchPercentage}%
                    </span>
                </td>
                <td style="padding: 15px; text-align: right;">${rec.minScore}%</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    table.innerHTML = tableHTML;
    container.appendChild(table);
}

// Print functionality
window.print = function() {
    window.print();
};

console.log('EduPath KSA - Results Page Loaded Successfully ✅');
