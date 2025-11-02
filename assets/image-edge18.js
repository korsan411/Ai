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