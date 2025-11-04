// === CncAi — Analysis Module v3.1.3 (Fixed Annoying Messages) ===
window.Analysis = (function () {
  const Module = {
    canvas: null,
    ctx: null,
    srcMat: null,
    grayMat: null,
    mode: "edges",
    ready: false,
    autoAttached: false,
    currentMap: "JET",
    _initialized: false,
    _loadImageRetryCount: 0,
    _maxRetryCount: 5,

    // --- التهيئة ---
    init() {
      if (this._initialized) {
        return;
      }

      console.log("🔄 Starting Analysis module initialization...");
      
      this.canvas = this.findCanvas();
      if (!this.canvas) {
        console.log("⏳ Canvas not found, delaying initialization...");
        setTimeout(() => this.init(), 500);
        return;
      }
      
      this.ctx = this.canvas.getContext("2d");
      console.log("✅ Analysis canvas initialized");

      this.initUI();
      
      this.ready = true;
      this._initialized = true;
      console.log("✅ Analysis module fully initialized v3.1.3");
      
      this.tryAutoAttach();
      this.registerMainSystemListener();
    },

    // --- البحث عن الـ canvas بطرق متعددة ---
    findCanvas() {
      const selectors = [
        "#analysisCanvas",
        "#analysis-canvas", 
        ".analysis-canvas",
        "canvas[data-analysis]"
      ];
      
      for (const selector of selectors) {
        const canvas = document.querySelector(selector);
        if (canvas && canvas.tagName === 'CANVAS') {
          return canvas;
        }
      }
      
      return null;
    },

    // --- تهيئة واجهة المستخدم ---
    initUI() {
      // أوضاع التحليل
      document.querySelectorAll(".analysis-modes button").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".analysis-modes button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          this.mode = btn.dataset.mode;
          this.updatePreview();
        });
      });

      // الأزرار
      const runBtn = document.getElementById("runFullAnalysis");
      if (runBtn) runBtn.addEventListener("click", () => this.runUnifiedAnalysis());

      const expBtn = document.getElementById("exportAnalysis");
      if (expBtn) expBtn.addEventListener("click", () => this.export());

      const loadBtn = document.getElementById("loadAnalysisImage");
      if (loadBtn) loadBtn.addEventListener("click", () => this.tryAutoAttach(true));

      // أزرار اختيار خريطة الألوان
      document.querySelectorAll(".colormap-selector button").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".colormap-selector button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentMap = btn.dataset.map;
          this.updatePreview();
        });
      });
    },

    // --- تسجيل حدث الاستماع للنظام الرئيسي ---
    registerMainSystemListener() {
      if (window.SmartCNC && typeof window.SmartCNC.on === 'function') {
        window.SmartCNC.on('image_ready', mat => {
          if (mat && mat instanceof cv.Mat) {
            console.log("📎 SmartCNC → تحميل الصورة للتحليل");
            this.loadImage(mat);
          }
        });
      } else {
        setTimeout(() => this.registerMainSystemListener(), 2000);
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
        }, 500);
      }
    },

    // --- تحميل الصورة للتحليل ---
    loadImage(mat) {
      if (!mat || !(mat instanceof cv.Mat)) return;
      
      // التحقق من أن الـ canvas جاهز مع حد أقصى للمحاولات
      if (!this.canvas || !this.ctx) {
        this._loadImageRetryCount++;
        if (this._loadImageRetryCount <= this._maxRetryCount) {
          setTimeout(() => this.loadImage(mat), 200);
        } else {
          console.log("❌ Cannot load image: canvas not ready after retries");
          this._loadImageRetryCount = 0;
        }
        return;
      }

      // إعادة تعيين عداد المحاولات
      this._loadImageRetryCount = 0;

      // تنظيف الذاكرة القديمة
      if (this.srcMat && !this.srcMat.isDeleted) this.srcMat.delete();
      if (this.grayMat && !this.grayMat.isDeleted) this.grayMat.delete();

      this.srcMat = mat.clone();
      this.grayMat = new cv.Mat();

      if (this.srcMat.channels() === 1) {
        this.srcMat.copyTo(this.grayMat);
      } else {
        cv.cvtColor(this.srcMat, this.grayMat, cv.COLOR_RGBA2GRAY);
      }

      if (this.grayMat && !this.grayMat.empty()) {
        this.canvas.width = this.grayMat.cols;
        this.canvas.height = this.grayMat.rows;
        this.updatePreview();
        this.updateImageStatus(true);
      }
    },

    // --- تحديث حالة الصورة في الواجهة ---
    updateImageStatus(loaded) {
      const imageStatus = document.getElementById("imageStatus");
      if (imageStatus) {
        imageStatus.textContent = loaded ? "✅ محملة" : "غير محملة";
        imageStatus.style.color = loaded ? "#28a745" : "#6c757d";
      }
    },

    // --- محاولة الربط التلقائي مع الصورة ---
    tryAutoAttach(force = false) {
      if (this.autoAttached && !force) return;
      
      const cands = [
        () => window.currentImageMat,
        () => window.imageMat,
        () => (window.SmartCNC && window.SmartCNC.imageMat),
        () => (window.SmartCNC && window.SmartCNC.currentImageMat),
        () => (window.CNC_Editor && window.CNC_Editor.currentMat),
        () => (window.ImageProcessor && window.ImageProcessor.sourceMat)
      ];

      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        for (const fn of cands) {
          try {
            const m = fn();
            if (m && m instanceof cv.Mat && !m.isDeleted && !m.empty()) {
              this.loadImage(m);
              this.autoAttached = true;
              clearInterval(poll);
              return;
            }
          } catch (e) {
            // تجاهل الأخطاء بصمت
          }
        }
        if (tries > 20) {
          clearInterval(poll);
          this.updateImageStatus(false);
        }
      }, 300);
    },

    // --- تحديث المعاينة ---
    updatePreview() {
      if (!this.canvas || !this.ctx) return;
      
      if (!this.grayMat || this.grayMat.empty()) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }

      const dst = new cv.Mat();
      try {
        switch (this.mode) {
          case "edges": 
            // عرض الصورة الأصلية مع الحواف فوقها
            if (this.srcMat && !this.srcMat.empty()) {
              // نسخ الصورة الأصلية
              this.srcMat.copyTo(dst);
              
              // كشف الحواف من الصورة الرمادية
              const edges = new cv.Mat();
              cv.Canny(this.grayMat, edges, 80, 150);
              
              // تحويل الحواف إلى لون أحمر وإضافتها فوق الصورة الأصلية
              const edgesColor = new cv.Mat();
              cv.cvtColor(edges, edgesColor, cv.COLOR_GRAY2RGBA);
              
              // تغيير لون الحواف إلى الأحمر
              for (let i = 0; i < edgesColor.rows; i++) {
                for (let j = 0; j < edgesColor.cols; j++) {
                  if (edgesColor.ucharPtr(i, j)[0] > 0) {
                    edgesColor.ucharPtr(i, j)[0] = 0;   // B
                    edgesColor.ucharPtr(i, j)[1] = 0;   // G
                    edgesColor.ucharPtr(i, j)[2] = 255; // R
                    edgesColor.ucharPtr(i, j)[3] = 255; // A
                  }
                }
              }
              
              // دمج الصورة الأصلية مع الحواف الحمراء
              cv.addWeighted(dst, 0.8, edgesColor, 0.6, 0, dst);
              
              // تنظيف الذاكرة
              edges.delete();
              edgesColor.delete();
            }
            break;
            
          case "contrast": 
            cv.Laplacian(this.grayMat, dst, cv.CV_8U); 
            break;
            
          case "heatmap":
            // إصلاح مشكلة خرائط الألوان
            const heatmapMat = new cv.Mat();
            cv.cvtColor(this.grayMat, heatmapMat, cv.COLOR_GRAY2BGR);
            
            // تحويل خريطة الألوان المطلوبة إلى القيمة الصحيحة المناسبة
            const colormapValue = this.getColormapValue(this.currentMap);
            cv.applyColorMap(heatmapMat, dst, colormapValue);
            
            heatmapMat.delete();
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
        console.error("Preview error:", e);
      } finally {
        dst.delete();
      }
    },

    // --- الحصول على قيمة خريطة الألوان الصحيحة ---
    getColormapValue(mapName) {
      const colormapMap = {
        "AUTUMN": cv.COLORMAP_AUTUMN,
        "BONE": cv.COLORMAP_BONE,
        "JET": cv.COLORMAP_JET,
        "WINTER": cv.COLORMAP_WINTER,
        "RAINBOW": cv.COLORMAP_RAINBOW,
        "OCEAN": cv.COLORMAP_OCEAN,
        "SUMMER": cv.COLORMAP_SUMMER,
        "SPRING": cv.COLORMAP_SPRING,
        "COOL": cv.COLORMAP_COOL,
        "HSV": cv.COLORMAP_HSV,
        "PINK": cv.COLORMAP_PINK,
        "HOT": cv.COLORMAP_HOT,
        "PARULA": cv.COLORMAP_PARULA,
        "MAGMA": cv.COLORMAP_MAGMA,
        "INFERNO": cv.COLORMAP_INFERNO,
        "PLASMA": cv.COLORMAP_PLASMA,
        "VIRIDIS": cv.COLORMAP_VIRIDIS,
        "CIVIDIS": cv.COLORMAP_CIVIDIS,
        "TWILIGHT": cv.COLORMAP_TWILIGHT,
        "TWILIGHT_SHIFTED": cv.COLORMAP_TWILIGHT_SHIFTED,
        "TURBO": cv.COLORMAP_TURBO
      };
      
      return colormapMap[mapName] || cv.COLORMAP_JET;
    },

    // --- التحليل الموحد (كامل + ذكي) ---
    runUnifiedAnalysis() {
      if (!this.grayMat || this.grayMat.empty()) {
        this.showMessage("لا توجد صورة للتحليل", "error");
        return;
      }

      this.showLoading(true);
      const mats = [];

      try {
        const edges = new cv.Mat(); mats.push(edges);
        cv.Canny(this.grayMat, edges, 80, 150);
        const edgeCount = cv.countNonZero(edges);

        const mean = new cv.Mat(); mats.push(mean);
        const stddev = new cv.Mat(); mats.push(stddev);
        cv.meanStdDev(this.grayMat, mean, stddev);
        const contrastVal = Math.round(stddev.data64F ? stddev.data64F[0] : stddev.data[0]);

        const texture = new cv.Mat(); mats.push(texture);
        cv.Laplacian(this.grayMat, texture, cv.CV_8U);
        const textureVal = Math.min(100, Math.round((cv.countNonZero(texture) / (this.grayMat.rows * this.grayMat.cols)) * 400));

        let gradX = new cv.Mat(); mats.push(gradX);
        let gradY = new cv.Mat(); mats.push(gradY);
        cv.Sobel(this.grayMat, gradX, cv.CV_32F, 1, 0);
        cv.Sobel(this.grayMat, gradY, cv.CV_32F, 0, 1);
        const meanGradX = cv.mean(gradX)[0];
        const meanGradY = cv.mean(gradY)[0];
        const orientationAngle = Math.abs(meanGradX) > Math.abs(meanGradY) ? "أفقي (X)" : "رأسي (Y)";

        const sharpness = this.calculateSharpness();

        // عرض الصورة الأصلية مع الحواف الحمراء فوقها
        const resultDisplay = new cv.Mat();
        mats.push(resultDisplay);
        
        if (this.srcMat && !this.srcMat.empty()) {
          // نسخ الصورة الأصلية
          this.srcMat.copyTo(resultDisplay);
          
          // تحويل الحواف إلى لون أحمر وإضافتها فوق الصورة الأصلية
          const edgesColor = new cv.Mat();
          mats.push(edgesColor);
          cv.cvtColor(edges, edgesColor, cv.COLOR_GRAY2RGBA);
          
          // تغيير لون الحواف إلى الأحمر
          for (let i = 0; i < edgesColor.rows; i++) {
            for (let j = 0; j < edgesColor.cols; j++) {
              if (edgesColor.ucharPtr(i, j)[0] > 0) {
                edgesColor.ucharPtr(i, j)[0] = 0;   // B
                edgesColor.ucharPtr(i, j)[1] = 0;   // G
                edgesColor.ucharPtr(i, j)[2] = 255; // R
                edgesColor.ucharPtr(i, j)[3] = 255; // A
              }
            }
          }
          
          // دمج الصورة الأصلية مع الحواف الحمراء
          cv.addWeighted(resultDisplay, 0.8, edgesColor, 0.6, 0, resultDisplay);
        } else {
          // إذا لم تكن الصورة الأصلية متوفرة، استخدم الطريقة القديمة
          const colorReady = new cv.Mat(); mats.push(colorReady);
          cv.addWeighted(edges, 0.5, texture, 0.5, 0, colorReady);
          const mapName = this.currentMap || "JET";
          try {
            cv.applyColorMap(colorReady, colorReady, cv[`COLORMAP_${mapName}`] || cv.COLORMAP_JET);
          } catch {
            cv.cvtColor(colorReady, colorReady, cv.COLOR_GRAY2RGBA);
          }
          colorReady.copyTo(resultDisplay);
        }
        
        cv.imshow(this.canvas, resultDisplay);

        const totalPixels = this.grayMat.rows * this.grayMat.cols;
        const detailDensity = Math.min(100, Math.round((edgeCount / totalPixels) * 100));
        
        const recommendation = this.generateRecommendation(detailDensity, contrastVal, sharpness);

        const put = (id, val) => { 
          const el = document.getElementById(id); 
          if (el) el.textContent = val; 
        };
        
        put("edgeCount", edgeCount.toLocaleString('ar-EG'));
        put("contrastValue", contrastVal + "%");
        put("detailDensity", detailDensity + "%");
        put("textureValue", textureVal + "%");
        put("orientationValue", orientationAngle);
        put("sharpnessValue", sharpness);
        put("analysisRecommendation", recommendation);

        this.showMessage("تم التحليل بنجاح", "success");

      } catch (e) {
        console.error("Analysis error:", e);
        this.showMessage("حدث خطأ أثناء التحليل", "error");
      } finally {
        mats.forEach(mat => {
          if (mat && !mat.isDeleted) mat.delete();
        });
        this.showLoading(false);
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
      } catch (e) {
        return 0;
      } finally {
        if (laplacian && !laplacian.isDeleted) laplacian.delete();
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

    // --- إظهار رسائل للمستخدم ---
    showMessage(message, type = "info") {
      const messageEl = document.getElementById("analysisMessage");
      if (!messageEl) return;

      messageEl.textContent = message;
      messageEl.className = `analysis-message ${type}`;
      messageEl.style.display = 'block';

      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 4000);
    },

    // --- إظهار/إخفاء شاشة التحميل ---
    showLoading(show) {
      const loadingEl = document.getElementById("analysisLoading");
      if (!loadingEl) return;

      if (show) {
        loadingEl.style.display = 'block';
      } else {
        loadingEl.style.display = 'none';
      }
    },

    // --- تصدير النتائج ---
    export(type = 'json') {
      const results = {
        edges: document.getElementById("edgeCount")?.textContent || null,
        contrast: document.getElementById("contrastValue")?.textContent || null,
        density: document.getElementById("detailDensity")?.textContent || null,
        texture: document.getElementById("textureValue")?.textContent || null,
        orientation: document.getElementById("orientationValue")?.textContent || null,
        sharpness: document.getElementById("sharpnessValue")?.textContent || null,
        recommendation: document.getElementById("analysisRecommendation")?.textContent || null,
        timestamp: new Date().toLocaleString('ar-EG')
      };

      switch (type) {
        case 'json':
          const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
          this.downloadFile(blob, "analysis-results.json");
          break;
        case 'csv':
          const csvContent = Object.entries(results)
            .map(([key, value]) => `"${key}","${value}"`)
            .join('\n');
          const csvBlob = new Blob(["\uFEFF" + csvContent], { type: "text/csv; charset=utf-8;" });
          this.downloadFile(csvBlob, "analysis-results.csv");
          break;
        case 'image':
          this.exportImage();
          break;
        case 'report':
          this.exportHTMLReport(results);
          break;
      }
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
    <title>تقرير التحليل - ${results.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .report { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .result-item { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .recommendation { background: #fff3cd; border: 2px solid #ffc107; font-weight: bold; }
    </style>
</head>
<body>
    <div class="report">
        <h1>تقرير تحليل الصورة</h1>
        <div class="result-item">عدد الحواف: ${results.edges}</div>
        <div class="result-item">نسبة التباين: ${results.contrast}</div>
        <div class="result-item">كثافة التفاصيل: ${results.density}</div>
        <div class="result-item">قيمة الملمس: ${results.texture}</div>
        <div class="result-item">الاتجاه السائد: ${results.orientation}</div>
        <div class="result-item">حدة الصورة: ${results.sharpness}</div>
        <div class="result-item recommendation">التوصية: ${results.recommendation}</div>
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
      if (this.srcMat && !this.srcMat.isDeleted) this.srcMat.delete();
      if (this.grayMat && !this.grayMat.isDeleted) this.grayMat.delete();
      this.srcMat = null;
      this.grayMat = null;
      this.ready = false;
      this._initialized = false;
      this._loadImageRetryCount = 0;
    }
  };

  setTimeout(() => Module.waitForOpenCVAndInit(), 100);
  return Module;
})();

// التكامل مع النظام الرئيسي - بدون رسائل مزعجة
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (window.Analysis && typeof window.Analysis.waitForOpenCVAndInit === 'function') {
      window.Analysis.waitForOpenCVAndInit();
    }
  }, 1500);
});
