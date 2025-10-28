// app.js - bootstrap for the modular skeleton

document.addEventListener('DOMContentLoaded', async () => {
  console.log('CncAi Modular bootstrap starting...');

  // استدعاء Debug Overlay
  if (window.initDebugOverlay) window.initDebugOverlay();

  // انتظار OpenCV
  try {
    await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (cv && cv.Mat) { clearInterval(check); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(check); reject('OpenCV لم يتم تحميله'); }, 15000);
    });
    console.log('OpenCV initialized.');
  } catch (e) {
    console.warn('OpenCV init failed', e);
  }

  // استدعاء باقي الدوال من window
  if (window.initCV) window.initCV();
  if (window.initUI) window.initUI();
  if (window.initSimulation) window.initSimulation();
  if (window.taskManager) window.CncAi = { taskManager: window.taskManager };

  console.log('CncAi Modular skeleton initialized.');
});
