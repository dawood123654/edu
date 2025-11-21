// Form State
let currentStep = 1;
const totalSteps = 4;
let formData = {};
let quizStartTime = Date.now();
const quizId = 1;

// Initialize Form
window.addEventListener('load', async function() {
    const user = await ApiClient.ensureLoggedIn();
    if (!user) return;
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
    localStorage.setItem('academicFormData', JSON.stringify(formData));
}

// Auto Save
function autoSave() {
    saveCurrentStepData();
}

// Load Saved Data
function loadSavedData() {
    const savedData = localStorage.getItem('academicFormData');
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
    }
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
    
    // Save results
    const results = {
        formData: formData,
        compositeScore: compositeScore.toFixed(2),
        recommendations: recommendations,
        date: new Date().toISOString()
    };
    
    localStorage.setItem('academicResults', JSON.stringify(results));
    
    try {
        const durationSeconds = Math.round((Date.now() - quizStartTime) / 1000);
        const saved = await ApiClient.request('save_attempt', {
            method: 'POST',
            body: {
                quiz_id: quizId,
                composite_score: parseFloat(results.compositeScore),
                duration_seconds: durationSeconds,
                answers: formData
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
            
            if (meetsScore && meetsTrack) {
                const matchPercentage = calculateMatchPercentage(compositeScore, major.minScore, hasInterest);
                
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
function calculateMatchPercentage(studentScore, minScore, hasInterest) {
    // Base match on how much student exceeds minimum
    const scoreMatch = Math.min(100, ((studentScore - minScore) / minScore) * 100 + 70);
    
    // Boost if student has interest
    const interestBoost = hasInterest ? 15 : 0;
    
    // Calculate final match (max 100%)
    return Math.min(100, Math.round(scoreMatch + interestBoost));
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
