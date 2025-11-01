// === Analysis module for CncAi — integrates the "analysis" tab with OpenCV mats ===
window.Analysis = (function () {
  const Module = {
    canvas: null,
    ctx: null,
    srcMat: null,      // original RGBA mat
    grayMat: null,     // gray version used for edges/contrast
    mode: "edges",
    ready: false,
    autoAttached: false,
    init() {
      this.canvas = document.getElementById("analysisCanvas");
      if (!this.canvas) {
        console.warn("Analysis: canvas #analysisCanvas not found.");
        return;
      }
      this.ctx = this.canvas.getContext("2d");

      // Wire mode buttons
      document.querySelectorAll(".analysis-modes button").forEach(btn => {
        btn.addEventListener("click", (e) => {
          this.mode = btn.dataset.mode;
          this.updatePreview();
        });
      });

      // Wire actions
      const runBtn = document.getElementById("runFullAnalysis");
      if (runBtn) runBtn.addEventListener("click", () => this.runFull());

      const expBtn = document.getElementById("exportAnalysis");
      if (expBtn) expBtn.addEventListener("click", () => this.export());

      // try auto-attach to common global mats
      this.tryAutoAttach();

      this.ready = true;
      console.log("Analysis: initialized (ready).");
    },

    // Waits for cv to be ready then init
    waitForOpenCVAndInit() {
      if (typeof cv !== "undefined" && cv && cv.Mat) {
        this.init();
      } else {
        console.log("Analysis: waiting for OpenCV...");
        // If OpenCV exposes onRuntimeInitialized
        if (typeof cv !== "undefined" && cv && cv['onRuntimeInitialized']) {
          cv['onRuntimeInitialized'] = () => this.init();
        } else {
          // fallback polling
          const t = setInterval(() => {
            if (typeof cv !== "undefined" && cv && cv.Mat) {
              clearInterval(t);
              this.init();
            }
          }, 250);
        }
      }
    },

    // Public: accepts a cv.Mat (RGBA or Gray) and uses it
    loadImage(mat) {
      if (typeof cv === "undefined") {
        console.error("Analysis.loadImage: OpenCV (cv) not available.");
        return;
      }
      if (!mat || !(mat instanceof cv.Mat)) {
        console.error("Analysis.loadImage: passed object is not a cv.Mat");
        return;
      }

      // clean previous mats
      if (this.srcMat) this.srcMat.delete();
      if (this.grayMat) this.grayMat.delete();

      // copy source and create gray
      this.srcMat = mat.clone();
      this.grayMat = new cv.Mat();
      if (this.srcMat.channels() === 1) {
        this.srcMat.copyTo(this.grayMat);
      } else {
        cv.cvtColor(this.srcMat, this.grayMat, cv.COLOR_RGBA2GRAY);
      }

      // Resize canvas to image size (keeps aspect ratio when CSS scales)
      this.canvas.width = this.grayMat.cols;
      this.canvas.height = this.grayMat.rows;

      // default preview
      this.updatePreview();
      console.log("Analysis: image loaded (", this.grayMat.cols, "x", this.grayMat.rows, ")");
    },

    // Try to auto-attach to common global mats used in CncAi
    tryAutoAttach() {
      // If already attached or inside another init, skip
      if (this.autoAttached) return;

      const candidates = [
        () => window.currentImageMat,
        () => window.imageMat,
        () => (window.SmartCNC && window.SmartCNC.imageMat),
        () => (window.SmartCNC && window.SmartCNC.currentImageMat),
      ];

      for (const getter of candidates) {
        try {
          const m = getter();
          if (m && (typeof cv !== "undefined") && m instanceof cv.Mat) {
            this.loadImage(m);
            console.log("Analysis: auto-attached to existing image mat.");
            this.autoAttached = true;
            return;
          }
        } catch (e) { /* ignore */ }
      }

      // If not found, observe for a global assignment (poll)
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        for (const getter of candidates) {
          try {
            const m = getter();
            if (m && (typeof cv !== "undefined") && m instanceof cv.Mat) {
              this.loadImage(m);
              this.autoAttached = true;
              clearInterval(poll);
              return;
            }
          } catch (e) { /* ignore */ }
        }
        if (tries > 120) { // ~30s
          clearInterval(poll);
          console.log("Analysis: auto-attach timeout — call Analysis.loadImage(mat) manually after image load.");
        }
      }, 250);
    },

    // Update preview according to the selected mode
    updatePreview() {
      if (!this.grayMat || this.grayMat.empty()) {
        // clear canvas
        if (this.canvas && this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        return;
      }

      const dst = new cv.Mat();
      try {
        switch (this.mode) {
          case "edges":
            cv.Canny(this.grayMat, dst, 80, 150);
            break;
          case "contrast":
            // laplacian -> enhance outlines
            cv.Laplacian(this.grayMat, dst, cv.CV_8U);
            break;
          case "heatmap":
            // color map requires a 3-channel mat
            cv.cvtColor(this.grayMat, dst, cv.COLOR_GRAY2RGBA);
            cv.applyColorMap(dst, dst, cv.COLORMAP_JET);
            break;
          case "topview":
            // normalize for visualization
            cv.normalize(this.grayMat, dst, 0, 255, cv.NORM_MINMAX);
            cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
            break;
          default:
            this.grayMat.copyTo(dst);
        }
        // show result on canvas
        cv.imshow(this.canvas, dst);
      } catch (err) {
        console.error("Analysis.updatePreview error:", err);
      } finally {
        dst.delete();
      }
    },

    // Run a set of analyses and fill the report fields
    runFull() {
      if (!this.grayMat || this.grayMat.empty()) {
        console.warn("Analysis.runFull: no image loaded.");
        return;
      }

      // Edge count
      let edges = new cv.Mat();
      cv.Canny(this.grayMat, edges, 80, 150);
      const edgeCount = cv.countNonZero(edges);

      // Contrast (use stddev)
      const mean = new cv.Mat();
      const stddev = new cv.Mat();
      cv.meanStdDev(this.grayMat, mean, stddev);
      // stddev is a Mat of length channels, use data64F
      let contrastVal = 0;
      try {
        if (stddev.data64F && stddev.data64F.length > 0) contrastVal = Math.round(stddev.data64F[0]);
        else if (stddev.data && stddev.data.length > 0) contrastVal = Math.round(stddev.data[0]);
      } catch (e) {
        contrastVal = 0;
      }

      // detail density percentage
      const totalPixels = this.grayMat.rows * this.grayMat.cols;
      const detailDensity = Math.min(100, Math.round((edgeCount / totalPixels) * 100));

      // Recommendation simple heuristic
      const rec = detailDensity > 50 ? "Router" : "Laser";

      // Update UI
      const put = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      put("edgeCount", edgeCount);
      put("contrastValue", contrastVal + "%");
      put("detailDensity", detailDensity + "%");
      put("analysisRecommendation", rec);

      // show edges preview by default after analysis
      this.mode = "edges";
      this.updatePreview();

      // cleanup
      edges.delete();
      mean.delete();
      stddev.delete();

      console.log("Analysis.runFull: done.", { edgeCount, contrastVal, detailDensity, rec });
    },

    // Export results as JSON
    export() {
      const results = {
        edges: document.getElementById("edgeCount")?.textContent || null,
        contrast: document.getElementById("contrastValue")?.textContent || null,
        density: document.getElementById("detailDensity")?.textContent || null,
        recommendation: document.getElementById("analysisRecommendation")?.textContent || null,
      };
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "analysis-results.json";
      a.click();
    }
  };

  // Auto-start when script loaded
  setTimeout(() => Module.waitForOpenCVAndInit(), 10);

  return Module;
})();