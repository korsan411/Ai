// === CncAi — Analysis Module v3.0.0 (AI Enhanced + Colormap Selector) ===
window.Analysis = (function () {
  const Config = {
    CANNY_THRESHOLD: [80, 150],
    ANALYSIS_TIMEOUT: 30000,
    DEFAULT_COLORMAP: "JET",
    AUTO_ATTACH_POLL_INTERVAL: 250,
    MAX_AUTO_ATTACH_TRIES: 120,
    EXPORT_TYPES: ['json', 'csv', 'image', 'report']
  };

  const EventTypes = {
    ANALYSIS_START: 'analysis_start',
    ANALYSIS_COMPLETE: 'analysis_complete',
    ERROR: 'error',
    IMAGE_LOADED: 'image_loaded',
    PREVIEW_UPDATED: 'preview_updated'
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

    // --- التهيئة ---
    init() {
      this.canvas = document.getElementById("analysisCanvas");
      if (!this.canvas) {
        console.error("❌ Canvas element not found");
        return;
      }
      this.ctx = this.canvas.getContext("2d");

      // أوضاع التحليل (حواف، تباين، كثافة...)
      document.querySelectorAll(".analysis-modes button").forEach(btn => {
        btn.addEventListener("click", () => {
          this.mode = btn.dataset.mode;
          this.updatePreview();
          this.emit(EventTypes.PREVIEW_UPDATED, { mode: this.mode });
        });
      });

      // زر التحليل الموحد
      const runBtn = document.getElementById("runFullAnalysis");
      if (runBtn) runBtn.addEventListener("click", () => this.runUnifiedAnalysis());

      // زر التصدير
      const expBtn = document.getElementById("exportAnalysis");
      if (expBtn) expBtn.addEventListener("click", () => this.export());

      // أزرار اختيار خريطة الألوان
      document.querySelectorAll(".colormap-selector button").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".colormap-selector button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentMap = btn.dataset.map;
          this.updatePreview();
        });
      });

      // زر التحميل اليدوي
      const loadBtn = document.getElementById("loadAnalysisImage");
      if (loadBtn) loadBtn.addEventListener("click", () => this.tryAutoAttach());

      this.tryAutoAttach();
      this.ready = true;
      console.log("✅ Analysis module initialized v3.0.0");
    },

    // --- نظام الأحداث ---
    on(event, callback) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(callback);
    },

    emit(event, data) {
      if (this._events[event]) {
        this._events[event].forEach(callback => callback(data));
      }
    },

    // --- انتظار مكتبة OpenCV ---
    waitForOpenCVAndInit() {
      if (typeof cv !== "undefined" && cv && cv.Mat) {
        this.init();
      } else if (cv && cv['onRuntimeInitialized']) {
        cv['onRuntimeInitialized'] = () => this.init();
      } else {
        const t = setInterval(() => {
          if (typeof cv !== "undefined" && cv && cv.Mat) {
            clearInterval(t);
            this.init();
          }
        }, 250);
      }
    },

    // --- تحميل الصورة للتحليل ---
    loadImage(mat) {
      if (!this.ready) {
        console.warn("⚠️ Analysis module not ready");
        return false;
      }
      
      if (!mat || !(mat instanceof cv.Mat)) {
        this.emit(EventTypes.ERROR, { message: "مصفوفة غير صالحة" });
        return false;
      }

      if (mat.empty()) {
        this.emit(EventTypes.ERROR, { message: "الصورة فارغة" });
        return false;
      }

      // تنظيف الذاكرة القديمة
      this.destroy();

      this.srcMat = mat.clone();
      this.grayMat = new cv.Mat();

      if (this.srcMat.channels() === 1) {
        this.srcMat.copyTo(this.grayMat);
      } else {
        cv.cvtColor(this.srcMat, this.grayMat, cv.COLOR_RGBA2GRAY);
      }

      this.canvas.width = this.grayMat.cols;
      this.canvas.height = this.grayMat.rows;
      this.updatePreview();

      this.emit(EventTypes.IMAGE_LOADED, { 
        width: this.grayMat.cols, 
        height: this.grayMat.rows 
      });

      console.log("✅ Analysis image loaded successfully");
      return true;
    },

    // --- محاولة الربط التلقائي مع الصورة ---
    tryAutoAttach() {
      if (this.autoAttached) return;

      const cands = [
        () => window.currentImageMat,
        () => window.imageMat,
        () => (window.SmartCNC && window.SmartCNC.imageMat),
        () => (window.SmartCNC && window.SmartCNC.currentImageMat)
      ];

      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        for (const fn of cands) {
          try {
            const m = fn();
            if (m && m instanceof cv.Mat) {
              this.loadImage(m);
              this.autoAttached = true;
              clearInterval(poll);
              console.log("✅ Auto-attached to image matrix");
              return;
            }
          } catch (e) {
            // تجاهل الأخطاء في البحث
          }
        }
        if (tries > Config.MAX_AUTO_ATTACH_TRIES) {
          clearInterval(poll);
          console.log("ℹ️ Auto-attach timeout");
        }
      }, Config.AUTO_ATTACH_POLL_INTERVAL);
    },

    // --- تحديث المعاينة ---
    updatePreview() {
      if (!this.grayMat || this.grayMat.empty()) {
        if (this.canvas && this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        return;
      }

      const dst = new cv.Mat();
      try {
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
            if (cv[`COLORMAP_${mapName}`]) {
              cv.applyColorMap(dst, dst, cv[`COLORMAP_${mapName}`]);
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
        cv.imshow(this.canvas, dst);
      } catch (e) {
        console.error("❌ updatePreview error:", e);
        this.emit(EventTypes.ERROR, { message: "خطأ في تحديث المعاينة", error: e });
      } finally {
        dst.delete();
      }
    },

    // --- التحليل الموحد (كامل + ذكي) ---
    runUnifiedAnalysis() {
      if (this.currentAnalysis) {
        console.log("⚠️ Analysis already in progress");
        return;
      }

      if (!this.grayMat || this.grayMat.empty()) {
        this.emit(EventTypes.ERROR, { message: "لا توجد صورة للتحليل" });
        return;
      }

      this.currentAnalysis = true;
      this.showLoading("جاري التحليل...");
      this.emit(EventTypes.ANALYSIS_START);

      const mats = []; // لتتبع المصفوفات المؤقتة

      try {
        // تحليل الحواف
        const edges = new cv.Mat(); mats.push(edges);
        cv.Canny(this.grayMat, edges, ...Config.CANNY_THRESHOLD);
        const edgeCount = cv.countNonZero(edges);

        // تحليل التباين
        const mean = new cv.Mat(); mats.push(mean);
        const stddev = new cv.Mat(); mats.push(stddev);
        cv.meanStdDev(this.grayMat, mean, stddev);
        const contrastVal = Math.round(stddev.data64F ? stddev.data64F[0] : stddev.data[0]);

        // تحليل الملمس
        const texture = new cv.Mat(); mats.push(texture);
        cv.Laplacian(this.grayMat, texture, cv.CV_8U);
        const textureVal = Math.min(100, Math.round((cv.countNonZero(texture) / (this.grayMat.rows * this.grayMat.cols)) * 400));

        // تحليل الاتجاه
        const gradX = new cv.Mat(); mats.push(gradX);
        const gradY = new cv.Mat(); mats.push(gradY);
        cv.Sobel(this.grayMat, gradX, cv.CV_32F, 1, 0);
        cv.Sobel(this.grayMat, gradY, cv.CV_32F, 0, 1);
        const meanGradX = cv.mean(gradX)[0];
        const meanGradY = cv.mean(gradY)[0];
        const orientationAngle = Math.abs(meanGradX) > Math.abs(meanGradY) ? "أفقي (X)" : "رأسي (Y)";

        // تحليل الحدة
        const sharpness = this.calculateSharpness();

        // إنشاء صورة النتيجة
        const colorReady = new cv.Mat(); mats.push(colorReady);
        cv.addWeighted(edges, 0.5, texture, 0.5, 0, colorReady);
        const mapName = this.currentMap || Config.DEFAULT_COLORMAP;
        try {
          cv.applyColorMap(colorReady, colorReady, cv[`COLORMAP_${mapName}`] || cv.COLORMAP_JET);
        } catch {
          cv.cvtColor(colorReady, colorReady, cv.COLOR_GRAY2RGBA);
        }
        cv.imshow(this.canvas, colorReady);

        // حساب النتائج النهائية
        const totalPixels = this.grayMat.rows * this.grayMat.cols;
        const detailDensity = Math.min(100, Math.round((edgeCount / totalPixels) * 100));
        
        // التوصية الذكية
        const recommendation = this.generateRecommendation(detailDensity, contrastVal, sharpness);

        // عرض النتائج
        this.displayResults({
          edgeCount,
          contrastVal,
          detailDensity,
          textureVal,
          orientationAngle,
          sharpness,
          recommendation
        });

        this.emit(EventTypes.ANALYSIS_COMPLETE, {
          edgeCount,
          contrastVal,
          detailDensity,
          textureVal,
          orientationAngle,
          sharpness,
          recommendation
        });

      } catch (error) {
        console.error("❌ Analysis error:", error);
        this.emit(EventTypes.ERROR, { message: "خطأ في التحليل", error });
      } finally {
        // تنظيف الذاكرة
        mats.forEach(mat => !mat.isDeleted() && mat.delete());
        this.hideLoading();
        this.currentAnalysis = false;
      }
    },

    // --- حساب حدة الصورة ---
    calculateSharpness() {
      if (!this.grayMat || this.grayMat.empty()) return 0;
      
      const laplacian = new cv.Mat();
      try {
        cv.Laplacian(this.grayMat, laplacian, cv.CV_64F);
        const mean = cv.mean(laplacian);
        const sharpness = Math.round(Math.abs(mean[0]) * 100) / 100;
        return sharpness;
      } finally {
        laplacian.delete();
      }
    },

    // --- توليد التوصية الذكية ---
    generateRecommendation(detailDensity, contrastVal, sharpness) {
      if (detailDensity > 70 && contrastVal > 50 && sharpness > 30) {
        return "Router CNC عالي الدقة (مثالي للنقش التفصيلي)";
      } else if (detailDensity > 40 && contrastVal > 30) {
        return "ليزر عالي الدقة (مناسب للنقش الناعم)";
      } else if (detailDensity > 20) {
        return "ليزر عادي (للرسومات البسيطة)";
      } else if (sharpness < 10) {
        return "تحسين الإضاءة والتركيز أولاً";
      } else {
        return "غير مناسب للنقش التفصيلي - جرب تحويل إلى Vector";
      }
    },

    // --- عرض النتائج في الواجهة ---
    displayResults(results) {
      const put = (id, val) => { 
        const el = document.getElementById(id); 
        if (el) el.textContent = val; 
      };

      put("edgeCount", results.edgeCount.toLocaleString('ar-EG'));
      put("contrastValue", results.contrastVal + "%");
      put("detailDensity", results.detailDensity + "%");
      put("textureValue", results.textureVal + "%");
      put("orientationValue", results.orientationAngle);
      put("sharpnessValue", results.sharpness);
      put("analysisRecommendation", results.recommendation);
    },

    // --- شاشة التحميل ---
    showLoading(message = "جاري التحليل...") {
      let loadingEl = document.getElementById("analysisLoading");
      if (!loadingEl) {
        loadingEl = document.createElement("div");
        loadingEl.id = "analysisLoading";
        loadingEl.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px;
          z-index: 1000; font-family: Arial, sans-serif;
        `;
        document.body.appendChild(loadingEl);
      }
      loadingEl.textContent = message;
      loadingEl.style.display = 'block';
    },

    hideLoading() {
      const loadingEl = document.getElementById("analysisLoading");
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
    },

    // --- التصدير المتعدد ---
    export(type = 'json') {
      if (!Config.EXPORT_TYPES.includes(type)) {
        type = 'json';
      }

      const results = this.getCurrentResults();
      
      switch (type) {
        case 'json':
          this.exportJSON(results);
          break;
        case 'csv':
          this.exportCSV(results);
          break;
        case 'image':
          this.exportImage();
          break;
        case 'report':
          this.exportHTMLReport(results);
          break;
      }
    },

    // --- الحصول على النتائج الحالية ---
    getCurrentResults() {
      return {
        edges: document.getElementById("edgeCount")?.textContent || "N/A",
        contrast: document.getElementById("contrastValue")?.textContent || "N/A",
        density: document.getElementById("detailDensity")?.textContent || "N/A",
        texture: document.getElementById("textureValue")?.textContent || "N/A",
        orientation: document.getElementById("orientationValue")?.textContent || "N/A",
        sharpness: document.getElementById("sharpnessValue")?.textContent || "N/A",
        recommendation: document.getElementById("analysisRecommendation")?.textContent || "N/A",
        timestamp: new Date().toLocaleString('ar-EG')
      };
    },

    // --- تصدير JSON ---
    exportJSON(results) {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
      this.downloadFile(blob, "analysis-results.json");
    },

    // --- تصدير CSV ---
    exportCSV(results) {
      const csvContent = Object.entries(results)
        .map(([key, value]) => `"${key}","${value}"`)
        .join('\n');
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv; charset=utf-8;" });
      this.downloadFile(blob, "analysis-results.csv");
    },

    // --- تصدير الصورة ---
    exportImage() {
      const link = document.createElement('a');
      link.download = 'analysis-preview.png';
      link.href = this.canvas.toDataURL();
      link.click();
    },

    // --- تصدير تقرير HTML ---
    exportHTMLReport(results) {
      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير التحليل - ${new Date().toLocaleDateString('ar-SA')}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .report-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .timestamp {
            opacity: 0.8;
            margin-top: 10px;
        }
        .results-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .result-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border-right: 5px solid #3498db;
            transition: transform 0.3s ease;
        }
        .result-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .result-item.important {
            border-right-color: #e74c3c;
            background: #fff5f5;
        }
        .result-label {
            font-weight: bold;
            color: #2c3e50;
            display: block;
            margin-bottom: 8px;
            font-size: 16px;
        }
        .result-value {
            color: #27ae60;
            font-size: 18px;
            font-weight: bold;
        }
        .recommendation {
            grid-column: 1 / -1;
            text-align: center;
            font-size: 20px;
            color: #e74c3c;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>تقرير تحليل الصورة المتقدم</h1>
            <div class="timestamp">${results.timestamp}</div>
        </div>
        <div class="results-grid">
            <div class="result-item">
                <span class="result-label">عدد الحواف</span>
                <span class="result-value">${results.edges}</span>
            </div>
            <div class="result-item">
                <span class="result-label">نسبة التباين</span>
                <span class="result-value">${results.contrast}</span>
            </div>
            <div class="result-item">
                <span class="result-label">كثافة التفاصيل</span>
                <span class="result-value">${results.density}</span>
            </div>
            <div class="result-item">
                <span class="result-label">قيمة الملمس</span>
                <span class="result-value">${results.texture}</span>
            </div>
            <div class="result-item">
                <span class="result-label">الاتجاه السائد</span>
                <span class="result-value">${results.orientation}</span>
            </div>
            <div class="result-item">
                <span class="result-label">حدة الصورة</span>
                <span class="result-value">${results.sharpness}</span>
            </div>
            <div class="result-item important recommendation">
                <span class="result-label">التوصية:</span><br>
                <span class="result-value">${results.recommendation}</span>
            </div>
        </div>
    </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      this.downloadFile(blob, 'تقرير-التحليل.html');
    },

    // --- تحميل الملف ---
    downloadFile(blob, filename) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    },

    // --- تنظيف الذاكرة ---
    destroy() {
      if (this.srcMat) { 
        this.srcMat.delete(); 
        this.srcMat = null; 
      }
      if (this.grayMat) { 
        this.grayMat.delete(); 
        this.grayMat = null; 
      }
      this.ready = false;
      this.autoAttached = false;
      this.currentAnalysis = null;
      
      console.log("🧹 Analysis module cleaned up");
    }
  };

  // --- تشغيل الوحدة ---
  setTimeout(() => Module.waitForOpenCVAndInit(), 10);
  return Module;
})();
