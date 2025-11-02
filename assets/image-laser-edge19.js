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