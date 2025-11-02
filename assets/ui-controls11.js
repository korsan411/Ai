// ================= تهيئة عناصر التحكم =================
function initControlElements() {
  try {
    // Laser power slider update
    const laserPower = document.getElementById('laserPower');
    if (laserPower) {
      laserPower.addEventListener('input', function(e) {
        const value = e.target.value;
        const display = document.getElementById('laserPowerValue');
        if (display) {
          display.textContent = value + '%';
          display.style.color = `hsl(${value * 1.2}, 100%, 60%)`;
        }
      });
    }

    // Laser detail slider update
    const laserDetail = document.getElementById('laserDetail');
    if (laserDetail) {
      laserDetail.addEventListener('input', function(e) {
        const display = document.getElementById('laserDetailValue');
        if (display) {
          display.textContent = e.target.value;
        }
      });
    }

    // Laser edge mode descriptions
    const laserModeDescriptions = {
      canny: 'Canny - كشف حواف تقليدي مناسب للصور العامة',
      adaptive: 'Adaptive Threshold - ممتاز للصور ذات الإضاءة غير المتجانسة',
      morphological: 'Morphological - للحواف الدقيقة والناعمة والتفاصيل الصغيرة',
      gradient: 'Gradient-Based - للتدرجات اللونية والصور ذات التباين العالي'
    };

    const laserEdgeMode = document.getElementById('laserEdgeMode');
    if (laserEdgeMode) {
      laserEdgeMode.addEventListener('change', function(e) {
        const desc = document.getElementById('laserModeDesc');
        if (desc) {
          desc.textContent = laserModeDescriptions[e.target.value] || '';
        }
        if (!previewCanvas || isProcessing) return;
        const isLaser = document.getElementById('machineCategory').value === 'laser';
        if (isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
          taskManager.addTask(detectLaserContours, 'تحديث كشف حواف الليزر');
        }
      });
    }

    // Laser center origin
    const btnLaserCenterOrigin = document.getElementById('btnLaserCenterOrigin');
    if (btnLaserCenterOrigin) {
      btnLaserCenterOrigin.addEventListener('click', () => {
        try {
          const workWidth = parseFloat(document.getElementById('laserWorkWidth').value) || 0;
          const workHeight = parseFloat(document.getElementById('laserWorkHeight').value) || 0;
          document.getElementById('laserOriginX').value = (workWidth / 2).toFixed(1);
          document.getElementById('laserOriginY').value = (workHeight / 2).toFixed(1);
          showToast("تم توسيط نقطة الأصل للليزر");
        } catch (error) {
          console.error('فشل في توسيط نقطة أصل الليزر:', error);
        }
      });
    }

    // 3D center origin
    const btnThreedCenterOrigin = document.getElementById('btnThreedCenterOrigin');
    if (btnThreedCenterOrigin) {
      btnThreedCenterOrigin.addEventListener('click', () => {
        try {
          const workWidth = parseFloat(document.getElementById('threedWorkWidth').value) || 0;
          const workHeight = parseFloat(document.getElementById('threedWorkHeight').value) || 0;
          document.getElementById('threedOriginX').value = (workWidth / 2).toFixed(1);
          document.getElementById('threedOriginY').value = (workHeight / 2).toFixed(1);
          showToast("تم توسيط نقطة الأصل للطابعة ثلاثية الأبعاد");
        } catch (error) {
          console.error('فشل في توسيط نقطة أصل الثلاثي الأبعاد:', error);
        }
      });
    }

    // Laser redetect button
    const btnRedetectLaser = document.getElementById('btnRedetectLaser');
    if (btnRedetectLaser) {
      btnRedetectLaser.addEventListener('click', () => {
        if (!previewCanvas) {
          showToast('لا توجد صورة محملة');
          return;
        }
        if (cvReady && !isProcessing) {
          taskManager.addTask(detectLaserContours, 'إعادة كشف حواف الليزر');
        }
      });
    }

    // Edge sensitivity updates
    const edgeSensitivity = document.getElementById('edgeSensitivity');
    if (edgeSensitivity) {
      edgeSensitivity.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value).toFixed(2);
        const display = document.getElementById('edgeValue');
        if (display) {
          display.textContent = value;
        }
        if (!previewCanvas || isProcessing) return;
        const isLaser = document.getElementById('machineCategory').value === 'laser';
        if (!isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
          clearTimeout(edgeSensitivityTimer);
          edgeSensitivityTimer = setTimeout(() => {
            taskManager.addTask(detectContours, 'تحديث حساسية الحواف');
          }, 300);
        }
      });
    }

    // Edge mode changes
    const edgeMode = document.getElementById('edgeMode');
    if (edgeMode) {
      edgeMode.addEventListener('change', () => {
        if (!previewCanvas || isProcessing) return;
        const isLaser = document.getElementById('machineCategory').value === 'laser';
        if (!isLaser && cvReady && previewCanvas && previewCanvas.width > 0) {
          taskManager.addTask(detectContours, 'تحديث كشف الحواف');
        }
      });
    }

  } catch (error) {
    console.error('فشل في تهيئة عناصر التحكم:', error);
  }
}