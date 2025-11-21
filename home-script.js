// Language Toggle
let currentLang = 'ar';

document.getElementById('langBtn').addEventListener('click', function() {
    if (currentLang === 'ar') {
        currentLang = 'en';
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('dir', 'ltr');
        this.textContent = 'AR';
        
        // Change text to English
        document.querySelector('.hero h1').textContent = 'Welcome to EduPath KSA';
        document.querySelector('.hero p').textContent = 'Your smart platform to discover the ideal educational path in Saudi Arabia. We help you make the right decision for your academic and professional future.';
        
    } else {
        currentLang = 'ar';
        document.documentElement.setAttribute('lang', 'ar');
        document.documentElement.setAttribute('dir', 'rtl');
        this.textContent = 'EN';
        
        // Change text to Arabic
        document.querySelector('.hero h1').textContent = 'مرحباً بك في EduPath KSA';
        document.querySelector('.hero p').textContent = 'منصتك الذكية لاكتشاف المسار التعليمي المثالي في المملكة العربية السعودية. نساعدك على اتخاذ القرار الصحيح لمستقبلك الأكاديمي والمهني.';
    }
});

// Smooth scroll animation for feature cards
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, {
    threshold: 0.1
});

document.querySelectorAll('.feature-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `all 0.6s ease ${index * 0.1}s`;
    observer.observe(card);
});

// Animate stats on scroll
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumber = entry.target.querySelector('.stat-number');
            const finalNumber = statNumber.textContent;
            animateNumber(statNumber, finalNumber);
        }
    });
}, {
    threshold: 0.5
});

document.querySelectorAll('.stat-card').forEach(card => {
    statsObserver.observe(card);
});

function animateNumber(element, target) {
    const hasPlus = target.includes('+');
    const hasPercent = target.includes('%');
    const numericValue = parseInt(target.replace(/[^0-9]/g, ''));
    
    let current = 0;
    const increment = numericValue / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
            current = numericValue;
            clearInterval(timer);
        }
        
        let displayValue = Math.floor(current);
        if (displayValue >= 1000) {
            displayValue = Math.floor(displayValue / 1000) + 'K';
        }
        
        if (hasPlus) displayValue += '+';
        if (hasPercent) displayValue += '%';
        
        element.textContent = displayValue;
    }, 30);
}

console.log('EduPath KSA - Home Page Loaded Successfully ✅');