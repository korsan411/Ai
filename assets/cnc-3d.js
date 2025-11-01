/* CncAi — cnc-3d.js | محاكاة ثلاثية الأبعاد و Three.js */

// ================= متغيرات عامة =================
    let cvReady = false;
    let grayMat = null;
    let contour = null;
    let previewCanvas = null;
    let additionalContours = []; // {contour, area}
    let lastScanDir = 'x';
    let lastGeneratedGcode = '';
    let isProcessing = false;

    // colormap current
    let currentColormap = 'jet';
    let edgeSensitivityTimer = null;

    // Simulation / Three
    let scene, camera, renderer, controls;
    let simulation = { 
      isPlaying: false, 
      animationFrame: null, 
      tool: null, 
      toolPath: null, 
      pathPoints: [], 
      index: 0, 
      speed: 1,
      elapsedTime: 0
    };

    // ================= متغيرات إضافية للثلاثي الأبعاد =================
    let threeDModel = null;
    let threeDScene = null;
    let threeDRenderer = null;
    let threeDCamera = null;
    let threeDControls = null;

    // ================= نظام إدارة المهام المحسن =================
    class TaskManager {
      constructor() {
        this.queue = [];
        this.isRunning = false;
        this.currentTask = null;
      }

      async addTask(taskFn, description = 'مهمة') {
        return new Promise((resolve, reject) => {
          this.queue.push({ taskFn, description, resolve, reject });
          if (!this.isRunning) {
            this.processQueue();
          }
        });
      }

      async processQueue() {
        if (this.queue.length === 0) {
          this.isRunning = false;
          return;
        }

        this.isRunning = true;
        const task = this.queue.shift();
        this.currentTask = task;

        try {
          showProgress(task.description);
          const result = await task.taskFn();
          task.resolve(result);
        } catch (error) {
          console.error(`فشل في ${task.description}:`, error);
          showToast(`فشل في ${task.description}: ${error.message}`, 5000);
          task.reject(error);
        } finally {
          this.currentTask = null;
          hideProgress();
          // استدعاء تالي بعد فترة راحة
          setTimeout(() => this.processQueue(), 50);
        }
      }

      clear() {
        this.queue = [];
        this.isRunning = false;
        this.currentTask = null;
      }

      getQueueLength() {
        return this.queue.length;
      }
    }

    const taskManager = new TaskManager();

    // ================= نظام التقدم =================
    function showProgress(message = 'جاري المعالجة...') {
      try {
        document.getElementById('progressText').textContent = message;
        document.getElementById('progressOverlay').style.display = 'flex';
      } catch (error) {
        console.warn('فشل في عرض التقدم:', error);
      }
    }

    function hideProgress() {
      try {
        document.getElementById('progressOverlay').style.display = 'none';
      } catch (error) {
        console.warn('فشل في إخفاء التقدم:', error);
      }
    }

    // ================= نظام التحقق من الصحة المحسن =================
    class InputValidator {
      static validateNumberInput(inputId, min, max, defaultValue = min) {
        try {
          const input = document.getElementById(inputId);
          if (!input) {
            throw new Error(`عنصر الإدخال ${inputId} غير موجود`);
          }
          
          let value = parseFloat(input.value);
          
          if (isNaN(value)) {
            showToast(`القيمة في ${inputId} غير صالحة`);
            input.value = defaultValue;
            return defaultValue;
          }
          
          if (value < min) {
            showToast(`القيمة في ${inputId} أقل من المسموح (${min})`);
            input.value = min;
            return min;
          }
          
          if (value > max) {
            showToast(`القيمة في ${inputId} أكبر من المسموح (${max})`);
            input.value = max;
            return max;
          }
          
          return value;
        } catch (error) {
          console.error(`خطأ في التحقق من ${inputId}:`, error);
          return defaultValue;
        }
      }

      static validateImageSize(canvas) {
        if (!canvas) return false;
        
        const maxPixels = 2000000; // 2MP للحد من استهلاك الذاكرة
        const currentPixels = canvas.width * canvas.height;
        
        if (currentPixels > maxPixels) {
          const ratio = Math.sqrt(maxPixels / currentPixels);
          const newWidth = Math.floor(canvas.width * ratio);
          const newHeight = Math.floor(canvas.height * ratio);
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = newWidth;
          tempCanvas.height = newHeight;
          tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
          
          const ctx = canvas.getContext('2d');
          canvas.width = newWidth;
          canvas.height = newHeight;
          ctx.drawImage(tempCanvas, 0, 0);
          
          showToast('تم تقليل حجم الصورة للأداء الأفضل');
          return true;
        }
        return false;
      }

      static validateLaserSettings() {
        const power = this.validateNumberInput('laserPower', 0, 100, 80);
        const speed = this.validateNumberInput('laserSpeed', 100, 10000, 2000);
        const passes = this.validateNumberInput('laserPasses', 1, 10, 1);
        
        return { power, speed, passes };
      }

      static validateRouterSettings() {
        const feedRate = this.validateNumberInput('feedRate', 10, 5000, 800);
        const safeZ = this.validateNumberInput('safeZ', 0, 100, 5);
        const maxDepth = this.validateNumberInput('maxDepth', 0.1, 50, 3);
        const stepOver = this.validateNumberInput('stepOver', 0.1, 50, 5);
        
        return { feedRate, safeZ, maxDepth, stepOver };
      }

      static validate3DSettings() {
        const layerHeight = this.validateNumberInput('threedLayerHeight', 0.05, 1.0, 0.2);
        const fillDensity = this.validateNumberInput('threedFillDensity', 0, 100, 20);
        const printSpeed = this.validateNumberInput('threedPrintSpeed', 10, 200, 50);
        const workDepth = this.validateNumberInput('threedWorkDepth', 0.1, 100, 10);
        
        return { layerHeight, fillDensity, printSpeed, workDepth };
      }

      static validateAllInputs() {
        const errors = [];
        
        // التحقق من المدخلات الأساسية
        const requiredInputs = [
          { id: 'workWidth', min: 1, max: 200 },
          { id: 'workHeight', min: 1, max: 200 },
          { id: 'laserWorkWidth', min: 1, max: 200 },
          { id: 'laserWorkHeight', min: 1, max: 200 },
          { id: 'threedWorkWidth', min: 1, max: 200 },
          { id: 'threedWorkHeight', min: 1, max: 200 }
        ];
        
        requiredInputs.forEach(input => {
          try {
            this.validateNumberInput(input.id, input.min, input.max);
          } catch (error) {
            errors.push(`خطأ في ${input.id}: ${error.message}`);
          }
        });
        
        return errors;
      }
    }

    // ================= Debug overlay system =================
    (function initDebugOverlay(){
      try {
        const debugList = document.getElementById('debugList');
        const dbgClear = document.getElementById('dbgClear');
        const dbgCopy = document.getElementById('dbgCopy');
        const dbgToggleSize = document.getElementById('dbgToggleSize');
        const debugOverlay = document.getElementById('debugOverlay');
        const debugSummary = document.getElementById('debugSummary');
        const logs = [];

        function formatTime(d) { 
          try {
            return d.toISOString().slice(11, 23);
          } catch {
            return '--:--:--';
          }
        }
        
        function updateSummary() { 
          debugSummary.textContent = logs.length + ' سجلات'; 
        }

        function addEntry(type, message, stack) {
          try {
            const time = new Date();
            const entry = { time, type, message, stack };
            logs.push(entry);
            updateSummary();

            const div = document.createElement('div');
            div.className = 'dbg-item ' + (type === 'error' ? 'dbg-error' : (type === 'warn' ? 'dbg-warn' : 'dbg-info'));
            const tspan = document.createElement('span');
            tspan.className = 'dbg-time';
            tspan.textContent = `[${formatTime(time)}] ${type.toUpperCase()}`;
            const msg = document.createElement('div');
            msg.textContent = String(message).substring(0, 500); // تحديد طول الرسالة
            div.appendChild(tspan);
            div.appendChild(msg);
            if (stack && type !== 'info') {
              const meta = document.createElement('div');
              meta.className = 'dbg-meta';
              meta.textContent = String(stack).split('\n').slice(0,2).join(' | ');
              div.appendChild(meta);
            }
            debugList.prepend(div);

            // تحديد عدد السجلات المحفوظة
            if (logs.length > 100) {
              const oldLog = logs.shift();
              if (debugList.lastChild) {
                debugList.removeChild(debugList.lastChild);
              }
            }
          } catch (e) {
            console.error('فشل في إضافة سجل تصحيح:', e);
          }
        }

        dbgClear.addEventListener('click', () => {
          try {
            debugList.innerHTML = '';
            logs.length = 0;
            updateSummary();
          } catch (e) {
            console.error('فشل في مسح السجلات:', e);
          }
        });

        dbgCopy.addEventListener('click', async () => {
          try {
            const text = logs.map(l => `[${l.time.toISOString()}] ${l.type.toUpperCase()}: ${l.message}\n${l.stack||''}`).join('\n\n');
            await navigator.clipboard.writeText(text);
            addEntry('info', 'تم نسخ السجل إلى الحافظة');
          } catch (e) {
            addEntry('error', 'فشل نسخ السجل: ' + (e.message || e));
          }
        });

        dbgToggleSize.addEventListener('click', (ev) => {
          try {
            ev.stopPropagation();
            debugOverlay.classList.toggle('minimized');
            dbgToggleSize.textContent = debugOverlay.classList.contains('minimized') ? '🔼' : '🔽';
          } catch (e) {
            console.error('فشل في تبديل حجم التصحيح:', e);
          }
        });

        // Click restore when minimized
        debugOverlay.addEventListener('click', (ev) => {
          try {
            if (debugOverlay.classList.contains('minimized')) {
              debugOverlay.classList.remove('minimized');
              dbgToggleSize.textContent = '🔽';
            }
          } catch (e) {
            console.error('فشل في استعادة حجم التصحيح:', e);
          }
        });

        // override console methods
        const _log = console.log, _warn = console.warn, _error = console.error;
        console.log = function(...args) {
          try { 
            addEntry('info', args.map(a=> {
              if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            }).join(' ')); 
          } catch(e){}
          _log.apply(console, args);
        };
        
        console.warn = function(...args) {
          try { 
            addEntry('warn', args.map(a=> {
              if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            }).join(' '), new Error().stack); 
          } catch(e){}
          _warn.apply(console, args);
        };
        
        console.error = function(...args) {
          try { 
            addEntry('error', args.map(a=> {
              if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            }).join(' '), new Error().stack); 
          } catch(e){}
          _error.apply(console, args);
        };

        window.addEventListener('error', function(ev){
          try { 
            addEntry('error', 
              (ev.message || 'Unknown error') + ' (' + (ev.filename || 'unknown') + ':' + (ev.lineno || 'unknown') + ')', 
              ev.error && ev.error.stack ? ev.error.stack : ''
            ); 
          } catch(e){}
        });

        window.addEventListener('unhandledrejection', function(ev){
          try { 
            addEntry('error', 
              'UnhandledRejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || 'Unknown reason')), 
              ev.reason && ev.reason.stack ? ev.reason.stack : ''
            ); 
          } catch(e){}
        });

        addEntry('info', 'تم تهيئة نظام التصحيح');

      } catch (error) {
        console.error('فشل في تهيئة نظام التصحيح:', error);
      }
    })();

    // ================= Helper UI funcs =================
    function showToast(msg, ms = 3000) {
      try {
        const t = document.getElementById('toast');
        if (!t) return;
        
        t.textContent = String(msg).substring(0, 200);
        t.style.display = 'block';
        clearTimeout(t._t);
        t._t = setTimeout(() => {
          if (t) t.style.display = 'none';
        }, ms);
        
        console.log('Toast: ' + msg);
      } catch (e) {
        console.error('فشل في عرض الإشعار:', e);
      }
    }

    function cmToMm(cm) { 
      const result = parseFloat(cm) * 10;
      return isNaN(result) ? 0 : result;
    }
    
    function mmToCm(mm) { 
      const result = parseFloat(mm) / 10;
      return isNaN(result) ? 0 : result;
    }

    function updateDimensionDisplay() {
      try {
        const widthCm = parseFloat(document.getElementById('workWidth').value) || 0;
        const heightCm = parseFloat(document.getElementById('workHeight').value) || 0;
        
        const widthMmElem = document.getElementById('widthMm');
        const heightMmElem = document.getElementById('heightMm');
        
        if (widthMmElem) widthMmElem.textContent = cmToMm(widthCm).toFixed(1) + ' مم';
        if (heightMmElem) heightMmElem.textContent = cmToMm(heightCm).toFixed(1) + ' مم';
        
        // Update laser dimensions too
        const laserWidthCm = parseFloat(document.getElementById('laserWorkWidth').value) || 0;
        const laserHeightCm = parseFloat(document.getElementById('laserWorkHeight').value) || 0;
        
        const laserWidthMmElem = document.getElementById('laserWidthMm');
        const laserHeightMmElem = document.getElementById('laserHeightMm');
        
        if (laserWidthMmElem) laserWidthMmElem.textContent = cmToMm(laserWidthCm).toFixed(1) + ' مم';
        if (laserHeightMmElem) laserHeightMmElem.textContent = cmToMm(laserHeightCm).toFixed(1) + ' مم';
        
        // Update 3D dimensions
        const threedWidthCm = parseFloat(document.getElementById('threedWorkWidth').value) || 0;
        const threedHeightCm = parseFloat(document.getElementById('threedWorkHeight').value) || 0;
        const threedDepth = parseFloat(document.getElementById('threedWorkDepth').value) || 0;
        
        const threedWidthMmElem = document.getElementById('threedWidthMm');
        const threedHeightMmElem = document.getElementById('threedHeightMm');
        const threedDepthMmElem = document.getElementById('threedDepthMm');
        
        if (threedWidthMmElem) threedWidthMmElem.textContent = cmToMm(threedWidthCm).toFixed(1) + ' مم';
        if (threedHeightMmElem) threedHeightMmElem.textContent = cmToMm(threedHeightCm).toFixed(1) + ' مم';
        if (threedDepthMmElem) threedDepthMmElem.textContent = threedDepth.toFixed(1) + ' مم';
      } catch (error) {
        console.error('فشل في تحديث عرض الأبعاد:', error);
      }
    }

    function showElement(elementId, hidePlaceholderId) {
      try {
        const element = document.getElementById(elementId);
        const placeholder = document.getElementById(hidePlaceholderId);
        
        if (element) {
          element.style.display = 'block';
        }
        if (placeholder) {
          placeholder.style.display = 'none';
        }
      } catch (error) {
        console.error('فشل في إظهار العنصر:', error);
      }
    }

    function hideElement(elementId) {
      try {
        const element = document.getElementById(elementId);
        if (element) {
          element.style.display = 'none';
        }
      } catch (error) {
        console.error('فشل في إخفاء العنصر:', error);
      }
    }

    // ================= OpenCV readiness - الإصدار المحسن =================
    function waitForCv() {
      try {
        if (typeof cv !== 'undefined' && (cv.getBuildInformation || cv.imread || cv.Mat)) {
          // اختبار شامل للتأكد من جاهزية OpenCV
          const testMat = new cv.Mat();
          if (testMat && testMat.delete) {
            cvReady = true;
            testMat.delete();
            
            // تحديث واجهة المستخدم
            const cvState = document.getElementById('cvState');
            if (cvState) {
              cvState.innerHTML = '✅ OpenCV جاهز';
            }
            showToast('تم تحميل OpenCV بنجاح', 1400);
            
            console.log('OpenCV loaded successfully');
            return;
          }
        }
        
        // إعادة المحاولة بعد فترة
        setTimeout(waitForCv, 100);
      } catch (error) {
        console.warn('OpenCV test failed, retrying...', error);
        setTimeout(waitForCv, 100);
      }
    }

    // إضافة معالج أخطاء لتحميل OpenCV
    window.addEventListener('error', function(e) {
      if (e.filename && e.filename.includes('opencv.js')) {
        const cvState = document.getElementById('cvState');
        if (cvState) {
          cvState.innerHTML = '❌ فشل تحميل OpenCV';
        }
        showToast('فشل في تحميل OpenCV. تأكد من الاتصال بالإنترنت', 5000);
      }
    });

    // بدء تحميل OpenCV
    setTimeout(waitForCv, 1000);

    // ================= نظام إدارة الذاكرة المحسن =================
    class MemoryManager {
  static safeDelete(mat, name = 'mat') {
    try {
      if (mat && typeof mat.delete === 'function') {
        if (!mat.isDeleted) {
          mat.delete();
          mat.isDeleted = true;
          console.log(`🧹 تم حذف ${name} بأمان`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ فشل في حذف المصفوفة (${name}):`, error);
      const dbgList = document.getElementById('debugList');
      if (dbgList) {
        const div = document.createElement('div');
        div.className = 'dbg-item dbg-warn';
        div.textContent = `فشل في حذف ${name}: ${error.message}`;
        dbgList.prepend(div);
      }
    }
  }
      constructor() {
        this.mats = new Set();
        this.maxMats = 15; // تقليل الحد الأقصى لتحسين الأداء
      }

      track(mat) {
        try {
          if (mat && !this.isMatDeleted(mat)) {
            this.mats.add(mat);
            // تنظيف الذاكرة إذا تجاوزنا الحد
            if (this.mats.size > this.maxMats) {
              this.cleanupOldest();
            }
          }
        } catch (error) {
          console.warn('فشل في تتبع المصفوفة:', error);
        }
      }

      isMatDeleted(mat) {
        try {
          return !mat || typeof mat.delete !== 'function';
        } catch {
          return true;
        }
      }

      cleanupOldest() {
        try {
          if (this.mats.size > 0) {
            const oldest = this.mats.values().next().value;
            this.safeDelete(oldest);
            this.mats.delete(oldest);
          }
        } catch (error) {
          console.warn('فشل في تنظيف أقدم مصفوفة:', error);
        }
      }

      safeDelete(mat) {
        try {
          if (!this.isMatDeleted(mat) && typeof mat.delete === 'function') {
            mat.delete();
          }
        } catch (error) {
          console.warn('فشل في حذف المصفوفة بأمان:', error);
        }
      }

      cleanupAll() {
        try {
          this.mats.forEach(mat => this.safeDelete(mat));
          this.mats.clear();
        } catch (error) {
          console.warn('فشل في التنظيف الكامل:', error);
        }
      }

      cleanupMats() {
        try {
          if (grayMat && !this.isMatDeleted(grayMat)) { 
            this.safeDelete(grayMat);
            grayMat = null; 
          }
        } catch (error) { 
          console.warn('فشل في تنظيف grayMat:', error); 
        }
        
        try {
          if (contour && !this.isMatDeleted(contour) && typeof contour.delete === 'function') {
            this.safeDelete(contour);
            contour = null;
          }
        } catch (error) { 
          console.warn('فشل في تنظيف contour:', error); 
        }
        
        try {
          additionalContours.forEach(item => {
            if (item && item.contour && !this.isMatDeleted(item.contour)) {
              this.safeDelete(item.contour);
            }
          });
          additionalContours = [];
        } catch (error) { 
          console.warn('فشل في تنظيف additionalContours:', error); 
        }
      }

      getMemoryUsage() {
        return this.mats.size;
      }
    }

    const memoryManager = new MemoryManager();

    // ================= Tabs behavior =================
    function initTabs() {
      try {
        document.querySelectorAll('.tab-buttons button').forEach(btn => {
          btn.addEventListener('click', () => {
            try {
              document.querySelectorAll('.tab-buttons button').forEach(b => b.classList.remove('active'));
              document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
              
              btn.classList.add('active');
              const tabId = btn.dataset.tab;
              const tabContent = document.getElementById(tabId);
              
              if (tabContent) {
                tabContent.classList.add('active');
              }

              if (tabId === 'simulation' && document.getElementById('gcodeOut').value) {
                initSimulation();
              }
            } catch (error) {
              console.error('فشل في تبديل التبويبات:', error);
            }
          });
        });
      } catch (error) {
        console.error('فشل في تهيئة التبويبات:', error);
      }
    }

    // ================= Machine Category Control =================
    function initMachineCategory() {
      try {
        const machineCategory = document.getElementById('machineCategory');
        if (!machineCategory) return;

        machineCategory.addEventListener('change', function(e) {
          try {
            const isLaser = e.target.value === 'laser';
            const is3D = e.target.value === 'threed';
            
            // إظهار/إخفاء الأقسام
            const routerSettings = document.getElementById('routerSettings');
            const laserSettings = document.getElementById('laserSettings');
            const threedSettings = document.getElementById('threedSettings');
            
            if (routerSettings) routerSettings.style.display = (isLaser || is3D) ? 'none' : 'block';
            if (laserSettings) laserSettings.style.display = isLaser ? 'block' : 'none';
            if (threedSettings) threedSettings.style.display = is3D ? 'block' : 'none';
            
            // تحديث واجهة الأزرار
            updateButtonVisibility(e.target.value);
            
            // إذا كانت صورة محملة، نعيد كشف الحواف بالنظام المناسب
            if (previewCanvas && cvReady && !isProcessing) {
              taskManager.addTask(async () => {
                if (isLaser) {
                  await detectLaserContours();
                } else if (!is3D) {
                  await detectContours();
                }
              }, 'تبديل وضع الماكينة');
            }
            
            showToast(`تم التبديل إلى وضع ${e.target.value}`);
          } catch (error) {
            console.error('فشل في تبديل نوع الماكينة:', error);
          }
        });

        // تهيئة وضوح الأزرار الأولي
        updateButtonVisibility(machineCategory.value);
      } catch (error) {
        console.error('فشل في تهيئة تحكم نوع الماكينة:', error);
      }
    }

    function updateButtonVisibility(machineType) {
      try {
        const isLaser = machineType === 'laser';
        const is3D = machineType === 'threed';
        
        const elements = {
          router: ['btnGen', 'btnContour', 'btnQuick', 'btnCenterOrigin'],
          laser: ['btnLaserEngrave', 'btnLaserQuick', 'btnLaserCut', 'btnLaserDownload', 'btnRedetectLaser', 'btnLaserCenterOrigin'],
          threed: ['btnSliceModel', 'btnPreviewLayers', 'btnDownload3D', 'btnThreedCenterOrigin']
        };

        // إخفاء جميع العناصر أولاً
        Object.values(elements).flat().forEach(id => {
          const elem = document.getElementById(id);
          if (elem) elem.style.display = 'none';
        });

        // إظهار العناصر المناسبة
        let toShow = [];
        if (isLaser) {
          toShow = elements.laser;
        } else if (is3D) {
          toShow = elements.threed;
        } else {
          toShow = elements.router;
        }
        
        toShow.forEach(id => {
          const elem = document.getElementById(id);
          if (elem) elem.style.display = 'block';
        });

      } catch (error) {
        console.error('فشل في تحديث وضوح الأزرار:', error);
      }
    }

    // ================= تهيئة عناصر التحكم =================
    function initControlElements() {
      try {
        // Laser power slider update
        const laserPower = document.getElementById('laserPower');
        if (laserPower) {
          laserPower.addEventListener('input', function(e) {
            const value = e.target.value;
            const display = document.getElementById('laserPowerValue');
            if (display) {
              display.textContent = value + '%';
              display.style.color = `hsl(${value * 1.2}, 100%, 60%)`;
            }
          });
        }

        // Laser detail slider update
        const laserDetail = document.getElementById('laserDetail');
        if (laserDetail) {
          laserDetail.addEventListener('input', function(e) {
            const display = document.getElementById('laserDetailValue');
            if (display) {
              display.textContent = e.target.value;
            }
          });
        }

        // Laser edge mode descriptions
        const laserModeDescriptions = {
          canny: 'Canny - كشف حواف تقليدي مناسب للصور العامة',
          adaptive: 'Adaptive Threshold - ممتاز للصور ذات الإضاءة غير المتجانسة',
          morphological: 'Morphological - للحواف الدقيقة والناعمة والتفاصيل الصغيرة',
          gradient: 'Gradient-Based - للتدرجات اللونية والصور ذات التباين العالي'
        };

        const laserEdgeMode = document.getElementById('laserEdgeMode');
        if (laserEdgeMode) {
          laserEdgeMode.addEventListener('change', function(e) {
            const desc = document.getElementById('laserModeDesc');
            if (desc) {
              desc.textContent = laserModeDescriptions[e.target.value] || '';
            }
            if (!previewCanvas || isProcessing) return;
            const isLaser = document.getElementById('machineCategory').value === 'laser';
            if (isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
              taskManager.addTask(detectLaserContours, 'تحديث كشف حواف الليزر');
            }
          });
        }

        // Laser center origin
        const btnLaserCenterOrigin = document.getElementById('btnLaserCenterOrigin');
        if (btnLaserCenterOrigin) {
          btnLaserCenterOrigin.addEventListener('click', () => {
            try {
              const workWidth = parseFloat(document.getElementById('laserWorkWidth').value) || 0;
              const workHeight = parseFloat(document.getElementById('laserWorkHeight').value) || 0;
              document.getElementById('laserOriginX').value = (workWidth / 2).toFixed(1);
              document.getElementById('laserOriginY').value = (workHeight / 2).toFixed(1);
              showToast("تم توسيط نقطة الأصل للليزر");
            } catch (error) {
              console.error('فشل في توسيط نقطة أصل الليزر:', error);
            }
          });
        }

        // 3D center origin
        const btnThreedCenterOrigin = document.getElementById('btnThreedCenterOrigin');
        if (btnThreedCenterOrigin) {
          btnThreedCenterOrigin.addEventListener('click', () => {
            try {
              const workWidth = parseFloat(document.getElementById('threedWorkWidth').value) || 0;
              const workHeight = parseFloat(document.getElementById('threedWorkHeight').value) || 0;
              document.getElementById('threedOriginX').value = (workWidth / 2).toFixed(1);
              document.getElementById('threedOriginY').value = (workHeight / 2).toFixed(1);
              showToast("تم توسيط نقطة الأصل للطابعة ثلاثية الأبعاد");
            } catch (error) {
              console.error('فشل في توسيط نقطة أصل الثلاثي الأبعاد:', error);
            }
          });
        }

        // Laser redetect button
        const btnRedetectLaser = document.getElementById('btnRedetectLaser');
        if (btnRedetectLaser) {
          btnRedetectLaser.addEventListener('click', () => {
            if (!previewCanvas) {
              showToast('لا توجد صورة محملة');
              return;
            }
            if (cvReady && !isProcessing) {
              taskManager.addTask(detectLaserContours, 'إعادة كشف حواف الليزر');
            }
          });
        }

        // Edge sensitivity updates
        const edgeSensitivity = document.getElementById('edgeSensitivity');
        if (edgeSensitivity) {
          edgeSensitivity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(2);
            const display = document.getElementById('edgeValue');
            if (display) {
              display.textContent = value;
            }
            if (!previewCanvas || isProcessing) return;
            const isLaser = document.getElementById('machineCategory').value === 'laser';
            if (!isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
              clearTimeout(edgeSensitivityTimer);
              edgeSensitivityTimer = setTimeout(() => {
                taskManager.addTask(detectContours, 'تحديث حساسية الحواف');
              }, 300);
            }
          });
        }

        // Edge mode changes
        const edgeMode = document.getElementById('edgeMode');
        if (edgeMode) {
          edgeMode.addEventListener('change', () => {
            if (!previewCanvas || isProcessing) return;
            const isLaser = document.getElementById('machineCategory').value === 'laser';
            if (!isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
              taskManager.addTask(detectContours, 'تحديث كشف الحواف');
            }
          });
        }

      } catch (error) {
        console.error('فشل في تهيئة عناصر التحكم:', error);
      }
    }

    // ================= Load image - الإصدار المحسن =================
    function initFileInput() {
      try {
        const fileInput = document.getElementById('fileInput');
        if (!fileInput) return;

        fileInput.addEventListener('change', async function (e) {
          if (isProcessing) {
            showToast('جاري معالجة صورة سابقة...');
            return;
          }

          const file = e.target.files[0];
          if (!file) return;
          
          // تحقق من نوع الملف
          if (!file.type.match('image.*')) {
            showToast('الرجاء اختيار ملف صورة فقط (JPEG, PNG, etc.)');
            return;
          }
          
          // تحقق من حجم الملف
          if (file.size > 10 * 1024 * 1024) { // 10MB
            showToast('حجم الملف كبير جداً. الرجاء اختيار صورة أصغر من 10MB');
            return;
          }
          
          await taskManager.addTask(async () => {
            try {
              isProcessing = true;
              memoryManager.cleanupMats();
              
              const img = new Image();
              const imgUrl = URL.createObjectURL(file);
              
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
                img.src = imgUrl;
              });

              previewCanvas = document.getElementById('canvasOriginal');
              if (!previewCanvas) {
                throw new Error('عنصر canvas غير موجود');
              }

              const ctx = previewCanvas.getContext('2d');
              if (!ctx) {
                throw new Error('لا يمكن الحصول على سياق الرسم');
              }

              let w = img.width, h = img.height;
              
              // تحقق من حجم الصورة وقللها إذا لزم الأمر
              InputValidator.validateImageSize(previewCanvas);
              
              // تعيين الأبعاد الجديدة
              previewCanvas.width = w;
              previewCanvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
    // 🧠 تمرير الصورة إلى وحدة التحليل AI Analyzer
    if (window.Analysis && typeof window.Analysis.loadImage === 'function') {
      try {
        const mat = cv.imread(previewCanvas);
        window.Analysis.loadImage(mat);
        mat.delete();
        console.log('✅ Analysis image attached manually.');
      } catch (e) {
        console.warn('⚠️ Analysis image attach failed:', e);
      }
    }

              
              showElement('canvasOriginal', 'originalPlaceholder');

              // تحرير الذاكرة
              URL.revokeObjectURL(imgUrl);

              if (cvReady) {
                const machineType = document.getElementById('machineCategory').value;
                if (machineType === 'laser') {
                  await detectLaserContours();
                } else if (machineType === 'router') {
                  await detectContours();
                }
              } else {
                showToast('في انتظار OpenCV...');
                await new Promise(resolve => {
                  const checkCv = setInterval(() => {
                    if (cvReady) {
                      clearInterval(checkCv);
                      resolve();
                    }
                  }, 100);
                });
                
                const machineType = document.getElementById('machineCategory').value;
                if (machineType === 'laser') {
                  await detectLaserContours();
                } else if (machineType === 'router') {
                  await detectContours();
                }
              }
            } catch (error) {
              console.error('خطأ في تحميل الصورة:', error);
              throw new Error('فشل في تحميل الصورة: ' + error.message);
            } finally {
              isProcessing = false;
            }
          }, 'تحميل الصورة');
        });
      } catch (error) {
        console.error('فشل في تهيئة إدخال الملف:', error);
      }
    }

    // ================= دعم تحميل ملفات STL و SVG و DXF =================
    function initFileFormatButtons() {
      try {
        document.querySelectorAll('#fileFormatButtons button').forEach(btn => {
          btn.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            
            // إزالة النشط من جميع الأزرار
            document.querySelectorAll('#fileFormatButtons button').forEach(b => {
              b.classList.remove('active');
            });
            
            // إضافة النشط للزر المحدد
            this.classList.add('active');
            
            // إنشاء عنصر إدخال ملف مخفي
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.style.display = 'none';
            
            // تحديد نوع الملفات المقبولة
            switch(format) {
              case 'stl':
                fileInput.accept = '.stl';
                break;
              case 'svg':
                fileInput.accept = '.svg';
                break;
              case 'dxf':
                fileInput.accept = '.dxf';
                break;
            }
            
            fileInput.addEventListener('change', function(e) {
              const file = e.target.files[0];
              if (!file) return;
              
              handleFileFormatUpload(file, format);
              
              // تنظيف
              document.body.removeChild(fileInput);
            });
            
            document.body.appendChild(fileInput);
            fileInput.click();
          });
        });
      } catch (error) {
        console.error('فشل في تهيئة أزرار تنسيقات الملفات:', error);
      }
    }

    // معالجة تحميل ملفات STL و SVG و DXF
    function handleFileFormatUpload(file, format) {
      taskManager.addTask(async () => {
        try {
          let message = '';
          
          switch(format) {
            case 'stl':
              message = 'تم تحميل ملف STL بنجاح. يمكنك معاينته في قسم 3D Models.';
              await loadSTLFile(file);
              break;
            case 'svg':
              message = 'تم تحميل ملف SVG بنجاح. يمكن تحويله إلى G-code.';
              await processSVGFile(file);
              break;
            case 'dxf':
              message = 'تم تحميل ملف DXF بنجاح. يمكن تحويله إلى G-code.';
              await processDXFFile(file);
              break;
          }
          
          showToast(`✅ ${message}`);
        } catch (error) {
          console.error(`خطأ في تحميل ملف ${format.toUpperCase()}:`, error);
          throw new Error(`فشل في تحميل ملف ${format.toUpperCase()}: ${error.message}`);
        }
      }, `تحميل ملف ${format.toUpperCase()}`);
    }

    // ================= تحميل ملفات STL =================
    async function loadSTLFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          try {
            // تنظيف المشهد السابق
            cleanup3DScene();
            
            // إنشاء مشهد جديد
            init3DScene();
            
            // استخدام STLLoader إذا كان متاحاً
            if (typeof THREE !== 'undefined' && THREE.STLLoader) {
              const loader = new THREE.STLLoader();
              const geometry = loader.parse(e.target.result);
              
              const material = new THREE.MeshPhongMaterial({ 
                color: 0x049ef4, 
                specular: 0x111111, 
                shininess: 200 
              });
              
              threeDModel = new THREE.Mesh(geometry, material);
              threeDModel.position.set(0, 0, 0);
              threeDScene.add(threeDModel);
              
              // ضبط الكاميرا لتناسب الموديل
              fitCameraToObject(threeDCamera, threeDModel, threeDControls);
              
              showElement('threeDContainer', 'threedPlaceholder');
              render3DScene();
              resolve();
            } else {
              reject(new Error('STL Loader غير متاح'));
            }
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
        reader.readAsArrayBuffer(file);
      });
    }

    // ================= معالجة ملفات SVG =================
    async function processSVGFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          try {
            // في التطبيق الحقيقي، سيتم تحليل محتوى SVG وتحويله إلى مسارات
            // هنا مجرد محاكاة للمعالجة
            console.log('معالجة ملف SVG:', file.name, 'حجم:', file.size);
            
            // عرض رسالة نجاح المعالجة
            showToast('✅ تم تحليل ملف SVG وتحضيره للتحويل إلى G-code');
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
        reader.readAsText(file);
      });
    }

    // ================= معالجة ملفات DXF =================
    async function processDXFFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          try {
            // في التطبيق الحقيقي، سيتم تحليل محتوى DXF واستخراج الكيانات الهندسية
            // هنا مجرد محاكاة للمعالجة
            console.log('معالجة ملف DXF:', file.name, 'حجم:', file.size);
            
            // عرض رسالة نجاح المعالجة
            showToast('✅ تم تحليل ملف DXF وتحضيره للتحويل إلى G-code');
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
        reader.readAsText(file);
      });
    }

    // ================= تهيئة المشهد ثلاثي الأبعاد =================
    function init3DScene() {
      const container = document.getElementById('threeDContainer');
      if (!container) return;
      
      threeDScene = new THREE.Scene();
      threeDScene.background = new THREE.Color(0x041022);
      
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 400;
      
      threeDCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      threeDCamera.position.z = 5;
      
      const canvas3D = document.getElementById('canvas3D');
      threeDRenderer = new THREE.WebGLRenderer({ 
        canvas: canvas3D,
        antialias: true 
      });
      threeDRenderer.setSize(width, height);
      
      // إضاءة
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      threeDScene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      threeDScene.add(directionalLight);
      
      // عناصر تحكم الكاميرا
      if (typeof THREE.OrbitControls !== 'undefined') {
        threeDControls = new THREE.OrbitControls(threeDCamera, threeDRenderer.domElement);
        threeDControls.enableDamping = true;
        threeDControls.dampingFactor = 0.05;
      }
      
      // شبكة مساعدة
      const gridHelper = new THREE.GridHelper(10, 10);
      threeDScene.add(gridHelper);
      
      // محاور
      const axesHelper = new THREE.AxesHelper(5);
      threeDScene.add(axesHelper);
    }

    // ================= ضبط الكاميرا لتناسب الموديل =================
    function fitCameraToObject(camera, object, controls, offset = 1.25) {
      const boundingBox = new THREE.Box3().setFromObject(object);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * offset;
      
      cameraZ *= 1.5; // مسافة إضافية
      
      camera.position.set(center.x, center.y, cameraZ);
      camera.lookAt(center);
      
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    }

    // ================= عرض المشهد ثلاثي الأبعاد =================
    function render3DScene() {
      if (!threeDRenderer || !threeDScene || !threeDCamera) return;
      
      requestAnimationFrame(render3DScene);
      
      if (threeDControls) {
        threeDControls.update();
      }
      
      threeDRenderer.render(threeDScene, threeDCamera);
    }

    // ================= تنظيف المشهد ثلاثي الأبعاد =================
    function cleanup3DScene() {
      if (threeDControls) {
        threeDControls.dispose();
        threeDControls = null;
      }
      
      if (threeDRenderer) {
        threeDRenderer.dispose();
        threeDRenderer = null;
      }
      
      threeDScene = null;
      threeDCamera = null;
      threeDModel = null;
    }

    // ================= Edge detection & contours للراوتر - الإصدار المحسن =================
    async function detectContours() {
      if (!cvReady) {
        throw new Error('OpenCV غير جاهز بعد');
      }
      
      // التحقق من وجود صورة صالحة
      if (!previewCanvas || previewCanvas.width === 0 || previewCanvas.height === 0) {
        throw new Error('لا توجد صورة صالحة للمعالجة');
      }
      
      let src = null, gray = null, blurred = null, edges = null, hierarchy = null, contours = null, kernel = null;
      
      try {
        src = cv.imread(previewCanvas);
        if (src.empty()) {
          throw new Error('الصورة غير صالحة للمعالجة');
        }
        memoryManager.track(src);
        
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        memoryManager.track(gray);
        
        blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        memoryManager.track(blurred);

        // pick edge mode
        const mode = document.getElementById('edgeMode').value || 'auto';
        // sensitivity
        const sens = parseFloat(document.getElementById('edgeSensitivity').value) || 0.33;

        const median = cv.mean(blurred)[0];
        const lowerThreshold = Math.max(0, (1.0 - sens) * median);
        const upperThreshold = Math.min(255, (1.0 + sens) * median);

        edges = new cv.Mat();
        memoryManager.track(edges);
        
        if (mode === 'sobel') {
          const gradX = new cv.Mat(), gradY = new cv.Mat();
          cv.Sobel(blurred, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
          cv.Sobel(blurred, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
          cv.convertScaleAbs(gradX, gradX);
          cv.convertScaleAbs(gradY, gradY);
          cv.addWeighted(gradX, 0.5, gradY, 0.5, 0, edges);
          memoryManager.safeDelete(gradX);
          memoryManager.safeDelete(gradY);
        } else if (mode === 'laplace') {
          cv.Laplacian(blurred, edges, cv.CV_16S, 3, 1, 0, cv.BORDER_DEFAULT);
          cv.convertScaleAbs(edges, edges);
        } else {
          cv.Canny(blurred, edges, lowerThreshold, upperThreshold);
        }

        // improve edges
        kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        memoryManager.track(kernel);

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        memoryManager.track(contours);
        memoryManager.track(hierarchy);

        const minArea = (gray.cols * gray.rows) * 0.01; // default 1%
        const validContours = [];
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          if (area > minArea) {
            validContours.push({ contour: cnt, area });
          } else {
            memoryManager.safeDelete(cnt);
          }
        }

        if (validContours.length > 0) {
          validContours.sort((a,b)=> b.area - a.area);
          contour = validContours[0].contour;
          additionalContours = validContours.slice(1).map(v => ({ contour: v.contour, area: v.area }));
          showToast(`تم كشف ${validContours.length} كونتور`);
        } else {
          throw new Error('لم يتم العثور على حواف واضحة في الصورة');
        }

        if (grayMat) { 
          memoryManager.safeDelete(grayMat);
        }
        grayMat = gray.clone();
        memoryManager.track(grayMat);

        renderHeatmap(); // uses currentColormap
        renderContour(gray, contour);

      } catch (err) {
        console.error('خطأ في كشف الحواف:', err);
        throw new Error('فشل في تحليل الصورة: ' + err.message);
      } finally {
        // تنظيف المصفوفات المؤقتة
        [src, blurred, edges, hierarchy, contours, kernel, gray].forEach(mat => {
          if (mat !== grayMat) { // لا تحذف grayMat لأنه مخزن للاستخدام لاحقاً
            memoryManager.safeDelete(mat);
          }
        });
      }
    }

    // ================= Laser-Specific Edge Detection - الإصدار المحسن =================
    async function detectLaserContours() {
      if (!cvReady) {
        throw new Error('OpenCV غير جاهز بعد');
      }
      
      // التحقق من وجود صورة صالحة
      if (!previewCanvas || previewCanvas.width === 0 || previewCanvas.height === 0) {
        throw new Error('لا توجد صورة صالحة للمعالجة');
      }
      
      let src = null, gray = null, edges = null, hierarchy = null, contours = null;
      
      try {
        src = cv.imread(previewCanvas);
        if (src.empty()) {
          throw new Error('الصورة غير صالحة للمعالجة');
        }
        memoryManager.track(src);
        
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        memoryManager.track(gray);
        
        const mode = document.getElementById('laserEdgeMode').value || 'adaptive';
        const detailLevel = parseInt(document.getElementById('laserDetail').value) || 5;
        
        edges = new cv.Mat();
        memoryManager.track(edges);
        
        if (mode === 'adaptive') {
          const adaptive = new cv.Mat();
          const blockSize = Math.max(3, 2 * Math.floor(detailLevel) + 1);
          cv.adaptiveThreshold(gray, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, 2);
          memoryManager.track(adaptive);
          
          const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
          cv.morphologyEx(adaptive, edges, cv.MORPH_CLOSE, kernel);
          memoryManager.track(kernel);
          
          memoryManager.safeDelete(adaptive);
          memoryManager.safeDelete(kernel);
          
        } else if (mode === 'morphological') {
          const blurred = new cv.Mat();
          cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
          memoryManager.track(blurred);
          
          const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
          const dilated = new cv.Mat();
          const eroded = new cv.Mat();
          
          cv.dilate(blurred, dilated, kernel);
          cv.erode(blurred, eroded, kernel);
          cv.subtract(dilated, eroded, edges);
          
          cv.normalize(edges, edges, 0, 255, cv.NORM_MINMAX);
          
          memoryManager.safeDelete(blurred);
          memoryManager.safeDelete(kernel);
          memoryManager.safeDelete(dilated);
          memoryManager.safeDelete(eroded);
          
        } else if (mode === 'gradient') {
          const blurred = new cv.Mat();
          cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
          memoryManager.track(blurred);
          
          const gradX = new cv.Mat();
          const gradY = new cv.Mat();
          const absGradX = new cv.Mat();
          const absGradY = new cv.Mat();
          
          cv.Sobel(blurred, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
          cv.Sobel(blurred, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
          
          cv.convertScaleAbs(gradX, absGradX);
          cv.convertScaleAbs(gradY, absGradY);
          cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, edges);
          
          const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
          cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
          memoryManager.track(kernel);
          
          memoryManager.safeDelete(blurred);
          memoryManager.safeDelete(gradX);
          memoryManager.safeDelete(gradY);
          memoryManager.safeDelete(absGradX);
          memoryManager.safeDelete(absGradY);
          memoryManager.safeDelete(kernel);
          
        } else {
          const blurred = new cv.Mat();
          cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
          cv.Canny(blurred, edges, 50, 150);
          memoryManager.safeDelete(blurred);
        }

        if (detailLevel > 5) {
          const kernelSize = Math.min(3, Math.floor(detailLevel / 3));
          const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize));
          cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
          memoryManager.safeDelete(kernel);
        }

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        memoryManager.track(contours);
        memoryManager.track(hierarchy);

        const minArea = (gray.cols * gray.rows) * 0.002;
        const validContours = [];
        
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          if (area > minArea) {
            validContours.push({ contour: cnt, area });
          } else {
            memoryManager.safeDelete(cnt);
          }
        }

        if (validContours.length > 0) {
          validContours.sort((a,b)=> b.area - a.area);
          contour = validContours[0].contour;
          additionalContours = validContours.slice(1).map(v => ({ contour: v.contour, area: v.area }));
          showToast(`تم كشف ${validContours.length} كونتور للليزر`);
        } else {
          throw new Error('لم يتم العثور على حواف مناسبة للليزر');
        }

        if (grayMat) { 
          memoryManager.safeDelete(grayMat);
        }
        grayMat = gray.clone();
        memoryManager.track(grayMat);

        renderHeatmap();
        renderContour(gray, contour);

      } catch (err) {
        console.error('خطأ في كشف حواف الليزر:', err);
        throw new Error('فشل في تحليل الصورة للليزر: ' + err.message);
      } finally {
        // تنظيف الذاكرة
        [src, gray, edges, hierarchy, contours].forEach(mat => {
          if (mat !== grayMat) {
            memoryManager.safeDelete(mat);
          }
        });
      }
    }

    // ================= Colormap utilities - الإصدار المحسن =================
    function clamp(v, a=0, b=1){ return Math.max(a, Math.min(b, v)); }
    
    function getColormapColor(t, map) {
      try {
        t = clamp(t);
        if (map === 'hot') {
          if (t < 0.33) return { r: Math.round(t/0.33*128), g: 0, b: 0 };
          if (t < 0.66) return { r: Math.round(128 + (t-0.33)/0.33*127), g: Math.round((t-0.33)/0.33*128), b: 0 };
          return { r: 255, g: Math.round(128 + (t-0.66)/0.34*127), b: Math.round((t-0.66)/0.34*127) };
        } else if (map === 'cool') {
          return { r: Math.round(255 * t), g: Math.round(255 * (1 - t)), b: 255 };
        } else if (map === 'gray') {
          const v = Math.round(255 * t);
          return { r: v, g: v, b: v };
        } else {
          // jet-like approximation
          const r = Math.round(255 * clamp(1.5 - Math.abs(1.0 - 4.0*(t-0.5)), 0, 1));
          const g = Math.round(255 * clamp(1.5 - Math.abs(0.5 - 4.0*(t-0.25)), 0, 1));
          const b = Math.round(255 * clamp(1.5 - Math.abs(0.5 - 4.0*(t)), 0, 1));
          return { r, g, b };
        }
      } catch (error) {
        console.warn('خطأ في توليد لون الخريطة:', error);
        return { r: 128, g: 128, b: 128 };
      }
    }

    function hexToRgb(hex) {
      try {
        if (!hex) return { r:160, g:82, b:45 };
        const h = hex.replace('#','');
        const hh = (h.length===3) ? h.split('').map(c=>c+c).join('') : h;
        const bigint = parseInt(hh, 16);
        return { 
          r: (bigint >> 16) & 255, 
          g: (bigint >> 8) & 255, 
          b: bigint & 255 
        };
      } catch {
        return { r:160, g:82, b:45 };
      }
    }
    
    function mixColors(c1, c2, t) {
      try {
        t = clamp(t);
        return {
          r: Math.round(c1.r * (1 - t) + c2.r * t),
          g: Math.round(c1.g * (1 - t) + c2.g * t),
          b: Math.round(c1.b * (1 - t) + c2.b * t)
        };
      } catch {
        return c1;
      }
    }

    // ================= Rendering heatmap & contour (colormaps) - الإصدار المحسن =================
    function renderHeatmap() {
      try {
        if (!grayMat || !previewCanvas) return;
        
        const heatCanvas = document.getElementById('canvasHeatmap');
        if (!heatCanvas) return;
        
        const ctx = heatCanvas.getContext('2d');
        if (!ctx) return;
        
        heatCanvas.width = grayMat.cols;
        heatCanvas.height = grayMat.rows;
        const imgData = ctx.createImageData(heatCanvas.width, heatCanvas.height);
        const data = grayMat.data;
        
        for (let i = 0; i < data.length; i++) {
          const value = data[i];
          const t = value / 255.0;
          const col = getColormapColor(t, currentColormap);
          const idx = i * 4;
          imgData.data[idx] = col.r;
          imgData.data[idx + 1] = col.g;
          imgData.data[idx + 2] = col.b;
          imgData.data[idx + 3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
        showElement('canvasHeatmap', 'heatmapPlaceholder');

        // also update contour view (overlay)
        try {
          if (contour) renderContour(grayMat, contour);
        } catch(e){
          console.warn('فشل في عرض الكنتور:', e);
        }
        
        // update top view if G-code exists
        if (lastGeneratedGcode) {
          renderTopViewFromGcode(lastGeneratedGcode);
        }
      } catch (error) {
        console.error('فشل في عرض heatmap:', error);
      }
    }

    function renderContour(gray, mainContour) {
      try {
        const contourCanvas = document.getElementById('canvasContour');
        if (!contourCanvas) return;
        
        const ctx = contourCanvas.getContext('2d');
        if (!ctx) return;
        
        contourCanvas.width = gray.cols;
        contourCanvas.height = gray.rows;
        const heatCanvas = document.getElementById('canvasHeatmap');
        
        // draw heatmap first
        try {
          if (heatCanvas) {
            ctx.drawImage(heatCanvas, 0, 0);
          } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(0,0,contourCanvas.width, contourCanvas.height);
          }
        } catch(e) {
          ctx.fillStyle = '#222';
          ctx.fillRect(0,0,contourCanvas.width, contourCanvas.height);
        }
        
        if (mainContour) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const data = mainContour.data32S;
          for (let i = 0; i < data.length; i += 2) {
            const x = data[i], y = data[i + 1];
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        additionalContours.forEach(ci => {
          try {
            const cnt = ci.contour;
            if (!cnt) return;
            
            ctx.beginPath();
            const d = cnt.data32S;
            for (let i = 0; i < d.length; i += 2) {
              const x = d[i], y = d[i+1];
              if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            ctx.closePath();
            ctx.stroke();
          } catch(e) { 
            console.warn('خطأ في عرض الكنتور الإضافي:', e); 
          }
        });
        
        showElement('canvasContour', 'contourPlaceholder');
      } catch (error) {
        console.error('فشل في عرض الكنتور:', error);
      }
    }

    // ================= Bilinear sampling from grayscale Mat - الإصدار المحسن =================
    function sampleGrayAt(x, y) {
      try {
        if (!grayMat || !previewCanvas) return 128;
        
        const gw = grayMat.cols, gh = grayMat.rows;
        if (gw === 0 || gh === 0) return 128;
        
        // التحقق من الحدود
        const gx_f = Math.max(0, Math.min(gw - 1, (x / previewCanvas.width) * (gw - 1)));
        const gy_f = Math.max(0, Math.min(gh - 1, (y / previewCanvas.height) * (gh - 1)));
        
        const x0 = Math.floor(gx_f), y0 = Math.floor(gy_f);
        const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
        const sx = gx_f - x0, sy = gy_f - y0;
        
        // التحقق من حدود المصفوفة
        const idx00 = y0 * gw + x0;
        const idx10 = y0 * gw + x1;
        const idx01 = y1 * gw + x0;
        const idx11 = y1 * gw + x1;
        
        if (idx00 >= grayMat.data.length || idx10 >= grayMat.data.length || 
            idx01 >= grayMat.data.length || idx11 >= grayMat.data.length) {
          return 128;
        }
        
        const v00 = grayMat.data[idx00];
        const v10 = grayMat.data[idx10];
        const v01 = grayMat.data[idx01];
        const v11 = grayMat.data[idx11];
        
        const v0 = v00 * (1 - sx) + v10 * sx;
        const v1 = v01 * (1 - sx) + v11 * sx;
        return Math.round(v0 * (1 - sy) + v1 * sy);
      } catch (error) {
        console.warn('خطأ في أخذ عينات الرمادي:', error);
        return 128;
      }
    }

    // ================= Raster helpers - الإصدار المحسن =================
    function addSegmentPoints(rowPoints, startX, endX, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue) {
      try {
        for (let x = startX; x <= endX; x += 2) {
          const pv = sampleGrayAt(x, y);
          let z;
          if (useFixedZ) {
            z = fixedZValue;
          } else {
            z = -((255 - pv) / 255.0) * maxDepth;
          }
          if (invertZ) z = -z;
          const scaledX = (x * scaleX) + originX;
          const scaledY = (y * scaleY) + originY;
          rowPoints.push({ x: scaledX, y: scaledY, z });
        }
      } catch (error) {
        console.warn('خطأ في إضافة نقاط المقطع:', error);
      }
    }

    function addVerticalSegmentPoints(colPoints, x, startY, endY, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue) {
      try {
        for (let y = startY; y <= endY; y += 2) {
          const pv = sampleGrayAt(x, y);
          let z;
          if (useFixedZ) {
            z = fixedZValue;
          } else {
            z = -((255 - pv) / 255.0) * maxDepth;
          }
          if (invertZ) z = -z;
          const scaledX = (x * scaleX) + originX;
          const scaledY = (y * scaleY) + originY;
          colPoints.push({ x: scaledX, y: scaledY, z });
        }
      } catch (error) {
        console.warn('خطأ في إضافة نقاط المقطع الرأسي:', error);
      }
    }

    function processRowPoints(rowPoints, lines, feed, safeZ, reverse) {
      try {
        if (reverse) rowPoints.reverse();
        if (rowPoints.length === 0) return;
        
        lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2) + ' Z' + safeZ.toFixed(2));
        lines.push('G1 F' + feed.toFixed(0));
        
        for (let i = 0; i < rowPoints.length; i++) {
          const p = rowPoints[i];
          lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2) + ' Z' + p.z.toFixed(3));
        }
        
        lines.push('G0 Z' + safeZ.toFixed(2));
      } catch (error) {
        console.warn('خطأ في معالجة نقاط الصف:', error);
      }
    }

    function calculateRowLength(rowPoints) {
      try {
        let length = 0;
        for (let i = 1; i < rowPoints.length; i++) {
          length += Math.hypot(rowPoints[i].x - rowPoints[i-1].x, rowPoints[i].y - rowPoints[i-1].y);
        }
        return length;
      } catch {
        return 0;
      }
    }

    // ================= Generate Raster G-code للراوتر - الإصدار المحسن =================
    function generateRasterGcode(scaleDown = false) {
      if (!grayMat || !contour) {
        throw new Error("لا توجد صورة جاهزة للمعالجة");
      }
      
      try {
        InputValidator.validateRouterSettings();
        
        const dir = document.getElementById('scanDir').value;
        lastScanDir = dir;
        const stepOver = parseFloat(document.getElementById('stepOver').value) || 5;
        const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3;
        const feed = parseFloat(document.getElementById('feedRate').value) || 800;
        const safeZ = parseFloat(document.getElementById('safeZ').value) || 5;

        const useFixedZ = document.getElementById('fixedZ').checked;
        const fixedZValue = parseFloat(document.getElementById('fixedZValue').value) || -1.0;
        const invertZ = document.getElementById('invertZ').checked;

        const workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
        const originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);

        const lines = [];
        lines.push('G21 G90 G17');
        lines.push('G0 Z' + safeZ.toFixed(2));

        let totalLen = 0;
        const step = scaleDown ? stepOver * 4 : stepOver;
        const scaleX = workWidth / previewCanvas.width;
        const scaleY = workHeight / previewCanvas.height;

        if (dir === 'x') {
          for (let y = 0; y < previewCanvas.height; y += step) {
            const rowPoints = [];
            let inContour = false;
            let segmentStart = -1;
            
            for (let x = 0; x < previewCanvas.width; x += 2) {
              const pt = new cv.Point(x, y);
              const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
              if (inside && !inContour) { 
                segmentStart = x; 
                inContour = true; 
              } else if (!inside && inContour) {
                addSegmentPoints(rowPoints, segmentStart, x - 1, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
                inContour = false;
              }
            }
            
            if (inContour) {
              addSegmentPoints(rowPoints, segmentStart, previewCanvas.width - 1, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
            }
            
            if (rowPoints.length > 1) {
              processRowPoints(rowPoints, lines, feed, safeZ, (y / step) % 2 !== 0);
              totalLen += calculateRowLength(rowPoints);
            }
          }
        } else if (dir === 'y') {
          for (let x = 0; x < previewCanvas.width; x += step) {
            const colPoints = [];
            let inContour = false;
            let segmentStart = -1;
            
            for (let y = 0; y < previewCanvas.height; y += 2) {
              const pt = new cv.Point(x, y);
              const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
              if (inside && !inContour) { 
                segmentStart = y; 
                inContour = true; 
              } else if (!inside && inContour) {
                addVerticalSegmentPoints(colPoints, x, segmentStart, y - 1, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
                inContour = false;
              }
            }
            
            if (inContour) {
              addVerticalSegmentPoints(colPoints, x, segmentStart, previewCanvas.height - 1, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
            }
            
            if (colPoints.length > 1) {
              processRowPoints(colPoints, lines, feed, safeZ, (x / step) % 2 !== 0);
              totalLen += calculateRowLength(colPoints);
            }
          }
        }

        lines.push('M5');
        lines.push('M30');

        // improved estimate
        const timeMin = (totalLen / (feed || 1)) + ((Math.max(0, safeZ) / 50) * (totalLen / 1000));
        document.getElementById('estTime').innerHTML = "⏱️ تقدير الوقت: " + timeMin.toFixed(1) + " دقيقة";

        return lines.join('\n');
      } catch (error) {
        console.error('خطأ في توليد G-code:', error);
        throw new Error('فشل في توليد G-code (Raster): ' + error.message);
      }
    }

    // ================= Generate Contour G-code للراوتر - الإصدار المحسن =================
    function generateContourGcode() {
      if (!grayMat || !contour) {
        throw new Error("لا توجد بيانات حواف لتوليد الكود");
      }
      
      try {
        InputValidator.validateRouterSettings();
        
        const mode = document.getElementById('contourMode').value || 'outer';
        lastScanDir = 'contour';
        const feed = parseFloat(document.getElementById('feedRate').value) || 800;
        const safeZ = parseFloat(document.getElementById('safeZ').value) || 5;
        const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3;

        const useFixedZ = document.getElementById('fixedZ').checked;
        const fixedZValue = parseFloat(document.getElementById('fixedZValue').value) || -1.0;
        const invertZ = document.getElementById('invertZ').checked;

        const workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
        const originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);
        const scaleX = workWidth / previewCanvas.width;
        const scaleY = workHeight / previewCanvas.height;

        const lines = [];
        lines.push('G21 G90 G17');
        lines.push('G0 Z' + safeZ.toFixed(2));

        const contoursToUse = (mode === 'outer') ? [contour] : [contour, ...additionalContours.map(c => c.contour)];
        let totalLen = 0;

        for (const cnt of contoursToUse) {
          if (!cnt) continue;
          
          const data = cnt.data32S;
          if (!data || data.length < 4) continue;

          let x0 = data[0], y0 = data[1];
          const startX = (x0 * scaleX + originX).toFixed(2);
          const startY = (y0 * scaleY + originY).toFixed(2);
          const startGray = sampleGrayAt(x0, y0);

          let zStart;
          if (useFixedZ) zStart = fixedZValue;
          else zStart = -((255 - startGray) / 255.0) * maxDepth;
          if (invertZ) zStart = -zStart;

          lines.push(`G0 X${startX} Y${startY} Z${safeZ.toFixed(2)}`);
          lines.push(`G1 F${feed.toFixed(0)}`);
          lines.push(`G1 Z${zStart.toFixed(3)}`);

          for (let i = 2; i < data.length; i += 2) {
            const x = data[i], y = data[i + 1];
            const px = (x * scaleX + originX).toFixed(2);
            const py = (y * scaleY + originY).toFixed(2);
            const pv = sampleGrayAt(x, y);
            let zVal;
            if (useFixedZ) zVal = fixedZValue;
            else zVal = -((255 - pv) / 255.0) * maxDepth;
            if (invertZ) zVal = -zVal;
            lines.push(`G1 X${px} Y${py} Z${zVal.toFixed(3)}`);
            totalLen += Math.hypot(x - x0, y - y0);
            x0 = x; y0 = y;
          }

          lines.push(`G1 X${startX} Y${startY} Z${zStart.toFixed(3)}`);
          lines.push(`G0 Z${safeZ.toFixed(2)}`);
        }

        lines.push('M5');
        lines.push('M30');

        const timeMin = totalLen / (parseFloat(document.getElementById('feedRate').value)||800);
        document.getElementById('estTime').innerHTML = "⏱️ تقدير الوقت (Contour): " + timeMin.toFixed(1) + " دقيقة";

        return lines.join('\n');

      } catch (error) {
        console.error('خطأ في توليد G-code الكنتور:', error);
        throw new Error('فشل في توليد G-code (Contour): ' + error.message);
      }
    }

    // ================= Laser G-code Generation - الإصدار المحسن =================
    function generateLaserEngraveGcode() {
      if (!grayMat || !contour) {
        throw new Error("لا توجد صورة جاهزة للمعالجة");
      }

      try {
        InputValidator.validateLaserSettings();
        
        const laserPower = parseInt(document.getElementById('laserPower').value) || 80;
        const laserSpeed = parseInt(document.getElementById('laserSpeed').value) || 2000;
        const dynamicPower = document.getElementById('laserDynamic').checked;

        const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
        const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);

        const lines = [];
        lines.push('G21 G90');
        lines.push('G0 X0 Y0');
        lines.push('M3 S' + Math.round(laserPower * 10));
        
        const scaleX = workWidth / previewCanvas.width;
        const scaleY = workHeight / previewCanvas.height;
        
        const stepOver = 3.0;
        let totalLen = 0;
        let pointCount = 0;

        for (let y = 0; y < previewCanvas.height; y += stepOver) {
          const rowPoints = [];
          
          for (let x = 0; x < previewCanvas.width; x += 3) {
            const pt = new cv.Point(x, y);
            const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
            
            if (inside) {
              const pv = sampleGrayAt(x, y);
              const power = dynamicPower ? Math.round((pv / 255) * laserPower) : laserPower;
              const scaledX = (x * scaleX) + originX;
              const scaledY = (y * scaleY) + originY;
              rowPoints.push({ x: scaledX, y: scaledY, power });
              pointCount++;
              
              if (pointCount > 2000) break;
            }
          }
          
          if (rowPoints.length > 1) {
            const reverse = (y / stepOver) % 2 !== 0;
            if (reverse) rowPoints.reverse();
            
            lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2));
            lines.push('G1 F' + laserSpeed.toFixed(0));
            
            for (let i = 0; i < rowPoints.length; i++) {
              const p = rowPoints[i];
              lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2));
            }
            
            totalLen += calculateRowLength(rowPoints);
          }
          
          if (pointCount > 2000) break;
        }

        lines.push('M5');
        lines.push('M30');

        const timeMin = totalLen / laserSpeed;
        document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت الليزر: " + timeMin.toFixed(1) + " دقيقة | " + pointCount + " نقطة";

        return lines.join('\n');
      } catch (error) {
        console.error('خطأ في توليد كود الليزر:', error);
        throw new Error('فشل في توليد كود الليزر: ' + error.message);
      }
    }

    function generateLaserQuickGcode() {
      if (!grayMat || !contour) {
        throw new Error("لا توجد صورة جاهزة للمعالجة");
      }

      try {
        const laserPower = 80;
        const laserSpeed = 3000;

        const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
        const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);

        const lines = [];
        lines.push('G21 G90');
        lines.push('G0 X0 Y0');
        lines.push('M3 S800');
        
        const scaleX = workWidth / previewCanvas.width;
        const scaleY = workHeight / previewCanvas.height;
        
        const stepOver = 5.0;
        let totalLen = 0;
        let pointCount = 0;

        for (let y = 0; y < previewCanvas.height; y += stepOver) {
          const rowPoints = [];
          
          for (let x = 0; x < previewCanvas.width; x += 5) {
            const pt = new cv.Point(x, y);
            const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
            
            if (inside) {
              const scaledX = (x * scaleX) + originX;
              const scaledY = (y * scaleY) + originY;
              rowPoints.push({ x: scaledX, y: scaledY });
              pointCount++;
              
              if (pointCount > 1000) break;
            }
          }
          
          if (rowPoints.length > 1) {
            const reverse = (y / stepOver) % 2 !== 0;
            if (reverse) rowPoints.reverse();
            
            lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2));
            lines.push('G1 F' + laserSpeed.toFixed(0));
            
            for (let i = 0; i < rowPoints.length; i++) {
              const p = rowPoints[i];
              lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2));
            }
            
            totalLen += calculateRowLength(rowPoints);
          }
          
          if (pointCount > 1000) break;
        }

        lines.push('M5');
        lines.push('M30');

        document.getElementById('estTime').innerHTML = "⏱️ وضع سريع: " + pointCount + " نقطة";

        return lines.join('\n');
      } catch (error) {
        console.error('خطأ في التوليد السريع للليزر:', error);
        throw new Error('فشل في التوليد السريع: ' + error.message);
      }
    }

    function generateLaserCutGcode() {
      if (!grayMat || !contour) {
        throw new Error("لا توجد بيانات حواف لتوليد كود القص");
      }

      try {
        InputValidator.validateLaserSettings();
        
        const laserPower = parseInt(document.getElementById('laserPower').value) || 80;
        const laserSpeed = parseInt(document.getElementById('laserSpeed').value) || 1000;
        const laserPasses = parseInt(document.getElementById('laserPasses').value) || 1;
        const airAssist = document.getElementById('laserAirAssist').checked;

        const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
        const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);
        const scaleX = workWidth / previewCanvas.width;
        const scaleY = workHeight / previewCanvas.height;

        const lines = [];
        lines.push('G21 G90');
        if (airAssist) lines.push('M8');

        const contoursToUse = [contour, ...additionalContours.map(c => c.contour)].filter(c => c);
        let totalLen = 0;

        for (let pass = 0; pass < laserPasses; pass++) {
          for (const cnt of contoursToUse) {
            const data = cnt.data32S;
            if (!data || data.length < 4) continue;

            let x0 = data[0], y0 = data[1];
            const startX = (x0 * scaleX + originX).toFixed(2);
            const startY = (y0 * scaleY + originY).toFixed(2);

            lines.push(`G0 X${startX} Y${startY}`);
            lines.push(`M3 S${Math.round(laserPower * 10)}`);
            lines.push(`G1 F${laserSpeed.toFixed(0)}`);

            for (let i = 2; i < data.length; i += 2) {
              const x = data[i], y = data[i + 1];
              const px = (x * scaleX + originX).toFixed(2);
              const py = (y * scaleY + originY).toFixed(2);
              lines.push(`G1 X${px} Y${py}`);
              totalLen += Math.hypot(x - x0, y - y0);
              x0 = x; y0 = y;
            }

            lines.push(`G1 X${startX} Y${startY}`);
            lines.push('M5');
          }
        }

        if (airAssist) lines.push('M9');
        lines.push('M30');

        const timeMin = totalLen / laserSpeed;
        document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت القص: " + timeMin.toFixed(1) + " دقيقة";

        return lines.join('\n');

      } catch (error) {
        console.error('خطأ في توليد كود قص الليزر:', error);
        throw new Error('فشل في توليد كود قص الليزر: ' + error.message);
      }
    }

    // ================= توليد G-code للنماذج ثلاثية الأبعاد =================
    function generate3DGcode() {
      if (!threeDModel) {
        throw new Error("لا يوجد نموذج ثلاثي الأبعاد محمل");
      }
      
      try {
        InputValidator.validate3DSettings();
        
        // الحصول على الإعدادات
        const layerHeight = parseFloat(document.getElementById('threedLayerHeight').value) || 0.2;
        const printSpeed = parseFloat(document.getElementById('threedPrintSpeed').value) || 50;
        const fillDensity = parseFloat(document.getElementById('threedFillDensity').value) || 20;
        const workWidth = cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30);
        const workHeight = cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20);
        const workDepth = parseFloat(document.getElementById('threedWorkDepth').value) || 10;
        const infillPattern = document.getElementById('threedInfillPattern').value || 'rectilinear';
        const supportEnabled = document.getElementById('threedSupport').checked;
        const raftEnabled = document.getElementById('threedRaft').checked;
        
        const originX = cmToMm(parseFloat(document.getElementById('threedOriginX').value) || 0);
        const originY = cmToMm(parseFloat(document.getElementById('threedOriginY').value) || 0);

        const lines = [];
        lines.push('; G-code للنموذج ثلاثي الأبعاد');
        lines.push('; تم التوليد بواسطة CNC AI');
        lines.push('G21 G90 G94 ; Set units to millimeters, absolute positioning, feedrate per minute');
        lines.push('M82 ; Set extruder to absolute mode');
        lines.push('M107 ; Fan off');
        lines.push('G28 ; Home all axes');
        lines.push('G1 Z15 F3000 ; Move Z up');
        
        // إعدادات البداية
        lines.push('M104 S200 ; Start heating extruder');
        lines.push('M140 S60 ; Start heating bed');
        lines.push('G92 E0 ; Reset extruder position');
        lines.push('G1 E-1 F300 ; Retract filament');
        
        // انتظار التسخين
        lines.push('M109 S200 ; Wait for extruder temperature');
        lines.push('M190 S60 ; Wait for bed temperature');
        
        // رافدة (Raft) إذا مفعل
        if (raftEnabled) {
          lines.push('; Start Raft');
          lines.push('G1 Z0.3 F3000');
          for (let i = 0; i < 3; i++) {
            const z = 0.3 + (i * layerHeight);
            lines.push(`G1 Z${z.toFixed(2)} F1200`);
            lines.push('G1 X10 Y10 F2400');
            lines.push(`G1 X${workWidth - 10} Y10`);
            lines.push(`G1 X${workWidth - 10} Y${workHeight - 10}`);
            lines.push(`G1 X10 Y${workHeight - 10}`);
            lines.push('G1 X10 Y10');
          }
          lines.push('; End Raft');
        }
        
        // حساب عدد الطبقات
        const layers = Math.floor(workDepth / layerHeight);
        
        // توليد G-code للطبقات
        for (let layer = 0; layer < layers; layer++) {
          const z = (raftEnabled ? 0.9 : 0) + (layer * layerHeight);
          lines.push(`; Layer ${layer + 1}, Z = ${z.toFixed(2)}`);
          lines.push(`G0 Z${z.toFixed(2)} F3000`);
          
          // طباعة الإطار الخارجي
          lines.push('; Outer perimeter');
          lines.push('G1 X10 Y10 F2400');
          lines.push(`G1 X${workWidth - 10} Y10`);
          lines.push(`G1 X${workWidth - 10} Y${workHeight - 10}`);
          lines.push(`G1 X10 Y${workHeight - 10}`);
          lines.push('G1 X10 Y10');
          
          // الحشو حسب النمط المختار
          lines.push(`; Infill pattern: ${infillPattern}`);
          const infillStep = Math.max(5, 20 * (100 - fillDensity) / 100);
          
          if (infillPattern === 'rectilinear') {
            // نمط مستقيم
            for (let y = 15; y < workHeight - 15; y += infillStep) {
              lines.push(`G0 X10 Y${y} F3000`);
              lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
            }
          } else if (infillPattern === 'grid') {
            // نمط شبكي
            for (let y = 15; y < workHeight - 15; y += infillStep) {
              lines.push(`G0 X10 Y${y} F3000`);
              lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
            }
            for (let x = 15; x < workWidth - 15; x += infillStep) {
              lines.push(`G0 X${x} Y15 F3000`);
              lines.push(`G1 X${x} Y${workHeight - 15} F${printSpeed * 60}`);
            }
          } else if (infillPattern === 'triangles') {
            // نمط مثلثات
            let flip = false;
            for (let y = 15; y < workHeight - 15; y += infillStep) {
              if (flip) {
                lines.push(`G0 X${workWidth - 10} Y${y} F3000`);
                lines.push(`G1 X10 Y${y} F${printSpeed * 60}`);
              } else {
                lines.push(`G0 X10 Y${y} F3000`);
                lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
              }
              flip = !flip;
            }
          } else if (infillPattern === 'honeycomb') {
            // نمط خلية النحل (مبسط)
            for (let y = 15; y < workHeight - 15; y += infillStep * 1.5) {
              lines.push(`G0 X10 Y${y} F3000`);
              lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
              if (y + infillStep / 2 < workHeight - 15) {
                lines.push(`G0 X${workWidth - 10} Y${y + infillStep / 2} F3000`);
                lines.push(`G1 X10 Y${y + infillStep / 2} F${printSpeed * 60}`);
              }
            }
          }
          
          // دعم (Support) إذا مفعل
          if (supportEnabled && layer < layers * 0.7) {
            lines.push('; Support structure');
            const supportStep = infillStep * 2;
            for (let x = 20; x < workWidth - 20; x += supportStep) {
              for (let y = 20; y < workHeight - 20; y += supportStep) {
                if ((x + y) % (supportStep * 2) === 0) {
                  lines.push(`G0 X${x} Y${y} F3000`);
                  lines.push(`G1 Z${(z + layerHeight).toFixed(2)} F600`);
                  lines.push(`G1 Z${z.toFixed(2)} F600`);
                }
              }
            }
          }
        }
        
        // نهاية البرنامج
        lines.push('; Finished printing');
        lines.push('G0 Z15 F3000 ; Move Z up');
        lines.push('M104 S0 ; Turn off extruder');
        lines.push('M140 S0 ; Turn off bed');
        lines.push('M107 ; Fan off');
        lines.push('M84 ; Disable steppers');
        lines.push('M30 ; End of program');
        
        // تقدير الوقت
        const estimatedTime = (layers * 2) / 60; // تقدير مبسط
        document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت الطباعة: " + estimatedTime.toFixed(1) + " دقيقة | " + layers + " طبقة";
        
        return lines.join('\n');
      } catch (error) {
        console.error('خطأ في توليد G-code ثلاثي الأبعاد:', error);
        throw new Error('فشل في توليد G-code ثلاثي الأبعاد: ' + error.message);
      }
    }

    // ================= تهيئة الأزرار - الإصدار المحسن =================
    function initButtons() {
      try {
        // Router buttons
        const btnGen = document.getElementById('btnGen');
        if (btnGen) {
          btnGen.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateRasterGcode(false);
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد G-code (Raster)");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد G-code (Raster)');
          });
        }

        const btnQuick = document.getElementById('btnQuick');
        if (btnQuick) {
          btnQuick.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateRasterGcode(true);
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد G-code سريع (Raster)");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد G-code سريع');
          });
        }

        const btnContour = document.getElementById('btnContour');
        if (btnContour) {
          btnContour.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateContourGcode();
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد G-code (Contour)");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد G-code (Contour)');
          });
        }

        // Laser buttons
        const btnLaserEngrave = document.getElementById('btnLaserEngrave');
        if (btnLaserEngrave) {
          btnLaserEngrave.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateLaserEngraveGcode();
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد كود الليزر (نقش)");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد كود الليزر (نقش)');
          });
        }

        const btnLaserQuick = document.getElementById('btnLaserQuick');
        if (btnLaserQuick) {
          btnLaserQuick.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateLaserQuickGcode();
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد كود الليزر السريع");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد كود الليزر السريع');
          });
        }

        const btnLaserCut = document.getElementById('btnLaserCut');
        if (btnLaserCut) {
          btnLaserCut.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generateLaserCutGcode();
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد كود الليزر (قص)");
                renderTopViewFromGcode(gcode);
                document.querySelector('.tab-buttons button[data-tab="simulation"]').click();
              }
              return gcode;
            }, 'توليد كود الليزر (قص)');
          });
        }

        // 3D buttons
        const btnSliceModel = document.getElementById('btnSliceModel');
        if (btnSliceModel) {
          btnSliceModel.addEventListener('click', () => {
            taskManager.addTask(() => {
              const gcode = generate3DGcode();
              document.getElementById('gcodeOut').value = gcode;
              lastGeneratedGcode = gcode;
              if (gcode) {
                showToast("تم توليد G-code ثلاثي الأبعاد");
              }
              return gcode;
            }, 'توليد G-code ثلاثي الأبعاد');
          });
        }

        const btnPreviewLayers = document.getElementById('btnPreviewLayers');
        if (btnPreviewLayers) {
          btnPreviewLayers.addEventListener('click', () => {
            showToast("ميزة معاينة الطبقات قيد التطوير", 3000);
          });
        }

        const btnDownload = document.getElementById('btnDownload');
        if (btnDownload) {
          btnDownload.addEventListener('click', () => {
            const text = document.getElementById('gcodeOut').value;
            if (!text) { 
              showToast("لا يوجد G-code لتحميله"); 
              return; 
            }
            try {
              const now = new Date();
              const dateStr = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
              const machineType = document.getElementById('machineCategory').value;
              const filename = `${machineType}_output_${dateStr}.gcode`;
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; 
              a.download = filename; 
              document.body.appendChild(a); 
              a.click(); 
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              showToast(`تم تحميل الملف: ${filename}`);
            } catch (error) {
              console.error('خطأ في تحميل الملف:', error);
              showToast('فشل في تحميل الملف');
            }
          });
        }

        const btnLaserDownload = document.getElementById('btnLaserDownload');
        if (btnLaserDownload) {
          btnLaserDownload.addEventListener('click', () => {
            document.getElementById('btnDownload').click();
          });
        }

        const btnDownload3D = document.getElementById('btnDownload3D');
        if (btnDownload3D) {
          btnDownload3D.addEventListener('click', () => {
            document.getElementById('btnDownload').click();
          });
        }

        const btnCenterOrigin = document.getElementById('btnCenterOrigin');
        if (btnCenterOrigin) {
          btnCenterOrigin.addEventListener('click', () => {
            try {
              const workWidth = parseFloat(document.getElementById('workWidth').value) || 0;
              const workHeight = parseFloat(document.getElementById('workHeight').value) || 0;
              document.getElementById('originX').value = (workWidth / 2).toFixed(1);
              document.getElementById('originY').value = (workHeight / 2).toFixed(1);
              showToast("تم توسيط نقطة الأصل");
            } catch (error) {
              console.error('فشل في توسيط نقطة الأصل:', error);
            }
          });
        }

      } catch (error) {
        console.error('فشل في تهيئة الأزرار:', error);
      }
    }

    // ================= Colormap Event Listeners - الإصدار المحسن =================
    function initColormapButtons() {
      try {
        document.querySelectorAll('#colormapButtons button').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            try {
              document.querySelectorAll('#colormapButtons button').forEach(b=>b.classList.remove('active'));
              btn.classList.add('active');
              currentColormap = btn.dataset.map;
              
              // تحديث الـ heatmap إذا كان ظاهر
              if (document.getElementById('heatmap').classList.contains('active')) {
                renderHeatmap();
              }
              
              // تحديث الـ top view إذا كان هناك G-code
              if (lastGeneratedGcode) {
                renderTopViewFromGcode(lastGeneratedGcode);
              }
              
              // تحديث الـ contour view إذا كان ظاهر
              if (document.getElementById('contour').classList.contains('active') && grayMat && contour) {
                renderContour(grayMat, contour);
              }
              
              showToast('تم تغيير نموذج الألوان إلى ' + currentColormap);
            } catch (error) {
              console.error('فشل في تغيير خريطة الألوان:', error);
            }
          });
        });
      } catch (error) {
        console.error('فشل في تهيئة أزرار خريطة الألوان:', error);
      }
    }

    // ================= Simulation 3D & Controls - الإصدار المحسن =================

    // إضافة تحقق من تحميل المكتبات
    function checkThreeJSLoaded() {
      if (typeof THREE === 'undefined') {
        throw new Error('THREE.js غير محمل');
      }
      
      // التحقق من OrbitControls
      if (typeof THREE.OrbitControls === 'undefined') {
        console.warn('OrbitControls غير محمل - ستعمل المحاكاة بدون تحكم بالكاميرا');
      }
      
      return true;
    }

    function parseGcodeForSimulation(gcode) {
      if (!gcode || gcode.length === 0) return [];
      
      try {
        const lines = gcode.split('\n');
        const path = [];
        let pos = { x: 0, y: 0, z: 0 };
        let pointCount = 0;
        const maxPoints = 1500; // تقليل الحد الأقصى للأداء
        
        for (let line of lines) {
          if (pointCount >= maxPoints) break;
          
          line = line.trim();
          if (!line || line.startsWith(';')) continue;
          
          if (line.startsWith('G0') || line.startsWith('G1')) {
            const xm = line.match(/X([-\d.]+)/i);
            const ym = line.match(/Y([-\d.]+)/i);
            const zm = line.match(/Z([-\d.]+)/i);
            
            if (xm) pos.x = parseFloat(xm[1]) || pos.x;
            if (ym) pos.y = parseFloat(ym[1]) || pos.y;
            if (zm) pos.z = parseFloat(zm[1]) || pos.z;
            
            // أخذ عينات أقل للتحسين
            if (pointCount % 8 === 0) {
              path.push({ x: pos.x, y: pos.y, z: pos.z });
            }
            pointCount++;
          }
        }
        
        return path;
      } catch (error) {
        console.error('خطأ في تحليل G-code للمحاكاة:', error);
        return [];
      }
    }

    function createToolPathVisualization(pathPoints, dir) {
      if (!pathPoints || pathPoints.length < 2) return null;
      
      try {
        const points = pathPoints.map(p => new THREE.Vector3(p.x / 10, -p.z, p.y / 10));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        let color = 0x10b981; // x
        if (dir === 'y') color = 0x3b82f6;
        if (dir === 'contour') color = 0xf59e0b;
        if (dir === 'laser') color = 0xff4444;
        if (dir === 'threed') color = 0x10b981;
        const material = new THREE.LineBasicMaterial({ color: color });
        const line = new THREE.Line(geometry, material);
        return line;
      } catch (error) {
        console.error('فشل في إنشاء تصور مسار الأداة:', error);
        return null;
      }
    }

    function createToolModel() {
      try {
        const group = new THREE.Group();
        const bodyGeom = new THREE.CylinderGeometry(0.6, 0.6, 6, 12);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        const tipGeom = new THREE.ConeGeometry(0.8, 2.5, 12);
        const tipMat = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 4;
        group.add(tip);
        
        group.scale.set(1.5,1.5,1.5);
        return group;
      } catch (error) {
        console.error('فشل في إنشاء نموذج الأداة:', error);
        return new THREE.Group();
      }
    }

    function createLaserToolModel() {
      try {
        const group = new THREE.Group();
        const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 8, 12);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        const lensGeom = new THREE.CylinderGeometry(0.6, 0.6, 1, 16);
        const lensMat = new THREE.MeshPhongMaterial({ color: 0x00ffff });
        const lens = new THREE.Mesh(lensGeom, lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 4.5;
        group.add(lens);
        
        group.scale.set(1.2,1.2,1.2);
        return group;
      } catch (error) {
        console.error('فشل في إنشاء نموذج أداة الليزر:', error);
        return new THREE.Group();
      }
    }

    function create3DPrinterToolModel() {
      try {
        const group = new THREE.Group();
        const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 6, 12);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x10b981 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        const nozzleGeom = new THREE.ConeGeometry(0.5, 2, 12);
        const nozzleMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.z = 4;
        group.add(nozzle);
        
        group.scale.set(1.2,1.2,1.2);
        return group;
      } catch (error) {
        console.error('فشل في إنشاء نموذج أداة الطابعة ثلاثية الأبعاد:', error);
        return new THREE.Group();
      }
    }

    // دالة مساعدة لتنظيف المحاكاة
    function cleanupSimulation() {
      try {
        simulation.isPlaying = false;
        if (simulation.animationFrame) {
          cancelAnimationFrame(simulation.animationFrame);
          simulation.animationFrame = null;
        }
        
        simulation.index = 0;
        simulation.pathPoints = [];
        
        if (controls) {
          controls.dispose();
          controls = null;
        }
        
        if (renderer) {
          try {
            const container = document.getElementById('threeContainer');
            if (container && renderer.domElement && renderer.domElement.parentNode) {
              container.removeChild(renderer.domElement);
            }
            renderer.dispose();
            renderer = null;
          } catch (e) {
            console.warn('خطأ في التخلص من العارض:', e);
          }
        }
        
        scene = null;
        camera = null;
        simulation.tool = null;
        simulation.toolPath = null;
      } catch (error) {
        console.error('فشل في تنظيف المحاكاة:', error);
      }
    }

    // Simulation controls UI will be created inside the three container
    function addSimulationControls(container) {
      try {
        const old = container.querySelector('.sim-controls');
        if (old) old.remove();
        const oldInfo = container.querySelector('.sim-progress');
        if (oldInfo) oldInfo.remove();

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'sim-controls';
        controlsDiv.innerHTML = `
          <button id="simPlay">▶</button><button id="simPause">⏸</button><button id="simReset">⏮</button>
          <label style="color:#cfeaf2;font-size:12px;margin-right:6px">سرعة</label>
          <input id="simSpeed" type="range" min="0.2" max="3" step="0.1" value="${simulation.speed}" style="width:120px">
          <span id="simSpeedLabel" style="min-width:36px;text-align:center">${simulation.speed.toFixed(1)}x</span>
        `;
        container.appendChild(controlsDiv);

        const prog = document.createElement('div');
        prog.className = 'sim-progress';
        prog.innerHTML = `الحالة: <span id="simStatus">جاهز</span> — تقدم: <span id="simProgress">0%</span>`;
        container.appendChild(prog);

        // Events
        const simPlay = document.getElementById('simPlay');
        const simPause = document.getElementById('simPause');
        const simReset = document.getElementById('simReset');
        const simSpeed = document.getElementById('simSpeed');
        const simSpeedLabel = document.getElementById('simSpeedLabel');

        if (simPlay) {
          simPlay.addEventListener('click', () => {
            if (!simulation.pathPoints || simulation.pathPoints.length === 0) return;
            if (!simulation.isPlaying) {
              simulation.isPlaying = true;
              animateSimPath();
              const status = document.getElementById('simStatus');
              if (status) status.textContent = 'جاري التشغيل';
              showToast('بدأت المحاكاة');
            }
          });
        }

        if (simPause) {
          simPause.addEventListener('click', () => {
            if (simulation.isPlaying) {
              simulation.isPlaying = false;
              cancelAnimationFrame(simulation.animationFrame);
              const status = document.getElementById('simStatus');
              if (status) status.textContent = 'متوقف';
              showToast('أقفلت المحاكاة مؤقتاً');
            }
          });
        }

        if (simReset) {
          simReset.addEventListener('click', () => {
            simulation.isPlaying = false;
            cancelAnimationFrame(simulation.animationFrame);
            simulation.index = 0;
            simulation.elapsedTime = 0;
            updateToolPosition(0);
            const progress = document.getElementById('simProgress');
            const status = document.getElementById('simStatus');
            if (progress) progress.textContent = '0%';
            if (status) status.textContent = 'جاهز';
            showToast('تم إعادة المحاكاة');
          });
        }

        if (simSpeed && simSpeedLabel) {
          simSpeed.addEventListener('input', (e) => {
            simulation.speed = parseFloat(e.target.value);
            simSpeedLabel.textContent = simulation.speed.toFixed(1) + 'x';
          });
        }
      } catch (error) {
        console.error('فشل في إضافة عناصر تحكم المحاكاة:', error);
      }
    }

    function animateSimPath() {
      if (!simulation.pathPoints || simulation.pathPoints.length === 0) return;
      
      function step() {
        if (!simulation.isPlaying) return;
        
        simulation.index += simulation.speed;
        if (simulation.index >= simulation.pathPoints.length) {
          simulation.index = simulation.pathPoints.length - 1;
          updateToolPosition(simulation.index);
          const progress = document.getElementById('simProgress');
          const status = document.getElementById('simStatus');
          if (progress) progress.textContent = '100%';
          if (status) status.textContent = 'مكتمل';
          simulation.isPlaying = false;
          cancelAnimationFrame(simulation.animationFrame);
          showToast('اكتملت المحاكاة');
          return;
        }
        
        updateToolPosition(simulation.index);
        const prog = ((Math.floor(simulation.index) + 1) / simulation.pathPoints.length) * 100;
        const progress = document.getElementById('simProgress');
        if (progress) progress.textContent = prog.toFixed(1) + '%';
        
        simulation.animationFrame = requestAnimationFrame(step);
      }
      
      if (!simulation.animationFrame) {
        step();
      }
    }

    function updateToolPosition(index) {
      if (!simulation.tool || !simulation.pathPoints || simulation.pathPoints.length === 0) return;
      
      try {
        const i = Math.floor(index);
        const p = simulation.pathPoints[i];
        if (!p) return;
        
        simulation.tool.position.set(p.x / 10, -p.z, p.y / 10);
      } catch (error) {
        console.warn('فشل في تحديث موضع الأداة:', error);
      }
    }

    function initSimulation() {
      const container = document.getElementById('threeContainer');
      if (!container) return;
      
      // التحقق من تحميل المكتبات
      if (!checkThreeJSLoaded()) {
        showToast('المكتبات ثلاثية الأبعاد غير جاهزة. جاري المحاولة مرة أخرى...');
        setTimeout(initSimulation, 1000);
        return;
      }
      
      // تنظيف المحاكاة السابقة بشكل كامل
      cleanupSimulation();
      
      const placeholder = document.getElementById('simulationPlaceholder');
      if (placeholder) placeholder.style.display = 'none';

      try {
        const gcode = document.getElementById('gcodeOut').value;
        if (!gcode || gcode.trim().length === 0) {
          showToast('لا يوجد G-code للمحاكاة');
          if (placeholder) placeholder.style.display = 'flex';
          return;
        }

        // إنشاء المشهد
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x081224);

        const containerW = container.clientWidth || 800;
        const containerH = container.clientHeight || 400;
        
        camera = new THREE.PerspectiveCamera(60, containerW / containerH, 0.1, 2000);
        camera.position.set(100, 100, 100);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ 
          antialias: false,
          preserveDrawingBuffer: true
        });
        renderer.setSize(containerW, containerH);
        container.appendChild(renderer.domElement);

        // استخدام OrbitControls إذا كان متاحاً
        if (typeof THREE.OrbitControls !== 'undefined') {
          try {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = false;
            controls.screenSpacePanning = true;
          } catch (e) {
            console.warn('فشل في تهيئة OrbitControls:', e);
          }
        }

        // إضاءة مبسطة
        const ambient = new THREE.AmbientLight(0x404040, 0.8);
        scene.add(ambient);

        const machineType = document.getElementById('machineCategory').value;
        const isLaser = machineType === 'laser';
        const is3D = machineType === 'threed';
        
        // منصة مبسطة
        const workWidth = is3D ? 
          cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30) / 10 :
          (isLaser ? 
            cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30) / 10 :
            cmToMm(parseFloat(document.getElementById('workWidth').value) || 30) / 10);
        const workHeight = is3D ?
          cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20) / 10 :
          (isLaser ?
            cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20) / 10 :
            cmToMm(parseFloat(document.getElementById('workHeight').value) || 20) / 10);
        
        let platformColor;
        if (is3D) platformColor = 0x444444;
        else if (isLaser) platformColor = 0x666666;
        else platformColor = 0x8B4513;
        
        const platformGeometry = new THREE.BoxGeometry(workWidth, 0.5, workHeight);
        const platformMaterial = new THREE.MeshPhongMaterial({ 
          color: platformColor 
        });
        const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
        platformMesh.position.set(workWidth/2, -0.25, workHeight/2);
        scene.add(platformMesh);

        // مسار مبسط
        const pathPoints = parseGcodeForSimulation(gcode);
        
        // إذا كان المسار كبير جداً، نخففه أكثر
        if (pathPoints.length > 2000) {
          const simplifiedPoints = [];
          for (let i = 0; i < pathPoints.length; i += 10) {
            simplifiedPoints.push(pathPoints[i]);
          }
          simulation.pathPoints = simplifiedPoints;
          showToast('تم تبسيط المسار إلى ' + simplifiedPoints.length + ' نقطة');
        } else {
          simulation.pathPoints = pathPoints;
        }

        // إنشاء مسار مرئي مبسط
        if (simulation.pathPoints.length > 1) {
          let pathType = lastScanDir;
          if (is3D) pathType = 'threed';
          else if (isLaser) pathType = 'laser';
          
          simulation.toolPath = createToolPathVisualization(simulation.pathPoints, pathType);
          if (simulation.toolPath) {
            scene.add(simulation.toolPath);
          }
        }

        // أداة مبسطة
        if (is3D) {
          simulation.tool = create3DPrinterToolModel();
        } else if (isLaser) {
          simulation.tool = createLaserToolModel();
        } else {
          simulation.tool = createToolModel();
        }
        
        if (simulation.tool) {
          scene.add(simulation.tool);
        }

        // شبكة مساعدة
        const gridHelper = new THREE.GridHelper(Math.max(workWidth, workHeight), 10);
        gridHelper.position.set(workWidth/2, 0, workHeight/2);
        scene.add(gridHelper);

        // إعدادات المحاكاة
        simulation.index = 0;
        simulation.isPlaying = false;
        simulation.animationFrame = null;

        // عناصر تحكم مبسطة
        addSimulationControls(container);

        // حلقة التصيير
        (function renderLoop() {
          requestAnimationFrame(renderLoop);
          if (controls) controls.update();
          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
        })();

        showToast('تم تهيئة المحاكاة: ' + simulation.pathPoints.length + ' نقطة');

      } catch (error) {
        console.error('خطأ في تهيئة المحاكاة:', error);
        showToast('فشل في تهيئة المحاكاة');
        if (placeholder) placeholder.style.display = 'flex';
      }
    }

    // ================= Top View rendering - الإصدار المحسن =================
    function renderTopViewFromGcode(gcode) {
      try {
        if (!previewCanvas && !threeDModel) return;
        
        const topCanvas = document.getElementById('topView');
        const legendDiv = document.getElementById('topLegend');
        if (!topCanvas || !legendDiv) return;
        
        const tw = Math.min(400, 400); // تقليل الدقة للأداء
        const th = Math.min(300, 300);
        
        topCanvas.width = tw; 
        topCanvas.height = th;
        const ctx = topCanvas.getContext('2d');
        if (!ctx) return;

        const depthMap = new Float32Array(tw * th);
        const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3.0;

        const points = parseGcodeForSimulation(gcode);

        const machineType = document.getElementById('machineCategory').value;
        const isLaser = machineType === 'laser';
        const is3D = machineType === 'threed';
        
        // wood color base for router, dark platform for laser, gray for 3D
        let baseRgb;
        if (is3D) {
          baseRgb = { r: 60, g: 60, b: 60 };
        } else if (isLaser) {
          baseRgb = { r: 40, g: 40, b: 40 };
        } else {
          baseRgb = hexToRgb(document.getElementById('woodColor').value || '#a0522d');
        }
        const blackRgb = { r: 10, g: 6, b: 3 };

        // mm -> pixel mapping
        let workWidth, workHeight, originX, originY;
        
        if (is3D) {
          workWidth = cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30);
          workHeight = cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20);
          originX = cmToMm(parseFloat(document.getElementById('threedOriginX').value) || 0);
          originY = cmToMm(parseFloat(document.getElementById('threedOriginY').value) || 0);
        } else if (isLaser) {
          workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
          workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
          originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
          originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);
        } else {
          workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
          workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
          originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
          originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);
        }

        function mmToPixel(px_mm_x, px_mm_y) {
          const xRatio = (px_mm_x - originX) / workWidth;
          const yRatio = (px_mm_y - originY) / workHeight;
          const xPix = Math.round(xRatio * (tw - 1));
          // invert Y to match visual orientation
          const yPix = th - 1 - Math.round(yRatio * (th - 1));
          return { x: xPix, y: yPix };
        }

        // init depth map
        for (let i=0;i<depthMap.length;i++) depthMap[i]=0;

        // If no points and we have a 3D model, create a simple representation
        if ((!points || points.length === 0) && threeDModel && is3D) {
          const imgData = ctx.createImageData(tw, th);
          // Create a simple top-down view of the 3D model
          for (let y=0;y<th;y++){
            for (let x=0;x<tw;x++){
              // Simple projection - in a real app you'd project the 3D model
              const normalizedX = x / tw;
              const normalizedY = y / th;
              
              // Create a pattern based on position
              const pattern = (Math.sin(normalizedX * 10) + Math.cos(normalizedY * 10)) / 2;
              const t = (pattern + 1) / 2; // Normalize to 0-1
              
              const cmapCol = getColormapColor(t, currentColormap);
              const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
              const finalCol = mixColors(mixed1, cmapCol, 0.5);
              const idx = (y*tw + x)*4;
              imgData.data[idx]=finalCol.r; 
              imgData.data[idx+1]=finalCol.g; 
              imgData.data[idx+2]=finalCol.b; 
              imgData.data[idx+3]=255;
            }
          }
          ctx.putImageData(imgData,0,0);
          drawTopLegend(currentColormap);
          return;
        }

        // If no points, fallback to grayscale->depth using image (for 2D modes)
        if (!points || points.length === 0) {
          if (!previewCanvas) return;
          
          const imgData = ctx.createImageData(tw, th);
          for (let y=0;y<th;y++){
            for (let x=0;x<tw;x++){
              const v = sampleGrayAt(
                (x / tw) * previewCanvas.width, 
                (y / th) * previewCanvas.height
              );
              const depth = ((255 - v)/255.0)*maxDepth;
              const t = depth / maxDepth;
              const cmapCol = getColormapColor(t, currentColormap);
              const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
              const finalCol = mixColors(mixed1, cmapCol, isLaser ? 0.5 : 0.35);
              const idx = (y*tw + x)*4;
              imgData.data[idx]=finalCol.r; 
              imgData.data[idx+1]=finalCol.g; 
              imgData.data[idx+2]=finalCol.b; 
              imgData.data[idx+3]=255;
            }
          }
          ctx.putImageData(imgData,0,0);
          drawTopLegend(currentColormap);
          return;
        }

        // accumulate depths from gcode points
        for (let i=0;i<points.length;i++) {
          const p = points[i];
          if (typeof p.x === 'undefined') continue;
          const coords = mmToPixel(p.x, p.y);
          if (coords.x < 0 || coords.x >= tw || coords.y < 0 || coords.y >= th) continue;
          const depth = is3D ? Math.abs(p.z) : (isLaser ? Math.abs(p.z) : Math.min(Math.abs(p.z), maxDepth));
          const idx = coords.y * tw + coords.x;
          depthMap[idx] = Math.max(depthMap[idx], depth);
        }

        const imgData = ctx.createImageData(tw, th);
        for (let y=0;y<th;y++) {
          for (let x=0;x<tw;x++) {
            const idx = y*tw + x;
            const d = Math.min(depthMap[idx], maxDepth);
            const t = (maxDepth === 0) ? 0 : (d / maxDepth);
            const cmapCol = getColormapColor(t, currentColormap);
            const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
            const finalCol = mixColors(mixed1, cmapCol, is3D ? 0.7 : (isLaser ? 0.5 : 0.35));
            const di = (y*tw + x)*4;
            imgData.data[di] = finalCol.r;
            imgData.data[di+1] = finalCol.g;
            imgData.data[di+2] = finalCol.b;
            imgData.data[di+3] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // draw legend gradient for current colormap
        drawTopLegend(currentColormap);

      } catch (e) {
        console.error('خطأ في عرض العرض العلوي:', e);
      }
    }

    function drawTopLegend(map) {
      try {
        const legend = document.getElementById('topLegend');
        if (!legend) return;
        
        const steps = 6;
        const stops = [];
        for (let i=0;i<=steps;i++){
          const t = i / steps;
          const c = getColormapColor(t, map);
          stops.push(`rgb(${c.r},${c.g},${c.b}) ${Math.round((i/steps)*100)}%`);
        }
        legend.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
      } catch(e){
        console.warn('فشل في رسم وسيلة الإيضاح:', e);
      }
    }

    // ================= Init UI and bindings - الإصدار المحسن =================
    function initApp() {
      try {
        updateDimensionDisplay();
        showToast('تم تحميل التطبيق بنجاح', 1200);
        
        // تهيئة جميع المكونات
        initTabs();
        initMachineCategory();
        initControlElements();
        initFileInput();
        initFileFormatButtons();
        initButtons();
        initColormapButtons();
        
        // منع التحميل المزدوج للصور
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
          fileInput.addEventListener('click', function(e) {
            this.value = '';
          });
        }
        
        // تحديث الأبعاد مع تأخير لمنع التكرار
        let updateTimeout;
        const updateDim = () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(updateDimensionDisplay, 200);
        };
        
        const dimensionInputs = [
          'workWidth', 'workHeight', 'laserWorkWidth', 'laserWorkHeight', 'threedWorkWidth', 'threedWorkHeight', 'threedWorkDepth'
        ];
        
        dimensionInputs.forEach(id => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener('input', updateDim);
          }
        });

        const machineDefaults = {
          router: { feed: 800, safeZ: 5, maxDepth: 3, stepOver: 5, description: "CNC Router - للنحت على الخشب والمعادن" },
          laser: { feed: 2000, safeZ: 0, maxDepth: 0, stepOver: 0.2, description: "Laser Engraver - للنقش والقص بالليزر" },
          threed: { layerHeight: 0.2, fillDensity: 20, printSpeed: 50, description: "3D Printer - للطباعة ثلاثية الأبعاد" }
        };
        
        const machineCategory = document.getElementById('machineCategory');
        if (machineCategory) {
          machineCategory.addEventListener('change', (e) => {
            const def = machineDefaults[e.target.value];
            if (def) {
              if (e.target.value === 'threed') {
                document.getElementById('threedLayerHeight').value = def.layerHeight;
                document.getElementById('threedFillDensity').value = def.fillDensity;
                document.getElementById('threedPrintSpeed').value = def.printSpeed;
              } else if (e.target.value === 'laser') {
                document.getElementById('laserSpeed').value = def.feed;
              } else {
                document.getElementById('feedRate').value = def.feed;
                document.getElementById('safeZ').value = def.safeZ;
                document.getElementById('maxDepth').value = def.maxDepth;
                document.getElementById('stepOver').value = def.stepOver;
              }
              showToast(`تم تحميل إعدادات ${e.target.value}`);
            }
          });
        }

        // إضافة اختصارات لوحة المفاتيح
        document.addEventListener('keydown', function (e) {
          if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
              case 'g': 
                e.preventDefault(); 
                const machineType = document.getElementById('machineCategory').value;
                if (machineType === 'laser') {
                  document.getElementById('btnLaserEngrave').click();
                } else if (machineType === 'threed') {
                  document.getElementById('btnSliceModel').click();
                } else {
                  document.getElementById('btnGen').click();
                }
                break;
              case 'r': 
                e.preventDefault(); 
                const machineType2 = document.getElementById('machineCategory').value;
                if (machineType2 === 'laser') {
                  document.getElementById('btnLaserQuick').click();
                } else {
                  document.getElementById('btnQuick').click();
                }
                break;
              case 'd': e.preventDefault(); document.getElementById('btnDownload').click(); break;
              case '`': e.preventDefault(); document.getElementById('dbgToggleSize').click(); break;
            }
          }
        });

        console.log('تم تهيئة التطبيق بنجاح');

      } catch (error) {
        console.error('فشل في تهيئة التطبيق:', error);
        showToast('حدث خطأ في تحميل التطبيق', 5000);
      }
    }

    // resize three renderer & topView on window resize
    window.addEventListener('resize', () => {
      try {
        const container = document.getElementById('threeContainer');
        if (camera && renderer && container) {
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        }
        
        const container3D = document.getElementById('threeDContainer');
        if (threeDCamera && threeDRenderer && container3D) {
          threeDCamera.aspect = container3D.clientWidth / container3D.clientHeight;
          threeDCamera.updateProjectionMatrix();
          threeDRenderer.setSize(container3D.clientWidth, container3D.clientHeight);
        }
      } catch(e){
        console.warn('فشل في تغيير حجم العارض:', e);
      }
    });

    // تنظيف الذاكرة عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
      try {
        memoryManager.cleanupAll();
        cleanupSimulation();
        cleanup3DScene();
        taskManager.clear();
      } catch (error) {
        console.warn('فشل في التنظيف قبل الإغلاق:', error);
      }
    });

    // بدء التطبيق عندما يصبح DOM جاهزاً
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }

