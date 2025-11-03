// === CncAi — Analysis Module v3.1.0 (Fixed Errors + Enhanced Auto-Attach) ===
window.Analysis = (function () {
  const Config = {
    CANNY_THRESHOLD: [80, 150],
    ANALYSIS_TIMEOUT: 30000,
    DEFAULT_COLORMAP: "JET",
    AUTO_ATTACH_POLL_INTERVAL: 500, // زيادة الفاصل
    MAX_AUTO_ATTACH_TRIES: 60, // تقليل المحاولات
    EXPORT_TYPES: ['json', 'csv', 'image', 'report']
  };

  const EventTypes = {
    ANALYSIS_START: 'analysis_start',
    ANALYSIS_COMPLETE: 'analysis_complete',
    ERROR: 'error',
    IMAGE_LOADED: 'image_loaded',
    PREVIEW_UPDATED: 'preview_updated',
    AUTO_ATTACH_FAILED: 'auto_attach_failed'
  };

  const Module = {
    canvas: null,
    ctx: null,
    srcMat: null,
    grayMat: null,
    mode: "edges",
    ready: false,
    autoAttached: false,
    currentMap: "JET",
    currentAnalysis: null,
    _events: {},
    _autoAttachInterval: null,

    // --- التهيئة ---
    init() {
      try {
        this.canvas = document.getElementById("analysisCanvas");
        if (!this.canvas) {
          console.warn("⚠️ Canvas element not found, retrying...");
          setTimeout(() => this.init(), 1000);
          return;
        }
        
        this.ctx = this.canvas.getContext("2d");
        console.log("✅ Canvas initialized successfully");

        this.setupEventListeners();
        this.tryAutoAttach();
        this.ready = true;
        
        console.log("✅ Analysis module initialized v3.1.0");
      } catch (error) {
        console.error("❌ Init failed:", error);
      }
    },

    // --- إعداد مستمعي الأحداث ---
    setupEventListeners() {
      try {
        // أوضاع التحليل
        const analysisModes = document.querySelectorAll(".analysis-modes button");
        if (analysisModes.length > 0) {
          analysisModes.forEach(btn => {
            btn.addEventListener("click", () => {
              this.mode = btn.dataset.mode;
              this.safeUpdatePreview();
            });
          });
        }

        // زر التحليل الموحد
        const runBtn = document.getElementById("runFullAnalysis");
        if (runBtn) {
          runBtn.addEventListener("click", () => this.runUnifiedAnalysis());
        }

        // زر التصدير
        const expBtn = document.getElementById("exportAnalysis");
        if (expBtn) {
          expBtn.addEventListener("click", () => this.export());
        }

        // أزرار خريطة الألوان
        const colormapButtons = document.querySelectorAll(".colormap-selector button");
        if (colormapButtons.length > 0) {
          colormapButtons.forEach(btn => {
            btn.addEventListener("click", () => {
              document.querySelectorAll(".colormap-selector button").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              this.currentMap = btn.dataset.map;
              this.safeUpdatePreview();
            });
          });
        }

        // زر التحميل اليدوي
        const loadBtn = document.getElementById("loadAnalysisImage");
        if (loadBtn) {
          loadBtn.addEventListener("click", () => this.manualImageLoad());
        }

        console.log("✅ Event listeners setup completed");
      } catch (error) {
        console.error("❌ Event listeners setup failed:", error);
      }
    },

    // --- تحميل الصورة يدوياً ---
    manualImageLoad() {
      console.log("🔄 Manual image load requested");
      this.tryAutoAttach(true);
    },

    // --- تحديث المعاينة الآمن ---
    safeUpdatePreview() {
      try {
        this.updatePreview();
      } catch (error) {
        console.error("❌ Safe preview update failed:", error);
        this.handlePreviewError(error);
      }
    },

    // --- معالجة أخطاء المعاينة ---
    handlePreviewError(error) {
      if (this.canvas && this.ctx) {
        // رسم رسالة خطأ على Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#dc3545';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('خطأ في تحميل الصورة', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.fillText('الرجاء تحميل صورة جديدة', this.canvas.width / 2, this.canvas.height / 2 + 30);
      }
      
      this.emit(EventTypes.ERROR, { 
        message: "خطأ في عرض المعاينة", 
        error: error.message 
      });
    },

    // --- انتظار مكتبة OpenCV ---
    waitForOpenCVAndInit() {
      console.log("🔄 Waiting for OpenCV...");
      
      if (typeof cv !== "undefined" && cv && cv.Mat) {
        console.log("✅ OpenCV found, initializing...");
        this.init();
        return;
      }

      if (cv && cv['onRuntimeInitialized']) {
        console.log("🔄 OpenCV runtime initializing...");
        cv['onRuntimeInitialized'] = () => {
          console.log("✅ OpenCV runtime ready");
          this.init();
        };
        return;
      }

      // Polling method
      let tries = 0;
      const maxTries = 50; // 12.5 second timeout
      
      const checkOpenCV = setInterval(() => {
        tries++;
        
        if (typeof cv !== "undefined" && cv && cv.Mat) {
          clearInterval(checkOpenCV);
          console.log("✅ OpenCV loaded after polling");
          this.init();
          return;
        }
        
        if (tries >= maxTries) {
          clearInterval(checkOpenCV);
          console.error("❌ OpenCV loading timeout");
          this.emit(EventTypes.ERROR, { 
            message: "فشل تحميل مكتبة OpenCV" 
          });
        }
      }, 250);
    },

    // --- تحميل الصورة للتحليل ---
    loadImage(mat) {
      if (!this.ready) {
        console.warn("⚠️ Analysis module not ready");
        return false;
      }
      
      if (!mat || !(mat instanceof cv.Mat)) {
        console.error("❌ Invalid matrix provided");
        this.emit(EventTypes.ERROR, { message: "مصفوفة غير صالحة" });
        return false;
      }

      // التحقق من حالة المصفوفة
      if (mat.isDeleted || mat.empty()) {
        console.error("❌ Matrix is deleted or empty");
        this.emit(EventTypes.ERROR, { message: "الصورة غير صالحة أو محذوفة" });
        return false;
      }

      try {
        // تنظيف الذاكرة القديمة
        this.destroy();

        this.srcMat = mat.clone();
        this.grayMat = new cv.Mat();

        // التحويل إلى تدرج الرمادي
        if (this.srcMat.channels() === 1) {
          this.srcMat.copyTo(this.grayMat);
        } else {
          cv.cvtColor(this.srcMat, this.grayMat, cv.COLOR_RGBA2GRAY);
        }

        // التحقق من نجاح التحويل
        if (this.grayMat.empty()) {
          throw new Error("Failed to convert image to grayscale");
        }

        // ضبط أبعاد Canvas
        this.canvas.width = this.grayMat.cols;
        this.canvas.height = this.grayMat.rows;
        
        console.log(`✅ Image loaded: ${this.grayMat.cols}x${this.grayMat.rows}`);

        // تحديث المعاينة
        this.safeUpdatePreview();

        this.emit(EventTypes.IMAGE_LOADED, { 
          width: this.grayMat.cols, 
          height: this.grayMat.rows 
        });

        return true;
        
      } catch (error) {
        console.error("❌ Image loading error:", error);
        this.emit(EventTypes.ERROR, { 
          message: "فشل تحميل الصورة", 
          error: error.message 
        });
        this.destroy(); // تنظيف في حالة الخطأ
        return false;
      }
    },

    // --- محاولة الربط التلقائي مع الصورة ---
    tryAutoAttach(force = false) {
      if (this.autoAttached && !force) return;

      // إيقاف أي محاولة سابقة
      if (this._autoAttachInterval) {
        clearInterval(this._autoAttachInterval);
      }

      console.log("🔄 Starting auto-attach process...");

      const cands = [
        () => window.currentImageMat,
        () => window.imageMat,
        () => (window.SmartCNC && window.SmartCNC.imageMat),
        () => (window.SmartCNC && window.SmartCNC.currentImageMat),
        () => (window.CNC_Editor && window.CNC_Editor.currentMat),
        () => (window.ImageProcessor && window.ImageProcessor.sourceMat)
      ];

      let tries = 0;
      this._autoAttachInterval = setInterval(() => {
        tries++;
        
        for (let i = 0; i < cands.length; i++) {
          try {
            const m = cands[i]();
            if (m && m instanceof cv.Mat && !m.isDeleted && !m.empty()) {
              console.log(`✅ Found image matrix from source ${i}`);
              
              if (this.loadImage(m)) {
                this.autoAttached = true;
                clearInterval(this._autoAttachInterval);
                this._autoAttachInterval = null;
                return;
              }
            }
          } catch (e) {
            // تجاهل الأخطاء في البحث
          }
        }

        if (tries >= Config.MAX_AUTO_ATTACH_TRIES) {
          clearInterval(this._autoAttachInterval);
          this._autoAttachInterval = null;
          console.log("ℹ️ Auto-attach timeout - no image found");
          this.emit(EventTypes.AUTO_ATTACH_FAILED, { tries });
          
          // عرض رسالة للمستخدم
          this.showUserMessage("لم يتم العثور على صورة تلقائياً. الرجاء تحميل صورة يدوياً.", "warning");
        }
      }, Config.AUTO_ATTACH_POLL_INTERVAL);
    },

    // --- عرض رسالة للمستخدم ---
    showUserMessage(message, type = "info") {
      const messageEl = document.getElementById("analysisMessage") || this.createMessageElement();
      messageEl.textContent = message;
      messageEl.className = `analysis-message ${type}`;
      messageEl.style.display = 'block';

      // إخفاء تلقائي بعد 5 ثواني
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 5000);
    },

    // --- إنشاء عنصر الرسالة ---
    createMessageElement() {
      const messageEl = document.createElement("div");
      messageEl.id = "analysisMessage";
      messageEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        padding: 15px 20px; border-radius: 5px; z-index: 10000;
        font-family: Arial, sans-serif; font-size: 14px;
        max-width: 300px; display: none;
      `;
      
      document.body.appendChild(messageEl);
      return messageEl;
    },

    // --- تحديث المعاينة ---
    updatePreview() {
      if (!this.grayMat || this.grayMat.empty() || this.grayMat.isDeleted) {
        console.warn("⚠️ No valid image for preview");
        this.handlePreviewError(new Error("No image available"));
        return;
      }

      const dst = new cv.Mat();
      try {
        // التحقق من أبعاد الصورة
        if (this.grayMat.cols === 0 || this.grayMat.rows === 0) {
          throw new Error("Invalid image dimensions");
        }

        switch (this.mode) {
          case "edges":
            cv.Canny(this.grayMat, dst, ...Config.CANNY_THRESHOLD);
            break;
          case "contrast":
            cv.Laplacian(this.grayMat, dst, cv.CV_8U);
            break;
          case "heatmap":
            cv.cvtColor(this.grayMat, dst, cv.COLOR_GRAY2RGBA);
            const mapName = this.currentMap || Config.DEFAULT_COLORMAP;
            const colormap = cv[`COLORMAP_${mapName}`];
            if (colormap !== undefined) {
              cv.applyColorMap(dst, dst, colormap);
            } else {
              cv.applyColorMap(dst, dst, cv.COLORMAP_JET);
            }
            break;
          case "topview":
            cv.normalize(this.grayMat, dst, 0, 255, cv.NORM_MINMAX);
            cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
            break;
          default:
            this.grayMat.copyTo(dst);
        }

        // التحقق من المصفوفة الهدف قبل العرض
        if (dst.empty() || dst.isDeleted) {
          throw new Error("Destination matrix is invalid");
        }

        cv.imshow(this.canvas, dst);
        this.emit(EventTypes.PREVIEW_UPDATED, { mode: this.mode });
        
      } catch (error) {
        console.error("❌ updatePreview error:", error);
        throw error; // إعادة رمي الخطأ للمعالجة في safeUpdatePreview
      } finally {
        // تنظيف الذاكرة بشكل آمن
        if (dst && !dst.isDeleted) {
          dst.delete();
        }
      }
    },

    // --- التحليل الموحد (مع معالجة أخطاء محسنة) ---
    runUnifiedAnalysis() {
      if (this.currentAnalysis) {
        this.showUserMessage("جاري تحليل سابق بالفعل...", "warning");
        return;
      }

      if (!this.grayMat || this.grayMat.empty() || this.grayMat.isDeleted) {
        this.showUserMessage("لا توجد صورة صالحة للتحليل", "error");
        this.emit(EventTypes.ERROR, { message: "لا توجد صورة للتحليل" });
        return;
      }

      this.currentAnalysis = true;
      this.showLoading("جاري التحليل...");
      this.emit(EventTypes.ANALYSIS_START);

      const mats = []; // لتتبع المصفوفات المؤقتة

      try {
        // ... (بقية كود التحليل بدون تغيير)
        // [الكود السابق يبقى كما هو مع إضافة try-catch]
        
      } catch (error) {
        console.error("❌ Analysis error:", error);
        this.showUserMessage("فشل في التحليل: " + error.message, "error");
        this.emit(EventTypes.ERROR, { 
          message: "خطأ في التحليل", 
          error: error.message 
        });
      } finally {
        // تنظيف الذاكرة بشكل آمن
        mats.forEach(mat => {
          try {
            if (mat && !mat.isDeleted) {
              mat.delete();
            }
          } catch (e) {
            console.warn("⚠️ Error deleting matrix:", e);
          }
        });
        
        this.hideLoading();
        this.currentAnalysis = false;
      }
    },

    // --- تنظيف الذاكرة المحسنة ---
    destroy() {
      try {
        if (this.srcMat && !this.srcMat.isDeleted) { 
          this.srcMat.delete(); 
        }
        if (this.grayMat && !this.grayMat.isDeleted) { 
          this.grayMat.delete(); 
        }
        
        // إيقاف عملية الربط التلقائي
        if (this._autoAttachInterval) {
          clearInterval(this._autoAttachInterval);
          this._autoAttachInterval = null;
        }
      } catch (error) {
        console.warn("⚠️ Error during cleanup:", error);
      } finally {
        this.srcMat = null;
        this.grayMat = null;
        this.ready = false;
        this.autoAttached = false;
        this.currentAnalysis = null;
      }
      
      console.log("🧹 Analysis module cleaned up");
    },

    // ... (بقية الدوال تبقى كما هي)
    // [الحفاظ على الدوال الأخرى من الإصدار السابق]
  };

  // --- تشغيل الوحدة ---
  setTimeout(() => {
    console.log("🚀 Starting Analysis Module...");
    Module.waitForOpenCVAndInit();
  }, 100);

  return Module;
})();
