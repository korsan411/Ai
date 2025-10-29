/* CncAi — ui-controls.js
   تفاعل المستخدم مع الواجهة: الأزرار، التبويبات، التبديل بين المعاينات.
*/

(function() {
  window.CncAi = window.CncAi || {};
  const dbg = window.CncAi.debug;
  const cvCore = window.CncAi.cv;
  const gcodeGen = window.CncAi.gcodeGen;
  const sim = window.CncAi.sim3D;
  const tm = window.CncAi.taskManager;

  // 🧭 تبديل التبويبات
  function setupTabs() {
    const buttons = document.querySelectorAll('.tabs button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById(`tab-${target}`).classList.add('active');
      });
    });
  }

  // 🎨 تبديل الـ Colormap
  function setupColormapButtons() {
    const cmapBtns = document.querySelectorAll('.colormap-buttons button');
    cmapBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const map = btn.dataset.map;
        let cmapType = cv.COLORMAP_JET;
        switch(map) {
          case 'hot': cmapType = cv.COLORMAP_HOT; break;
          case 'cool': cmapType = cv.COLORMAP_COOL; break;
          case 'gray': cmapType = cv.COLORMAP_BONE; break;
          default: cmapType = cv.COLORMAP_JET; break;
        }
        const gray = cvCore.grayMat;
        if (gray) {
          cvCore.createHeatmap(gray, cmapType, 'canvasHeatmap');
          dbg.info("🎨 تم تغيير خريطة الألوان إلى " + map);
        }
      });
    });
  }

  // 🔄 دوران مشهد 3D
  function setup3DControls() {
    const btnRot = document.getElementById('btnRotate');
    if (btnRot) {
      btnRot.addEventListener('click', () => sim.rotateScene(0.1));
    }
    const zIn = document.getElementById('btnZoomIn');
    const zOut = document.getElementById('btnZoomOut');
    if (zIn && sim.camera) zIn.addEventListener('click', ()=>{ sim.camera.position.z -= 10; });
    if (zOut && sim.camera) zOut.addEventListener('click', ()=>{ sim.camera.position.z += 10; });
  }

  // ⚙️ تشغيل المعالجة وتوليد الكود
  function setupButtons() {
    const imgInput = document.getElementById('imgInput');
    const btnGen = document.getElementById('btnGen');
    const btnSim = document.getElementById('btnSim');
    const gOut = document.getElementById('gcodeOut');

    if (imgInput) {
      imgInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          tm.addTask(async () => {
            await cvCore.loadImageToCanvas(file, 'canvasOriginalView');
            const edges = cvCore.detectEdges('canny', 100);
            cvCore.createHeatmap(edges);
          }, {name: 'تحميل الصورة'});
        }
      });
    }

    if (btnGen) {
      btnGen.addEventListener('click', () => {
        tm.addTask(() => {
          const gray = cvCore.grayMat;
          if (!gray) { dbg.error("لم يتم تحميل الصورة بعد"); return; }
          const g = gcodeGen.generateRasterGcode(gray, 3);
          gOut.value = g;
          dbg.info("✅ تم توليد G-code بنجاح");
        }, {name:'توليد Gcode'});
      });
    }

    if (btnSim) {
      btnSim.addEventListener('click', () => {
        tm.addTask(() => {
          sim.init3D();
          sim.drawGcodePath(gOut.value);
        }, {name:'محاكاة 3D'});
      });
    }
  }

  window.CncAi.ui = {
    setupTabs,
    setupButtons,
    setupColormapButtons,
    setup3DControls
  };
})();
