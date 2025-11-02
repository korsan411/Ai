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