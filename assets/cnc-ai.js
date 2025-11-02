// === CncAi — Analysis Module v2.6.1 (AI Enhanced + Colormap Selector) ===
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

    // --- التهيئة ---
    init() {
      this.canvas = document.getElementById("analysisCanvas");
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext("2d");

      // أوضاع التحليل (حواف، تباين، كثافة...)
      document.querySelectorAll(".analysis-modes button").forEach(btn => {
        btn.addEventListener("click", () => {
          this.mode = btn.dataset.mode;
          this.updatePreview();
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

      this.tryAutoAttach();
      this.ready = true;
      console.log("✅ Analysis module initialized");
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
      if (!mat || !(mat instanceof cv.Mat)) return;

      if (this.srcMat) this.srcMat.delete();
      if (this.grayMat) this.grayMat.delete();

      this.srcMat = mat.clone();
      this.grayMat = new cv.Mat();

      if (this.srcMat.channels() === 1) this.srcMat.copyTo(this.grayMat);
      else cv.cvtColor(this.srcMat, this.grayMat, cv.COLOR_RGBA2GRAY);

      this.canvas.width = this.grayMat.cols;
      this.canvas.height = this.grayMat.rows;
      this.updatePreview();

      console.log("✅ Analysis image attached manually.");
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
              return;
            }
          } catch {}
        }
        if (tries > 120) clearInterval(poll);
      }, 250);
    },

    // --- تحديث المعاينة ---
    updatePreview() {
      if (!this.grayMat || this.grayMat.empty()) {
        if (this.canvas && this.ctx)
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }

      const dst = new cv.Mat();
      try {
        switch (this.mode) {
          case "edges": cv.Canny(this.grayMat, dst, 80, 150); break;
          case "contrast": cv.Laplacian(this.grayMat, dst, cv.CV_8U); break;
          case "heatmap":
            cv.cvtColor(this.grayMat, dst, cv.COLOR_GRAY2RGBA);
            const mapName = this.currentMap || "JET";
            if (cv[`COLORMAP_${mapName}`])
              cv.applyColorMap(dst, dst, cv[`COLORMAP_${mapName}`]);
            else
              cv.applyColorMap(dst, dst, cv.COLORMAP_JET);
            break;
          case "topview":
            cv.normalize(this.grayMat, dst, 0, 255, cv.NORM_MINMAX);
            cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
            break;
          default: this.grayMat.copyTo(dst);
        }
        cv.imshow(this.canvas, dst);
      } catch (e) {
        console.error("updatePreview error:", e);
      } finally {
        dst.delete();
      }
    },

    // --- التحليل الموحد (كامل + ذكي) ---
    runUnifiedAnalysis() {
      if (!this.grayMat || this.grayMat.empty()) return;

      const edges = new cv.Mat();
      cv.Canny(this.grayMat, edges, 80, 150);
      const edgeCount = cv.countNonZero(edges);

      const mean = new cv.Mat();
      const stddev = new cv.Mat();
      cv.meanStdDev(this.grayMat, mean, stddev);
      const contrastVal = Math.round(stddev.data64F ? stddev.data64F[0] : stddev.data[0]);

      const texture = new cv.Mat();
      cv.Laplacian(this.grayMat, texture, cv.CV_8U);
      const textureVal = Math.min(100, Math.round((cv.countNonZero(texture) / (this.grayMat.rows * this.grayMat.cols)) * 400));

      let gradX = new cv.Mat();
      let gradY = new cv.Mat();
      cv.Sobel(this.grayMat, gradX, cv.CV_32F, 1, 0);
      cv.Sobel(this.grayMat, gradY, cv.CV_32F, 0, 1);
      const meanGradX = cv.mean(gradX)[0];
      const meanGradY = cv.mean(gradY)[0];
      const orientationAngle = Math.abs(meanGradX) > Math.abs(meanGradY) ? "أفقي (X)" : "رأسي (Y)";

      const colorReady = new cv.Mat();
      cv.addWeighted(edges, 0.5, texture, 0.5, 0, colorReady);
      const mapName = this.currentMap || "JET";
      try {
        cv.applyColorMap(colorReady, colorReady, cv[`COLORMAP_${mapName}`] || cv.COLORMAP_JET);
      } catch {
        cv.cvtColor(colorReady, colorReady, cv.COLOR_GRAY2RGBA);
      }
      cv.imshow(this.canvas, colorReady);

      const totalPixels = this.grayMat.rows * this.grayMat.cols;
      const detailDensity = Math.min(100, Math.round((edgeCount / totalPixels) * 100));
      const recommendation =
        detailDensity > 60 && contrastVal > 40 ? "Router (نقش دقيق)" :
        detailDensity > 30 ? "Laser (نقش ناعم)" : "غير مناسب للنقش التفصيلي";

      const put = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      put("edgeCount", edgeCount);
      put("contrastValue", contrastVal + "%");
      put("detailDensity", detailDensity + "%");
      put("textureValue", textureVal + "%");
      put("orientationValue", orientationAngle);
      put("analysisRecommendation", recommendation);

      edges.delete(); texture.delete(); gradX.delete(); gradY.delete(); mean.delete(); stddev.delete(); colorReady.delete();
    },

    // --- تصدير النتائج ---
    export() {
      const results = {
        edges: document.getElementById("edgeCount")?.textContent || null,
        contrast: document.getElementById("contrastValue")?.textContent || null,
        density: document.getElementById("detailDensity")?.textContent || null,
        texture: document.getElementById("textureValue")?.textContent || null,
        orientation: document.getElementById("orientationValue")?.textContent || null,
        recommendation: document.getElementById("analysisRecommendation")?.textContent || null
      };
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "analysis-results.json";
      a.click();
    }
  };

  // --- تشغيل الوحدة ---
  setTimeout(() => Module.waitForOpenCVAndInit(), 10);
  return Module;
})();
