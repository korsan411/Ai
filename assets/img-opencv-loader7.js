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