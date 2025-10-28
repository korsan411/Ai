// app.js - bootstrap for the modular skeleton
import { taskManager } from './core/taskManager.js';
import { memoryManager } from './core/memoryManager.js';
import { initDebugOverlay } from './core/debugOverlay.js';
import { initUI } from './ui/ui-init.js';
import { initCV } from './cv/cv-processing.js';
import { initSimulation } from './three/simulation3d.js';

window.CncAi = window.CncAi || {};
window.CncAi.taskManager = taskManager;
window.CncAi.memoryManager = memoryManager;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('CncAi Modular bootstrap starting...');
  initDebugOverlay();
  try {
    await initCV();
    console.log('OpenCV initialized (skeleton).');
  } catch (e) {
    console.warn('OpenCV init failed or not available in skeleton build', e);
  }
  initSimulation();
  initUI();
  console.log('CncAi Modular skeleton initialized. Remember: for a fully working immediate copy, open index.original.html included in this ZIP.');
});
