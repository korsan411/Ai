// ================= Init UI and bindings - الإصدار المحسن =================
function initApp() {
  try {
    updateDimensionDisplay();
    showToast('تم تحميل التطبيق بنجاح', 1200);
    
    // تهيئة جميع المكونات
    initTabs();
    initMachineCategory();
    initControlElements();
    initFileInput();
    initFileFormatButtons();
    initButtons();
    initColormapButtons();
    
    // منع التحميل المزدوج للصور
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('click', function(e) {
        this.value = '';
      });
    }
    
    // تحديث الأبعاد مع تأخير لمنع التكرار
    let updateTimeout;
    const updateDim = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateDimensionDisplay, 200);
    };
    
    const dimensionInputs = [
      'workWidth', 'workHeight', 'laserWorkWidth', 'laserWorkHeight', 'threedWorkWidth', 'threedWorkHeight', 'threedWorkDepth'
    ];
    
    dimensionInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', updateDim);
      }
    });

    const machineDefaults = {
      router: { feed: 800, safeZ: 5, maxDepth: 3, stepOver: 5, description: "CNC Router - للنحت على الخشب والمعادن" },
      laser: { feed: 2000, safeZ: 0, maxDepth: 0, stepOver: 0.2, description: "Laser Engraver - للنقش والقص بالليزر" },
      threed: { layerHeight: 0.2, fillDensity: 20, printSpeed: 50, description: "3D Printer - للطباعة ثلاثية الأبعاد" }
    };
    
    const machineCategory = document.getElementById('machineCategory');
    if (machineCategory) {
      machineCategory.addEventListener('change', (e) => {
        const def = machineDefaults[e.target.value];
        if (def) {
          if (e.target.value === 'threed') {
            document.getElementById('threedLayerHeight').value = def.layerHeight;
            document.getElementById('threedFillDensity').value = def.fillDensity;
            document.getElementById('threedPrintSpeed').value = def.printSpeed;
          } else if (e.target.value === 'laser') {
            document.getElementById('laserSpeed').value = def.feed;
          } else {
            document.getElementById('feedRate').value = def.feed;
            document.getElementById('safeZ').value = def.safeZ;
            document.getElementById('maxDepth').value = def.maxDepth;
            document.getElementById('stepOver').value = def.stepOver;
          }
          showToast(`تم تحميل إعدادات ${e.target.value}`);
        }
      });
    }

    // إضافة اختصارات لوحة المفاتيح
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'g': 
            e.preventDefault(); 
            const machineType = document.getElementById('machineCategory').value;
            if (machineType === 'laser') {
              document.getElementById('btnLaserEngrave').click();
            } else if (machineType === 'threed') {
              document.getElementById('btnSliceModel').click();
            } else {
              document.getElementById('btnGen').click();
            }
            break;
          case 'r': 
            e.preventDefault(); 
            const machineType2 = document.getElementById('machineCategory').value;
            if (machineType2 === 'laser') {
              document.getElementById('btnLaserQuick').click();
            } else {
              document.getElementById('btnQuick').click();
            }
            break;
          case 'd': e.preventDefault(); document.getElementById('btnDownload').click(); break;
          case '`': e.preventDefault(); document.getElementById('dbgToggleSize').click(); break;
        }
      }
    });

    console.log('تم تهيئة التطبيق بنجاح');

  } catch (error) {
    console.error('فشل في تهيئة التطبيق:', error);
    showToast('حدث خطأ في تحميل التطبيق', 5000);
  }
}

// resize three renderer & topView on window resize
window.addEventListener('resize', () => {
  try {
    const container = document.getElementById('threeContainer');
    if (camera && renderer && container) {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    const container3D = document.getElementById('threeDContainer');
    if (threeDCamera && threeDRenderer && container3D) {
      threeDCamera.aspect = container3D.clientWidth / container3D.clientHeight;
      threeDCamera.updateProjectionMatrix();
      threeDRenderer.setSize(container3D.clientWidth, container3D.clientHeight);
    }
  } catch(e){
    console.warn('فشل في تغيير حجم العارض:', e);
  }
});

// تنظيف الذاكرة عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
  try {
    memoryManager.cleanupAll();
    cleanupSimulation();
    cleanup3DScene();
    taskManager.clear();
  } catch (error) {
    console.warn('فشل في التنظيف قبل الإغلاق:', error);
  }
});

// بدء التطبيق عندما يصبح DOM جاهزاً
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}