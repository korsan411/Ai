// ================= تهيئة الأزرار - الإصدار المحسن (مع زر Combo) =================
function initButtons() {
  try {
    // Router buttons
    const btnGen = document.getElementById('btnGen');
    if (btnGen) {
      btnGen.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateRasterGcode(false);
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد G-code (Raster)");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد G-code (Raster)');
      });
    }

    const btnQuick = document.getElementById('btnQuick');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateRasterGcode(true);
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد G-code سريع (Raster)");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد G-code سريع');
      });
    }

    const btnContour = document.getElementById('btnContour');
    if (btnContour) {
      btnContour.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateContourGcode();
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد G-code (Contour)");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد G-code (Contour)');
      });
    }

    // 🔹 زر Combo (Contour + Raster) في صف مستقل
    const btnCombo = document.getElementById('btnCombo');
    if (btnCombo) {
      btnCombo.addEventListener('click', () => {
        taskManager.addTask(() => {
          try {
            showToast("🔄 جاري توليد كود مزدوج (Contour + Raster)...", 2500);
            const contourCode = generateContourGcode();
            const rasterCode = generateRasterGcode();
            const combinedCode =
              "; ============================================================\n" +
              "; 🧠 CncAi — Combo Mode (Contour + Raster)\n" +
              "; Date: " + new Date().toLocaleString() + "\n" +
              "; ============================================================\n\n" +
              "; --- Contour Section ---\n" +
              contourCode + "\n\n" +
              "; --- Raster Section ---\n" +
              rasterCode + "\n\n" +
              "; ✅ Combo Completed\n";

            document.getElementById('gcodeOut').value = combinedCode;
            lastGeneratedGcode = combinedCode;
            renderTopViewFromGcode(combinedCode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
            showToast("✅ تم توليد الكود المزدوج بنجاح");
            return combinedCode;
          } catch (err) {
            console.error("⚠️ Combo Error:", err);
            showToast("❌ فشل في توليد الكود المزدوج");
          }
        }, 'توليد كود مزدوج (Combo)');
      });
    }

    // Laser buttons
    const btnLaserEngrave = document.getElementById('btnLaserEngrave');
    if (btnLaserEngrave) {
      btnLaserEngrave.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateLaserEngraveGcode();
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد كود الليزر (نقش)");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد كود الليزر (نقش)');
      });
    }

    const btnLaserQuick = document.getElementById('btnLaserQuick');
    if (btnLaserQuick) {
      btnLaserQuick.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateLaserQuickGcode();
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد كود الليزر السريع");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد كود الليزر السريع');
      });
    }

    const btnLaserCut = document.getElementById('btnLaserCut');
    if (btnLaserCut) {
      btnLaserCut.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generateLaserCutGcode();
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد كود الليزر (قص)");
            renderTopViewFromGcode(gcode);
            document.querySelector('.tab-buttons button[data-tab=\"simulation\"]').click();
          }
          return gcode;
        }, 'توليد كود الليزر (قص)');
      });
    }

    // 3D buttons
    const btnSliceModel = document.getElementById('btnSliceModel');
    if (btnSliceModel) {
      btnSliceModel.addEventListener('click', () => {
        taskManager.addTask(() => {
          const gcode = generate3DGcode();
          document.getElementById('gcodeOut').value = gcode;
          lastGeneratedGcode = gcode;
          if (gcode) {
            showToast("تم توليد G-code ثلاثي الأبعاد");
          }
          return gcode;
        }, 'توليد G-code ثلاثي الأبعاد');
      });
    }

    const btnPreviewLayers = document.getElementById('btnPreviewLayers');
    if (btnPreviewLayers) {
      btnPreviewLayers.addEventListener('click', () => {
        showToast("ميزة معاينة الطبقات قيد التطوير", 3000);
      });
    }

    const btnDownload = document.getElementById('btnDownload');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const text = document.getElementById('gcodeOut').value;
        if (!text) { 
          showToast("لا يوجد G-code لتحميله"); 
          return; 
        }
        try {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
          const machineType = document.getElementById('machineCategory').value;
          const filename = `${machineType}_output_${dateStr}.gcode`;
          const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; 
          a.download = filename; 
          document.body.appendChild(a); 
          a.click(); 
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(`تم تحميل الملف: ${filename}`);
        } catch (error) {
          console.error('خطأ في تحميل الملف:', error);
          showToast('فشل في تحميل الملف');
        }
      });
    }

    const btnLaserDownload = document.getElementById('btnLaserDownload');
    if (btnLaserDownload) {
      btnLaserDownload.addEventListener('click', () => {
        document.getElementById('btnDownload').click();
      });
    }

    const btnDownload3D = document.getElementById('btnDownload3D');
    if (btnDownload3D) {
      btnDownload3D.addEventListener('click', () => {
        document.getElementById('btnDownload').click();
      });
    }

    const btnCenterOrigin = document.getElementById('btnCenterOrigin');
    if (btnCenterOrigin) {
      btnCenterOrigin.addEventListener('click', () => {
        try {
          const workWidth = parseFloat(document.getElementById('workWidth').value) || 0;
          const workHeight = parseFloat(document.getElementById('workHeight').value) || 0;
          document.getElementById('originX').value = (workWidth / 2).toFixed(1);
          document.getElementById('originY').value = (workHeight / 2).toFixed(1);
          showToast("✅ تم توسيط نقطة الأصل");
        } catch (error) {
          console.error('❌ فشل في توسيط نقطة الأصل:', error);
        }
      });
    }

  } catch (error) {
    console.error('فشل في تهيئة الأزرار:', error);
  }
}
