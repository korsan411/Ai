// نظام إدارة الثيمات
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark'; // القيمة الافتراضية
        this.init();
    }

    init() {
        // استرجاع الثيم من localStorage
        const savedTheme = localStorage.getItem('cncai-theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
        }
        
        this.applyTheme();
        this.setupEventListeners();
        
        console.log('Theme Manager initialized with theme:', this.currentTheme);
    }

    setupEventListeners() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveTheme();
        
        console.log('Theme changed to:', this.currentTheme);
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        
        // تحديث أيقونة الثيم
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = this.currentTheme === 'dark' ? '🌙' : '☀️';
        }
    }

    saveTheme() {
        localStorage.setItem('cncai-theme', this.currentTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// تهيئة نظام الثيمات
window.themeManager = new ThemeManager();