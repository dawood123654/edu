// Form State
let currentStep = 1;
const totalSteps = 4;
let formData = {};
let quizStartTime = Date.now();
const quizId = 1;
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

// Initialize Form
window.addEventListener('load', async function() {
    const user = await ApiClient.ensureLoggedIn();
    if (!user) return;
    currentUserId = user.id || null;
    resetIfDifferentUser(user);
    quizStartTime = Date.now();
    initializeForm();
    setupEventListeners();
    setupConditionalFields();
});

function initializeForm() {
    updateProgress();
    loadSavedData();
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('prevBtn').addEventListener('click', previousStep);
    document.getElementById('exitBtn').addEventListener('click', showExitModal);
    
    // Modal events
    document.getElementById('cancelExit').addEventListener('click', hideExitModal);
    document.getElementById('confirmExit').addEventListener('click', exitForm);
    
    // Step indicator clicks
    document.querySelectorAll('.step-dot').forEach(dot => {
        dot.addEventListener('click', function() {
            const step = parseInt(this.dataset.step);
            if (step < currentStep || validateCurrentStep()) {
                goToStep(step);
            }
        });
    });

    // Auto-save on input change
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.addEventListener('change', autoSave);
    });

    setupCertificateUpload();
}

// Setup Conditional Fields
function setupConditionalFields() {
    // Qudurat test conditional
    document.querySelectorAll('input[name="hasQudurat"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const scoreGroup = document.getElementById('quduratScoreGroup');
            if (this.value === 'yes') {
                scoreGroup.style.display = 'block';
                document.getElementById('quduratScore').required = true;
            } else {
                scoreGroup.style.display = 'none';
                document.getElementById('quduratScore').required = false;
                document.getElementById('quduratScore').value = '';
            }
        });
    });
    
    // Tahsili test conditional
    document.querySelectorAll('input[name="hasTahsili"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const scoreGroup = document.getElementById('tahsiliScoreGroup');
            if (this.value === 'yes') {
                scoreGroup.style.display = 'block';
                document.getElementById('tahsiliScore').required = true;
            } else {
                scoreGroup.style.display = 'none';
                document.getElementById('tahsiliScore').required = false;
                document.getElementById('tahsiliScore').value = '';
            }
        });
    });
    
    // Other tests conditional
    document.querySelectorAll('input[name="hasOtherTests"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const testsGroup = document.getElementById('otherTestsGroup');
            if (this.value === 'yes') {
                testsGroup.style.display = 'block';
            } else {
                testsGroup.style.display = 'none';
                document.getElementById('otherTests').value = '';
            }
        });
    });

    // Interest followups
    const interestCheckboxes = document.querySelectorAll('input[name="interests"]');
    interestCheckboxes.forEach(cb => {
        cb.addEventListener('change', toggleFollowups);
    });
    toggleFollowups();
}

// Certificate Upload
function setupCertificateUpload() {
    const uploadBox = document.getElementById('certificateUpload');
    const fileInput = document.getElementById('certificateFile');
    if (!uploadBox || !fileInput) return;

    const handleDrop = (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragging');
        if (e.dataTransfer?.files?.length) {
            handleCertificateFile(e.dataTransfer.files[0]);
        }
    };

    uploadBox.addEventListener('click', () => fileInput.click());
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragging');
    });
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragging'));
    uploadBox.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleCertificateFile(file);
    });
}

