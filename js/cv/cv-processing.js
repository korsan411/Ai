/* CncAi — cv-processing.js
   مسؤول عن تحميل الصورة، المعالجة، وكشف الحواف عبر OpenCV
*/

(function() {
  window.CncAi = window.CncAi || {};
  const mm = window.CncAi.memoryManager;
  const dbg = window.CncAi.debug;

  let cvReady = false;
  let srcMat = null;
  let grayMat = null;

  // ✅ انتظار تحميل OpenCV
  function waitForCvReady(callback) {
    const check = setInterval(() => {
      if (window.cv && cv.imread) {
        clearInterval(check);
        cvReady = true;
        dbg.info("✅ OpenCV جاهز");
        callback();
      }
    }, 200);
  }

  // ✅ تحميل الصورة إلى Mat
  function loadImageToCanvas(file, canvasId) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        try {
          srcMat = cv.imread(canvasId);
          grayMat = new cv.Mat();
          cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
          dbg.info("🖼️ تم تحميل الصورة ومعالجتها بنجاح");
          resolve(grayMat);
        } catch (err) {
          dbg.error("فشل في تحميل الصورة: " + err);
          reject(err);
        }
      };
      img.onerror = () => reject("خطأ في تحميل الصورة");
      img.src = URL.createObjectURL(file);
    });
  }

  // ✅ كشف الحواف (Canny / Sobel / Laplace)
  function detectEdges(method, sensitivity = 100) {
    if (!grayMat) {
      dbg.warn("⚠️ لم يتم تحميل الصورة بعد");
      return null;
    }

    const dst = new cv.Mat();
    const low = sensitivity;
    const high = sensitivity * 2.5;

    switch (method) {
      case "canny":
        cv.Canny(grayMat, dst, low, high);
        break;
      case "sobel":
        const gradX = new cv.Mat(), gradY = new cv.Mat();
        cv.Sobel(grayMat, gradX, cv.CV_16S, 1, 0, 3);
        cv.Sobel(grayMat, gradY, cv.CV_16S, 0, 1, 3);
        cv.convertScaleAbs(gradX, gradX);
        cv.convertScaleAbs(gradY, gradY);
        cv.addWeighted(gradX, 0.5, gradY, 0.5, 0, dst);
        mm.safeDelete([gradX, gradY]);
        break;
      case "laplace":
        cv.Laplacian(grayMat, dst, cv.CV_8U, 3);
        break;
      default:
        cv.Canny(grayMat, dst, low, high);
        break;
    }

    dbg.info(`🔍 كشف الحواف (${method}) مكتمل`);
    return dst;
  }

  // ✅ إنشاء Heatmap باستخدام Colormap
  function createHeatmap(mat, colormap = cv.COLORMAP_JET, canvasId = 'canvasHeatmap') {
    const colorDst = new cv.Mat();
    try {
      cv.applyColorMap(mat, colorDst, colormap);
      cv.imshow(canvasId, colorDst);
    } catch (err) {
      dbg.error("خطأ في إنشاء Heatmap: " + err);
    } finally {
      mm.safeDelete(colorDst);
    }
  }

  // ✅ عرض الصورة في canvas آخر
  function showMat(mat, canvasId) {
    try {
      cv.imshow(canvasId, mat);
    } catch (err) {
      dbg.error("عرض الصورة فشل: " + err);
    }
  }

  // ✅ تنظيف الموارد
  function cleanup() {
    mm.safeDelete([srcMat, grayMat]);
    srcMat = null;
    grayMat = null;
    dbg.info("🧹 تم تنظيف موارد OpenCV");
  }

  // واجهة عامة
  window.CncAi.cv = {
    waitForCvReady,
    loadImageToCanvas,
    detectEdges,
    createHeatmap,
    showMat,
    cleanup,
    get grayMat() { return grayMat; }
  };
})();
