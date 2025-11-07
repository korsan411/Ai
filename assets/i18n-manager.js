// نظام الترجمة متعدد اللغات
class I18nManager {
    constructor() {
        this.currentLang = 'ar'; // اللغة الافتراضية
        this.translations = {};
        this.init();
    }

    async init() {
        // استرجاع اللغة من localStorage
        const savedLang = localStorage.getItem('cncai-language');
        if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
            this.currentLang = savedLang;
        }
        
        // تطبيق اللغة فوراً
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = this.currentLang;
        
        await this.loadTranslations();
        this.applyLanguage();
        this.setupEventListeners();
        
        console.log('I18n Manager initialized with language:', this.currentLang);
    }

    async loadTranslations() {
        try {
            // استخدام مسار مطلق للتأكد من تحميل الملفات
            const basePath = window.location.pathname.includes('/') 
                ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)
                : './';
            
            const response = await fetch(`${basePath}locales/${this.currentLang}.json`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.translations = await response.json();
            console.log(`Translations loaded successfully for: ${this.currentLang}`, this.translations);
            
        } catch (error) {
            console.warn('Failed to load translation file, using comprehensive defaults:', error);
            this.translations = this.getComprehensiveDefaultTranslations();
        }
    }

    getComprehensiveDefaultTranslations() {
        // ترجمة افتراضية شاملة لجميع المفاتيح
        const defaults = this.currentLang === 'ar' ? {
            'appTitle': 'CNC AI — CNC Router & Laser Engraving & 3D Printing',
            'version': 'CncAi — النسخة المستقرة 2.6.0',
            'loadingOpencv': 'جاري تحميل OpenCV...',
            'selectImage': '📁 اختر صورة',
            'edgeMode': 'نمط الحواف:',
            'cannyNormal': 'Canny (عادي)',
            'sobelPrecise': 'Sobel (دقيق)',
            'laplacianSmooth': 'Laplacian (ناعم)',
            'stlSvgDxf': 'تحميل ملفات STL و SVG و DXF',
            'stlDesc': 'نموذج ثلاثي الأبعاد',
            'svgDesc': 'رسوم متجهة',
            'dxfDesc': 'رسم CAD',
            'fileFormatsDesc': 'يمكن تحميل ملفات STL للطباعة ثلاثية الأبعاد، وملفات SVG/DXF للتحويل إلى G-code',
            'colormapOptions': 'خيارات تدرج الألوان',
            'colormapDesc': 'التغيير يطبق على: Heatmap • Top View • Contours • كل المعاينات',
            'edgeSensitivity': 'حساسية الحواف:',
            'original': 'الأصلية',
            'heatmap': 'Heatmap',
            'contours': 'Contours',
            'topView': 'Top View',
            '3dModels': '3D Models',
            'simulation': 'المحاكاة',
            'analysis': 'التحليل',
            'originalPlaceholder': 'الصورة الأصلية ستظهر هنا',
            'heatmapPlaceholder': 'Heatmap ستظهر هنا',
            'contourPlaceholder': 'Contours ستظهر هنا',
            'contourDesc': 'تبديل وضع كشف الحواف أو تحريك حساسية الحواف يحدث إعادة معالجة تلقائية',
            'topViewDesc': 'معاينة من الأعلى للعمق المتوقع بعد تنفيذ G-code (الألوان تتبع اختيار Colormap)',
            'threedPlaceholder': 'الموديل ثلاثي الأبعاد سيظهر هنا',
            'simulationPlaceholder': 'المحاكاة ستظهر هنا بعد توليد G-code',
            'edges': 'الحواف',
            'contrast': 'التباين',
            'density': 'الكثافة',
            'height': 'الارتفاع',
            'loadImageManually': 'تحميل صورة يدوياً',
            'analysisResults': 'نتائج التحليل',
            'edgeCount': 'عدد الحواف:',
            'contrastRatio': 'نسبة التباين:',
            'detailDensity': 'كثافة التفاصيل:',
            'textureValue': 'قيمة الملمس:',
            'dominantOrientation': 'الاتجاه السائد:',
            'imageSharpness': 'حدة الصورة:',
            'recommendation': 'التوصية:',
            'fullAnalysis': 'تحليل كامل',
            'exportResults': 'تصدير النتائج',
            'image': 'صورة',
            'report': 'تقرير',
            'processing': 'جاري المعالجة...',
            'machineSettings': 'إعدادات الماكينة',
            'advancedMachineSettings': '⚙️ الإعدادات المتقدمة للماكينة',
            'originX': 'النقطة X',
            'originY': 'النقطة Y',
            'originZ': 'النقطة Z',
            'calibX': 'معايرة X',
            'calibY': 'معايرة Y',
            'reverseX': 'عكس X',
            'reverseY': 'عكس Y',
            'execution': 'التنفيذ',
            'delayMs': 'التأخير (مللي ثانية)',
            'resetDefaults': 'إرجاع الإعدادات الافتراضية',
            'save': 'حفظ',
            'machineType': 'نوع الماكينة الرئيسي',
            'cncRouter': 'CNC Router (نحت خشب)',
            'laserEngraver': 'Laser Engraver (نقش ليزر)',
            '3dPrinter': '3D Printer (طباعة ثلاثية الأبعاد)',
            'cncRouterSettings': 'إعدادات CNC Router',
            'workWidth': 'عرض العمل (سم)',
            'workHeight': 'ارتفاع العمل (سم)',
            'workDepth': 'عمق العمل (مم)',
            'centerOrigin': '🎯 توسيط نقطة الأصل',
            'feedRate': 'سرعة التغذية (مم/دقيقة)',
            'safeZ': 'ارتفاع الأمان (مم)',
            'scanDirection': 'اتجاه المسارات (Raster)',
            'horizontal': 'أفقي (X)',
            'vertical': 'رأسي (Y)',
            'stepOver': 'خطوة المسح (مم)',
            'maxDepth': 'أقصى عمق (مم)',
            'useFixedZ': 'استخدام Z ثابت',
            'invertZ': 'عكس Z',
            'woodColor': 'لون الخشب:',
            'lightWood': 'خشب فاتح',
            'mediumWood': 'خشب متوسط',
            'beige': 'بيج',
            'mahogany': 'ماهوجني',
            'generateCombo': '🧠 توليد Combo (Contour + Raster)',
            'generateGcode': '⚡ توليد G-code (Raster)',
            'quickTest': '🧪 اختبار سريع',
            'edgeRange': 'نطاق الحواف (Contour)',
            'outerOnly': 'الخارجية فقط',
            'allEdges': 'كل الحواف',
            'generateGcodeContour': '🌀 توليد G-code (Contour)',
            'downloadGcode': '💾 تحميل G-code',
            'laserEngraverSettings': 'إعدادات Laser Engraver',
            'laserEdgeMode': 'نمط كشف الحواف للليزر',
            'adaptiveDesc': 'Adaptive Threshold - ممتاز للصور ذات الإضاءة غير المتجانسة',
            'laserDetail': 'دقة الليزر:',
            'redetectEdges': '🔄 إعادة كشف حواف الليزر',
            'laserPower': 'قوة الليزر:',
            'laserMode': 'وضع الليزر',
            'engrave': 'نقش (Grayscale)',
            'cut': 'قص (Contour)',
            'combine': 'نقش + قص',
            'laserSpeed': 'سرعة الليزر (مم/دقيقة)',
            'laserPasses': 'عدد المرات',
            'dynamicPower': 'قوة ديناميكية (حسب الظلام)',
            'airAssist': 'Air Assist',
            'generateLaserCode': '⚡ توليد كود ليزر (نقش)',
            'quickEngrave': '🧪 نقش سريع',
            'generateLaserCut': '✂️ توليد كود ليزر (قص)',
            'downloadLaserCode': '💾 تحميل كود الليزر',
            'threedSettings': 'إعدادات النماذج ثلاثية الأبعاد',
            'load3dFile': 'تحميل ملف 3D (STL, OBJ, etc.)',
            'layerHeight': 'ارتفاع الطبقة (مم)',
            'fillDensity': 'كثافة الحشو (%)',
            'printSpeed': 'سرعة الطباعة (مم/ث)',
            'infillPattern': 'نمط الحشو',
            'support': 'دعم (Support)',
            'raft': 'رافدة (Raft)',
            'generate3dGcode': '⚡ توليد G-code (3D)',
            'previewLayers': '👁️ معاينة الطبقات',
            'download3dGcode': '💾 تحميل G-code 3D',
            'gcodeOutput': 'مخرجات G-code',
            'lang': 'AR'
        } : {
            // English defaults
            'appTitle': 'CNC AI — CNC Router & Laser Engraving & 3D Printing',
            'version': 'CncAi — Stable Version 2.6.0',
            'loadingOpencv': 'Loading OpenCV...',
            'selectImage': '📁 Select Image',
            'edgeMode': 'Edge Mode:',
            'cannyNormal': 'Canny (Normal)',
            'sobelPrecise': 'Sobel (Precise)',
            'laplacianSmooth': 'Laplacian (Smooth)',
            'stlSvgDxf': 'Load STL, SVG & DXF Files',
            'stlDesc': '3D Model',
            'svgDesc': 'Vector Graphics',
            'dxfDesc': 'CAD Drawing',
            'fileFormatsDesc': 'STL files for 3D printing, SVG/DXF files for G-code conversion',
            'colormapOptions': 'Colormap Options',
            'colormapDesc': 'Changes apply to: Heatmap • Top View • Contours • All Previews',
            'edgeSensitivity': 'Edge Sensitivity:',
            'original': 'Original',
            'heatmap': 'Heatmap',
            'contours': 'Contours',
            'topView': 'Top View',
            '3dModels': '3D Models',
            'simulation': 'Simulation',
            'analysis': 'Analysis',
            'originalPlaceholder': 'Original image will appear here',
            'heatmapPlaceholder': 'Heatmap will appear here',
            'contourPlaceholder': 'Contours will appear here',
            'contourDesc': 'Switching edge mode or adjusting sensitivity triggers automatic reprocessing',
            'topViewDesc': 'Top view preview of expected depth after G-code execution (colors follow Colormap selection)',
            'threedPlaceholder': '3D model will appear here',
            'simulationPlaceholder': 'Simulation will appear here after generating G-code',
            'edges': 'Edges',
            'contrast': 'Contrast',
            'density': 'Density',
            'height': 'Height',
            'loadImageManually': 'Load Image Manually',
            'analysisResults': 'Analysis Results',
            'edgeCount': 'Edge Count:',
            'contrastRatio': 'Contrast Ratio:',
            'detailDensity': 'Detail Density:',
            'textureValue': 'Texture Value:',
            'dominantOrientation': 'Dominant Orientation:',
            'imageSharpness': 'Image Sharpness:',
            'recommendation': 'Recommendation:',
            'fullAnalysis': 'Full Analysis',
            'exportResults': 'Export Results',
            'image': 'Image',
            'report': 'Report',
            'processing': 'Processing...',
            'machineSettings': 'Machine Settings',
            'advancedMachineSettings': '⚙️ Advanced Machine Settings',
            'originX': 'Origin X',
            'originY': 'Origin Y',
            'originZ': 'Origin Z',
            'calibX': 'Calib X',
            'calibY': 'Calib Y',
            'reverseX': 'Reverse X',
            'reverseY': 'Reverse Y',
            'execution': 'Execution',
            'delayMs': 'Delay (ms)',
            'resetDefaults': 'Reset to Defaults',
            'save': 'Save',
            'machineType': 'Main Machine Type',
            'cncRouter': 'CNC Router (Wood Carving)',
            'laserEngraver': 'Laser Engraver',
            '3dPrinter': '3D Printer',
            'cncRouterSettings': 'CNC Router Settings',
            'workWidth': 'Work Width (cm)',
            'workHeight': 'Work Height (cm)',
            'workDepth': 'Work Depth (mm)',
            'centerOrigin': '🎯 Center Origin',
            'feedRate': 'Feed Rate (mm/min)',
            'safeZ': 'Safe Z (mm)',
            'scanDirection': 'Scan Direction (Raster)',
            'horizontal': 'Horizontal (X)',
            'vertical': 'Vertical (Y)',
            'stepOver': 'Step Over (mm)',
            'maxDepth': 'Max Depth (mm)',
            'useFixedZ': 'Use Fixed Z',
            'invertZ': 'Invert Z',
            'woodColor': 'Wood Color:',
            'lightWood': 'Light Wood',
            'mediumWood': 'Medium Wood',
            'beige': 'Beige',
            'mahogany': 'Mahogany',
            'generateCombo': '🧠 Generate Combo (Contour + Raster)',
            'generateGcode': '⚡ Generate G-code (Raster)',
            'quickTest': '🧪 Quick Test',
            'edgeRange': 'Edge Range (Contour)',
            'outerOnly': 'Outer Only',
            'allEdges': 'All Edges',
            'generateGcodeContour': '🌀 Generate G-code (Contour)',
            'downloadGcode': '💾 Download G-code',
            'laserEngraverSettings': 'Laser Engraver Settings',
            'laserEdgeMode': 'Laser Edge Detection Mode',
            'adaptiveDesc': 'Adaptive Threshold - Excellent for images with uneven lighting',
            'laserDetail': 'Laser Detail:',
            'redetectEdges': '🔄 Redetect Laser Edges',
            'laserPower': 'Laser Power:',
            'laserMode': 'Laser Mode',
            'engrave': 'Engrave (Grayscale)',
            'cut': 'Cut (Contour)',
            'combine': 'Engrave + Cut',
            'laserSpeed': 'Laser Speed (mm/min)',
            'laserPasses': 'Passes',
            'dynamicPower': 'Dynamic Power (by darkness)',
            'airAssist': 'Air Assist',
            'generateLaserCode': '⚡ Generate Laser Code (Engrave)',
            'quickEngrave': '🧪 Quick Engrave',
            'generateLaserCut': '✂️ Generate Laser Code (Cut)',
            'downloadLaserCode': '💾 Download Laser Code',
            'threedSettings': '3D Model Settings',
            'load3dFile': 'Load 3D File (STL, OBJ, etc.)',
            'layerHeight': 'Layer Height (mm)',
            'fillDensity': 'Fill Density (%)',
            'printSpeed': 'Print Speed (mm/s)',
            'infillPattern': 'Infill Pattern',
            'support': 'Support',
            'raft': 'Raft',
            'generate3dGcode': '⚡ Generate G-code (3D)',
            'previewLayers': '👁️ Preview Layers',
            'download3dGcode': '💾 Download 3D G-code',
            'gcodeOutput': 'G-code Output',
            'lang': 'EN'
        };
        
        return defaults;
    }

    setupEventListeners() {
        const langToggle = document.getElementById('languageToggle');
        if (langToggle) {
            langToggle.addEventListener('click', () => {
                this.toggleLanguage();
            });
        }
    }

    async toggleLanguage() {
        this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
        
        // تغيير اتجاه الصفحة فوراً
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = this.currentLang;
        
        await this.loadTranslations();
        this.applyLanguage();
        this.saveLanguage();
        
        console.log('Language changed to:', this.currentLang);
    }

    applyLanguage() {
        // تحديث جميع العناصر ذات data-i18n
        const elements = document.querySelectorAll('[data-i18n]');
        
        let translatedCount = 0;
        let missingCount = 0;
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translations[key];
            
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else if (element.tagName === 'OPTION') {
                    element.textContent = translation;
                } else {
                    element.textContent = translation;
                }
                translatedCount++;
            } else {
                console.warn('Translation missing for key:', key);
                missingCount++;
                // استخدم النص الأصلي كبديل
                const originalText = element.textContent || element.placeholder;
                if (originalText && !originalText.includes('data-i18n')) {
                    element.textContent = originalText;
                }
            }
        });

        // تحديث نص زر اللغة
        const langText = document.querySelector('.lang-text');
        if (langText) {
            langText.textContent = this.currentLang === 'ar' ? 'EN' : 'AR';
        }

        // تحديث عنوان الصفحة
        const title = this.translations['appTitle'];
        if (title) {
            document.title = title;
        }

        console.log(`Translation completed: ${translatedCount} translated, ${missingCount} missing`);
    }

    saveLanguage() {
        localStorage.setItem('cncai-language', this.currentLang);
    }

    getCurrentLanguage() {
        return this.currentLang;
    }

    t(key) {
        return this.translations[key] || key;
    }
}

// تهيئة نظام الترجمة
document.addEventListener('DOMContentLoaded', function() {
    window.i18nManager = new I18nManager();
});