async function handleCertificateFile(file) {
    const uploadBox = document.getElementById('certificateUpload');
    const fileNameEl = document.getElementById('certificateFileName');
    if (!file || !uploadBox || !fileNameEl) return;

    const maxSize = 3 * 1024 * 1024; // 3 MB
    if (!file.type.startsWith('image/')) {
        showToast('الرجاء رفع صورة للشهادة (JPG أو PNG)', 'error');
        return;
    }
    if (file.size > maxSize) {
        showToast('حجم الملف كبير. الحد الأقصى 3 ميغابايت', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const result = evt.target?.result?.toString() || '';
        formData.certificateBase64 = result;
        formData.certificateFileName = file.name;
        fileNameEl.textContent = file.name;
        localStorage.setItem(userKey('certificateBase64'), result);
        localStorage.setItem(userKey('certificateFileName'), file.name);
        uploadBox.classList.remove('error');
        autoSave();
    };
    reader.onerror = function() {
        showToast('تعذر قراءة الملف، جرّب ملفاً آخر', 'error');
    };
    reader.readAsDataURL(file);
}

// Validate Current Step
function validateCurrentStep() {
    const currentStepElement = document.getElementById(`step${currentStep}`);
    const requiredFields = currentStepElement.querySelectorAll('[required]');
    
    let isValid = true;
    let firstInvalidField = null;
    
    requiredFields.forEach(field => {
        // Skip hidden fields
        if (field.offsetParent === null) {
            return;
        }
        
        if (field.type === 'radio') {
            const radioGroup = currentStepElement.querySelectorAll(`input[name="${field.name}"]`);
            const isChecked = Array.from(radioGroup).some(radio => radio.checked);
            if (!isChecked) {
                isValid = false;
                if (!firstInvalidField) firstInvalidField = field;
            }
        } else if (field.type === 'checkbox') {
            const checkboxGroup = currentStepElement.querySelectorAll(`input[name="${field.name}"]`);
            const isChecked = Array.from(checkboxGroup).some(checkbox => checkbox.checked);
            if (!isChecked && field.required) {
                isValid = false;
                if (!firstInvalidField) firstInvalidField = field;
            }
        } else {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error');
                if (!firstInvalidField) firstInvalidField = field;
            } else {
                field.classList.remove('error');
            }
        }
    });
    
    // Special validation for step 3 (at least one interest must be selected)
    if (currentStep === 3) {
    const interests = document.querySelectorAll('input[name="interests"]:checked');
    if (interests.length === 0) {
        alert('الرجاء اختيار مجال واحد على الأقل من اهتماماتك');
        isValid = false;
    }
    }

    // Certificate required on step 2
    if (currentStep === 2 && !formData.certificateBase64) {
        const uploadBox = document.getElementById('certificateUpload');
        if (uploadBox) uploadBox.classList.add('error');
        showToast('الرجاء رفع صورة شهادة الثانوية لإكمال الاستبيان', 'error');
        isValid = false;
    }
    
    if (!isValid && firstInvalidField) {
        firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (currentStep === 3 && firstInvalidField.type !== 'checkbox') {
            alert('الرجاء إكمال جميع الحقول المطلوبة');
        } else if (firstInvalidField.type !== 'checkbox') {
            alert('الرجاء إكمال جميع الحقول المطلوبة');
        }
    }
    
    return isValid;
}

// Navigation Functions
async function nextStep() {
    if (currentStep < totalSteps) {
        if (validateCurrentStep()) {
            saveCurrentStepData();
            currentStep++;
            updateStepDisplay();
            updateProgress();
        }
    } else {
        // Last step - submit form
        if (validateCurrentStep()) {
            saveCurrentStepData();
            await submitForm();
        }
    }
}

function previousStep() {
    if (currentStep > 1) {
        saveCurrentStepData();
        currentStep--;
        updateStepDisplay();
        updateProgress();
    }
}

function goToStep(step) {
    if (step >= 1 && step <= totalSteps) {
        saveCurrentStepData();
        currentStep = step;
        updateStepDisplay();
        updateProgress();
    }
}

// Update Step Display
function updateStepDisplay() {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    document.getElementById(`step${currentStep}`).classList.add('active');
    
    // Update step indicators
    document.querySelectorAll('.step-dot').forEach(dot => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        
        if (step === currentStep) {
            dot.classList.add('active');
        } else if (step < currentStep) {
            dot.classList.add('completed');
        }
    });
    
    // Update navigation buttons
    document.getElementById('prevBtn').disabled = currentStep === 1;
    
    const nextBtn = document.getElementById('nextBtn');
    if (currentStep === totalSteps) {
        nextBtn.textContent = 'إرسال وعرض النتائج →';
        nextBtn.classList.add('btn-success');
    } else {
        nextBtn.textContent = 'التالي →';
        nextBtn.classList.remove('btn-success');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Progress
function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('stepCounter').textContent = `الخطوة ${currentStep} من ${totalSteps}`;
    document.getElementById('progressPercentage').textContent = Math.round(progress) + '%';
}

