/* CncAi — ui-init.js
   تهيئة التطبيق وربط كل المكونات.
*/

(function() {
  window.CncAi = window.CncAi || {};
  const dbg = window.CncAi.debug;
  const cvCore = window.CncAi.cv;
  const ui = window.CncAi.ui;
  const tm = window.CncAi.taskManager;

  function initApp() {
    dbg.info("🚀 بدء تهيئة CncAi...");

    cvCore.waitForCvReady(() => {
      ui.setupTabs();
      ui.setupButtons();
      ui.setupColormapButtons();
      ui.setup3DControls();
      dbg.info("✅ CncAi جاهز للاستخدام");
    });

    tm.onTaskStart = (meta) => {
      const overlay = document.getElementById('progressOverlay');
      if (overlay) overlay.classList.add('active');
      dbg.info("🔄 بدء المهمة: " + (meta?.name || ''));
    };

    tm.onTaskEnd = () => {
      const overlay = document.getElementById('progressOverlay');
      if (overlay) overlay.classList.remove('active');
      dbg.info("✅ تم إنهاء المهمة");
    };
  }

  window.initApp = initApp;
})();