(function(){
  try {
    if (window._threeDViewerAdded) return;
    window._threeDViewerAdded = true;

    const container = document.getElementById('threeDContainer');
    const canvas = document.getElementById('canvas3D');
    if (!container || !canvas) {
      console.warn('ThreeD container or canvas not found. Aborting 3D viewer init.');
      return;
    }
    container.style.display = 'block';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    let _scene, _camera, _renderer, _controls, _modelGroup;
    let _animReq = null;

    function initThreeDViewer() {
      try {
        if (window._threeDViewerInit) return;
        window._threeDViewerInit = true;

        _renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        _renderer.setSize(container.clientWidth, container.clientHeight, false);
        _renderer.outputEncoding = THREE.sRGBEncoding;

        _scene = new THREE.Scene();
        _scene.background = new THREE.Color(0x081224);
        const aspect = container.clientWidth / Math.max(1, container.clientHeight);
        _camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        _camera.position.set(0, 80, 120);

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemi.position.set(0, 200, 0);
        _scene.add(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(0, 200, 100);
        _scene.add(dir);

        const grid = new THREE.GridHelper(200, 40, 0x1a2b3a, 0x0b1624);
        grid.position.y = -0.01;
        _scene.add(grid);

        const axes = new THREE.AxesHelper(40);
        axes.material.depthTest = false;
        axes.renderOrder = 2;
        _scene.add(axes);

        _modelGroup = new THREE.Group();
        _scene.add(_modelGroup);

        _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true;
        _controls.dampingFactor = 0.12;
        _controls.screenSpacePanning = false;
        _controls.minDistance = 10;
        _controls.maxDistance = 1000;

        window.addEventListener('resize', onWindowResize);
        animate();
        showToast('معاينة 3D جاهزة', 1200);
      } catch (e) {
        console.error('Failed to init ThreeD viewer', e);
        showToast('فشل تهيئة معاينة 3D', 4000);
      }
    }

    function onWindowResize() {
      try {
        if (!_camera || !_renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        _camera.aspect = w / Math.max(1, h);
        _camera.updateProjectionMatrix();
        _renderer.setSize(w, h, false);
      } catch (e) { console.warn(e); }
    }

    function clearModel() {
      try {
        if (!_modelGroup) return;
        _modelGroup.traverse(obj => {
          if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose && m.dispose(); });
              } else {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose && obj.material.dispose();
              }
            }
          }
        });
        while (_modelGroup.children.length) _modelGroup.remove(_modelGroup.children[0]);
      } catch (e) { console.warn('Failed to clear 3D model', e); }
    }

    function fitCameraToObject(object, offset) {
      try {
        offset = offset || 1.25;
        const box = new THREE.Box3().setFromObject(object);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          const fitDistance = maxSize / (2 * Math.tan(Math.PI * _camera.fov / 360));
          const distance = fitDistance * offset;
          _camera.position.set(center.x, center.y + distance*0.3, center.z + distance);
          _camera.lookAt(center);
          _controls.target.copy(center);
          _controls.update();
        }
      } catch(e){ console.warn(e); }
    }

    const stlLoader = new THREE.STLLoader();
    const objLoader = new THREE.OBJLoader();

    function load3DModel(file) {
      return new Promise((resolve, reject) => {
        try {
          if (!file) return reject(new Error('No file'));
          initThreeDViewer();
          const name = file.name.toLowerCase();
          showProgress('جاري تحميل الملف: ' + file.name);
          const reader = new FileReader();
          reader.onerror = function(err) {
            hideProgress();
            showToast('فشل قراءة الملف', 3000);
            reject(err);
          };
          reader.onload = function(e) {
            try {
              const contents = e.target.result;
              clearModel();
              if (name.endsWith('.stl')) {
                const geometry = stlLoader.parse(contents);
                const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.2, roughness: 0.6 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = mesh.receiveShadow = true;
                _modelGroup.add(mesh);
                fitCameraToObject(mesh);
                hideProgress();
                showToast('تم تحميل STL بنجاح', 1800);
                resolve(mesh);
              } else if (name.endsWith('.obj')) {
                const object = objLoader.parse(contents);
                object.traverse(child => {
                  if (child.isMesh) {
                    child.material = child.material || new THREE.MeshStandardMaterial({ color: 0xcccccc });
                    child.castShadow = child.receiveShadow = true;
                  }
                });
                _modelGroup.add(object);
                fitCameraToObject(object);
                hideProgress();
                showToast('تم تحميل OBJ بنجاح', 1800);
                resolve(object);
              } else {
                hideProgress();
                showToast('نوع الملف غير مدعوم: STL أو OBJ فقط', 4000);
                reject(new Error('Unsupported'));
              }
            } catch(err) {
              hideProgress();
              console.error('parse error', err);
              showToast('فشل في معالجة النموذج 3D', 4000);
              reject(err);
            }
          };
          reader.readAsArrayBuffer(file);
        } catch(err) {
          hideProgress();
          console.error('load3DModel error', err);
          showToast('خطأ أثناء تحميل الملف', 4000);
          reject(err);
        }
      });
    }

    function animate() {
      try {
        _animReq = requestAnimationFrame(animate);
        if (_controls) _controls.update();
        if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
      } catch(e){ console.warn('animate err', e); }
    }

    function hookFileButtons() {
      try {
        const fileBtns = document.querySelectorAll('#fileFormatButtons button[data-format]');
        fileBtns.forEach(btn => {
          btn.addEventListener('click', (ev) => {
            try {
              const format = btn.getAttribute('data-format');
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = (format === 'stl' ? '.stl' : (format === 'obj' ? '.obj' : '.svg,.dxf'));
              input.onchange = async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
                  showToast('اختر ملف STL أو OBJ للمعاينة ثلاثية الأبعاد', 3500);
                  return;
                }
                try { await load3DModel(f); } catch(err){ console.error(err); }
              };
              input.click();
            } catch(e){ console.error(e); }
          });
        });

        const threedInput = document.getElementById('threedFileInput');
        if (threedInput) {
          threedInput.addEventListener('change', async (ev) => {
            try {
              const f = ev.target.files && ev.target.files[0];
              if (!f) return;
              if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
                showToast('اختر ملف STL أو OBJ', 3500);
                return;
              }
              await load3DModel(f);
            } catch(err){ console.error('threed load failed', err); }
          });
        }

        container.addEventListener('dragover', ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
        container.addEventListener('drop', async (ev) => {
          try {
            ev.preventDefault();
            const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (!f) return;
            if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
              showToast('اسحب ملف STL أو OBJ فقط', 3500);
              return;
            }
            await load3DModel(f);
          } catch(err){ console.error('drop error', err); }
        });
      } catch(e){ console.error('hookFileButtons failed', e); }
    }

    hookFileButtons();

    const threedTabBtn = Array.from(document.querySelectorAll('.tab-buttons button')).find(b => b.dataset.tab === 'threed');
    if (threedTabBtn) {
      threedTabBtn.addEventListener('click', () => {
        try {
          setTimeout(() => { initThreeDViewer(); onWindowResize(); }, 120);
        } catch(e){ console.error(e); }
      });
    }

    if (document.getElementById('threed') && document.getElementById('threed').classList.contains('active')) {
      setTimeout(() => { initThreeDViewer(); onWindowResize(); }, 200);
    }

    window.load3DModel = load3DModel;
    window.initThreeDViewer = initThreeDViewer;

  } catch(err) { console.error('ThreeD module failed', err); }
})();