// Save Current Step Data
function saveCurrentStepData() {
    const currentStepElement = document.getElementById(`step${currentStep}`);
    
    // Save all inputs, selects, and textareas
    currentStepElement.querySelectorAll('input, select, textarea').forEach(field => {
        if (field.type === 'radio') {
            if (field.checked) {
                formData[field.name] = field.value;
            }
        } else if (field.type === 'checkbox') {
            if (!formData[field.name]) {
                formData[field.name] = [];
            }
            if (field.checked && !formData[field.name].includes(field.value)) {
                formData[field.name].push(field.value);
            } else if (!field.checked) {
                formData[field.name] = formData[field.name].filter(v => v !== field.value);
            }
        } else {
            formData[field.id] = field.value;
        }
    });
    
    // Save to localStorage
    localStorage.setItem(userKey('academicFormData'), JSON.stringify(formData));
}

// Auto Save
function autoSave() {
    saveCurrentStepData();
}

// Load Saved Data
function loadSavedData() {
    const savedData = localStorage.getItem(userKey('academicFormData'));
    if (savedData) {
        formData = JSON.parse(savedData);
        
        // Restore form values
        Object.keys(formData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    // Handle radio and checkbox separately
                } else {
                    element.value = formData[key];
                }
            }
        });
        
        // Restore radio buttons
        Object.keys(formData).forEach(key => {
            const radios = document.querySelectorAll(`input[name="${key}"]`);
            radios.forEach(radio => {
                if (radio.value === formData[key]) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // Restore checkboxes
        Object.keys(formData).forEach(key => {
            if (Array.isArray(formData[key])) {
                const checkboxes = document.querySelectorAll(`input[name="${key}"]`);
                checkboxes.forEach(checkbox => {
                    if (formData[key].includes(checkbox.value)) {
                        checkbox.checked = true;
                    }
                });
            }
        });

        // Restore certificate label if exists
        if (formData.certificateFileName) {
            const fileNameEl = document.getElementById('certificateFileName');
            if (fileNameEl) fileNameEl.textContent = formData.certificateFileName;
        }
    }

    toggleFollowups();
}

// Submit Form
async function submitForm() {
    // Calculate weighted score for matching
    const gpa = parseFloat(formData.gpa) || 0;
    const quduratScore = parseFloat(formData.quduratScore) || 0;
    const tahsiliScore = parseFloat(formData.tahsiliScore) || 0;
    
    // Calculate composite score (weighted average)
    let compositeScore = 0;
    if (formData.track === 'science' || formData.track === 'computer') {
        // For science tracks: 30% GPA, 30% Qudurat, 40% Tahsili
        compositeScore = (gpa * 0.3) + (quduratScore * 0.3) + (tahsiliScore * 0.4);
    } else {
        // For other tracks: 40% GPA, 40% Qudurat, 20% Tahsili
        compositeScore = (gpa * 0.4) + (quduratScore * 0.4) + (tahsiliScore * 0.2);
    }
    
    // Get interests
    const interests = formData.interests || [];
    
    // Match universities and majors
    const recommendations = matchUniversitiesAndMajors(compositeScore, gpa, interests, formData.track);
    
    // Save results locally (without heavy certificate content)
    const results = {
        formData: { ...formData },
        compositeScore: compositeScore.toFixed(2),
        recommendations: recommendations,
        date: new Date().toISOString()
    };
    delete results.formData.certificateBase64;
    
    localStorage.setItem(userKey('academicResults'), JSON.stringify(results));

    // Send certificate to AI for reading
    const aiRecommendation = await sendCertificateToAi({ gpa, quduratScore, tahsiliScore });
    if (aiRecommendation) {
        results.aiRecommendation = aiRecommendation;
        localStorage.setItem('academicResults', JSON.stringify(results));
    }

    try {
        const durationSeconds = Math.round((Date.now() - quizStartTime) / 1000);
        const answersToSave = { ...formData };
        delete answersToSave.certificateBase64;
        delete answersToSave.certificateFileName;
        const saved = await ApiClient.request('save_attempt', {
            method: 'POST',
            body: {
                quiz_id: quizId,
                composite_score: parseFloat(results.compositeScore),
                duration_seconds: durationSeconds,
                answers: answersToSave
            }
        });
        if (saved.attempt_id) {
            localStorage.setItem('latestAttemptId', saved.attempt_id);
        }
    } catch (err) {
        console.warn('Unable to save attempt to server', err);
        showToast('تم حفظ إجاباتك محلياً، تعذر الاتصال بالخادم', 'error');
    }
    
    // Redirect to results page
    window.location.href = 'results.html';
}

function normalizeBase64(dataUrl) {
    if (!dataUrl) return '';
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function toggleFollowups() {
    const interests = Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value);
    const csBlock = document.getElementById('csFollowup');
    const medBlock = document.getElementById('medFollowup');
    const engBlock = document.getElementById('engFollowup');
    const bizBlock = document.getElementById('bizFollowup');
    const lawBlock = document.getElementById('lawFollowup');
    const artsBlock = document.getElementById('artsFollowup');
    if (csBlock) csBlock.style.display = interests.includes('computer') ? 'block' : 'none';
    if (medBlock) medBlock.style.display = (interests.includes('medicine') || interests.includes('dentistry')) ? 'block' : 'none';
    if (engBlock) engBlock.style.display = interests.includes('engineering') ? 'block' : 'none';
    if (bizBlock) bizBlock.style.display = interests.includes('business') ? 'block' : 'none';
    if (lawBlock) lawBlock.style.display = (interests.includes('law') || interests.includes('humanities') || interests.includes('sharia')) ? 'block' : 'none';
    if (artsBlock) artsBlock.style.display = interests.includes('arts') ? 'block' : 'none';
}

async function sendCertificateToAi({ gpa, quduratScore, tahsiliScore }) {
    if (!formData.certificateBase64) return null;
    const certificateBase64 = normalizeBase64(formData.certificateBase64);
    if (!certificateBase64) return null;

    try {
        showToast('جاري قراءة الشهادة بالذكاء الاصطناعي...', 'info');
        const aiResult = await ApiClient.request('ai_suggest_major', {
            method: 'POST',
            body: {
                gat_score: quduratScore,
                tahsili_score: tahsiliScore,
                gpa: gpa,
                certificate_base64: certificateBase64,
                subject_scores: []
            }
        });
        const recommendation = typeof aiResult === 'string'
            ? aiResult
            : (aiResult.major || aiResult.recommendation || aiResult.suggestion || null);
        if (recommendation) {
            localStorage.setItem(userKey('aiRecommendation'), recommendation);
        }
        return recommendation;
    } catch (err) {
        console.warn('AI analysis failed', err);
        showToast('تعذر تحليل الشهادة بالذكاء الاصطناعي حالياً', 'error');
        return null;
    }
}

// Match Universities and Majors
function matchUniversitiesAndMajors(compositeScore, gpa, interests, track) {
    const recommendations = [];
    
    // Define university requirements and majors
    const universities = [
        {
            name: 'جامعة الملك سعود',
            city: 'الرياض',
            type: 'government',
            minScore: 85,
            majors: [
                { name: 'الطب البشري', minScore: 95, interests: ['medicine'], track: ['science'] },
                { name: 'الهندسة الكهربائية', minScore: 88, interests: ['engineering'], track: ['science', 'computer'] },
                { name: 'علوم الحاسب', minScore: 85, interests: ['computer'], track: ['science', 'computer'] },
                { name: 'إدارة الأعمال', minScore: 80, interests: ['business'], track: ['admin', 'science', 'humanities'] },
                { name: 'الصيدلة', minScore: 92, interests: ['medicine'], track: ['science'] }
            ]
        },
        {
            name: 'جامعة الملك عبدالعزيز',
            city: 'جدة',
            type: 'government',
            minScore: 83,
            majors: [
                { name: 'الطب البشري', minScore: 94, interests: ['medicine'], track: ['science'] },
                { name: 'الهندسة الميكانيكية', minScore: 86, interests: ['engineering'], track: ['science', 'computer'] },
                { name: 'تقنية المعلومات', minScore: 82, interests: ['computer'], track: ['science', 'computer'] },
                { name: 'الاقتصاد', minScore: 78, interests: ['business'], track: ['admin', 'science', 'humanities'] },
                { name: 'العلوم', minScore: 80, interests: ['science'], track: ['science'] }
            ]
        },
        {
            name: 'جامعة الملك فهد للبترول والمعادن',
            city: 'الظهران',
            type: 'government',
            minScore: 90,
            majors: [
                { name: 'هندسة البترول', minScore: 92, interests: ['engineering'], track: ['science'] },
                { name: 'هندسة الحاسب', minScore: 90, interests: ['computer', 'engineering'], track: ['science', 'computer'] },
                { name: 'الهندسة الكيميائية', minScore: 90, interests: ['engineering', 'science'], track: ['science'] },
                { name: 'علوم الحاسب', minScore: 88, interests: ['computer'], track: ['science', 'computer'] }
            ]
        },
        {
            name: 'جامعة الأميرة نورة',
            city: 'الرياض',
            type: 'government',
            minScore: 82,
            majors: [
                { name: 'الطب البشري', minScore: 93, interests: ['medicine'], track: ['science'] },
                { name: 'علوم الحاسب', minScore: 84, interests: ['computer'], track: ['science', 'computer'] },
                { name: 'التصميم الداخلي', minScore: 78, interests: ['arts'], track: ['science', 'humanities', 'admin'] },
                { name: 'اللغات والترجمة', minScore: 80, interests: ['humanities'], track: ['humanities', 'admin'] }
            ]
        },
        {
            name: 'جامعة الإمام محمد بن سعود',
            city: 'الرياض',
            type: 'government',
            minScore: 80,
            majors: [
                { name: 'الشريعة', minScore: 82, interests: ['law'], track: ['sharia', 'humanities'] },
                { name: 'أصول الدين', minScore: 80, interests: ['law'], track: ['sharia', 'humanities'] },
                { name: 'اللغة العربية', minScore: 78, interests: ['humanities'], track: ['humanities', 'sharia'] },
                { name: 'علوم الحاسب', minScore: 83, interests: ['computer'], track: ['science', 'computer'] }
            ]
        },
        {
            name: 'جامعة الأمير سلطان',
            city: 'الرياض',
            type: 'private',
            minScore: 78,
            majors: [
                { name: 'هندسة البرمجيات', minScore: 82, interests: ['computer', 'engineering'], track: ['science', 'computer'] },
                { name: 'إدارة الأعمال', minScore: 78, interests: ['business'], track: ['admin', 'science', 'humanities'] },
                { name: 'الهندسة الصناعية', minScore: 80, interests: ['engineering'], track: ['science', 'computer'] },
                { name: 'الأمن السيبراني', minScore: 83, interests: ['computer'], track: ['science', 'computer'] }
            ]
        },
        {
            name: 'جامعة الفيصل',
            city: 'الرياض',
            type: 'private',
            minScore: 80,
            majors: [
                { name: 'الطب البشري', minScore: 90, interests: ['medicine'], track: ['science'] },
                { name: 'الصيدلة', minScore: 88, interests: ['medicine'], track: ['science'] },
                { name: 'الهندسة', minScore: 82, interests: ['engineering'], track: ['science', 'computer'] },
                { name: 'إدارة الأعمال', minScore: 80, interests: ['business'], track: ['admin', 'science', 'humanities'] }
            ]
        },
        {
            name: 'جامعة الملك خالد',
            city: 'أبها',
            type: 'government',
            minScore: 78,
            majors: [
                { name: 'الطب البشري', minScore: 90, interests: ['medicine'], track: ['science'] },
                { name: 'الهندسة', minScore: 82, interests: ['engineering'], track: ['science', 'computer'] },
                { name: 'علوم الحاسب', minScore: 80, interests: ['computer'], track: ['science', 'computer'] },
                { name: 'التربية', minScore: 75, interests: ['humanities'], track: ['humanities', 'science', 'admin'] }
            ]
        }
    ];
    
    // Filter and match
    universities.forEach(university => {
        university.majors.forEach(major => {
            // Check if student meets requirements
            const meetsScore = compositeScore >= major.minScore;
            const meetsTrack = major.track.includes(track);
            const hasInterest = interests.some(interest => major.interests.includes(interest));
            const specializationBoost = getSpecializationBoost(major.name, formData);

            if (meetsScore && meetsTrack) {
                const matchPercentage = calculateMatchPercentage(compositeScore, major.minScore, hasInterest, specializationBoost);

                recommendations.push({
                    university: university.name,
                    city: university.city,
                    type: university.type,
                    major: major.name,
                    matchPercentage: matchPercentage,
                    minScore: major.minScore,
                    studentScore: compositeScore.toFixed(2),
                    hasInterest: hasInterest
                });
            }
        });
    });
    
    // Sort by match percentage
    recommendations.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    // Return top 10 recommendations
    return recommendations.slice(0, 10);
}

// Calculate Match Percentage
function calculateMatchPercentage(studentScore, minScore, hasInterest, specializationBoost = 0) {
    // Base match on how much student exceeds minimum
    const scoreMatch = Math.min(100, ((studentScore - minScore) / minScore) * 100 + 70);
    
    // Boost if student has interest
    const interestBoost = hasInterest ? 15 : 0;
    
    // Add specialization boost from follow-up answers
    const total = scoreMatch + interestBoost + specializationBoost;
    
    // Calculate final match (max 100%)
    return Math.min(100, Math.round(total));
}

function getSpecializationBoost(majorName, formData) {
    let boost = 0;
    const name = majorName || '';

    const isComputer = name.includes('حاسب') || name.toLowerCase().includes('computer');
    const isMedicine = name.includes('طب') || name.includes('أسنان') || name.toLowerCase().includes('dent');
    const isEngineering = name.includes('هندسة') || name.toLowerCase().includes('engineer');
    const isBusiness = name.includes('إدارة') || name.includes('اقتصاد') || name.toLowerCase().includes('business');
    const isLaw = name.includes('قانون') || name.includes('شريعة') || name.toLowerCase().includes('law');
    const isArts = name.includes('تصميم') || name.includes('فنون') || name.toLowerCase().includes('design');

    if (isComputer) {
        if (formData.csProblemSolving === 'high') boost += 6;
        else if (formData.csProblemSolving === 'medium') boost += 3;
        if (formData.csProjects === 'yes') boost += 4;
        if (formData.csMathComfort === 'high') boost += 3;
        else if (formData.csMathComfort === 'medium') boost += 1;
    }

    if (isMedicine) {
        if (formData.medPatientComfort === 'high') boost += 5;
        else if (formData.medPatientComfort === 'medium') boost += 2;
        if (formData.medBioInterest === 'high') boost += 4;
        else if (formData.medBioInterest === 'medium') boost += 2;
        if (formData.medStudyStamina === 'high') boost += 4;
        else if (formData.medStudyStamina === 'medium') boost += 2;
    }

    if (isEngineering) {
        if (formData.engHandsOn === 'high') boost += 5;
        else if (formData.engHandsOn === 'medium') boost += 2;
        if (formData.engMathPhysics === 'high') boost += 4;
        else if (formData.engMathPhysics === 'medium') boost += 2;
        if (formData.engTeamwork === 'high') boost += 2;
        else if (formData.engTeamwork === 'medium') boost += 1;
    }

    if (isBusiness) {
        if (formData.busLeadership === 'high') boost += 4;
        else if (formData.busLeadership === 'medium') boost += 2;
        if (formData.busFinanceInterest === 'high') boost += 4;
        else if (formData.busFinanceInterest === 'medium') boost += 2;
        if (formData.busEntrepreneur === 'high') boost += 3;
        else if (formData.busEntrepreneur === 'medium') boost += 1;
    }

    if (isLaw) {
        if (formData.lawReading === 'high') boost += 4;
        else if (formData.lawReading === 'medium') boost += 2;
        if (formData.lawDebate === 'high') boost += 3;
        else if (formData.lawDebate === 'medium') boost += 1;
        if (formData.lawEthics === 'high') boost += 3;
        else if (formData.lawEthics === 'medium') boost += 1;
    }

    if (isArts) {
        if (formData.artsCreativity === 'high') boost += 5;
        else if (formData.artsCreativity === 'medium') boost += 3;
        if (formData.artsPortfolio === 'yes') boost += 3;
    }

    return boost;
}

// Modal Functions
function showExitModal() {
    document.getElementById('exitModal').classList.add('active');
}

function hideExitModal() {
    document.getElementById('exitModal').classList.remove('active');
}

function exitForm() {
    saveCurrentStepData();
    window.location.href = 'dashboard.html';
}

// Prevent accidental page refresh
window.addEventListener('beforeunload', function(e) {
    if (currentStep > 1) {
        e.preventDefault();
        e.returnValue = '';
        return 'هل أنت متأكد من مغادرة الصفحة؟ سيتم حفظ بياناتك.';
    }
});

console.log('EduPath KSA - Academic Survey Loaded Successfully ✅');
