// ui-events.js - binds events for the UI
import { updateView, onImageLoaded, processHeatmap, processTopView, generateGcode, cleanupUI } from './ui-controls.js';
import { qs } from './ui-helpers.js';
import { taskManager } from '../core/taskManager.js';

export function bindUIEvents(){
  // File input
  const fileInput = qs('fileInput');
  if(fileInput){
    fileInput.addEventListener('change', (e)=>{
      if(e.target.files && e.target.files.length>0) onImageLoaded(e.target.files[0]);
    });
  }

  // View selector or tabs
  const viewMode = qs('viewMode');
  if(viewMode){
    viewMode.addEventListener('change', (e)=> updateView(e.target.value));
  }

  // Colormap
  const colormap = qs('colormap');
  const edgeSensitivity = qs('edgeSensitivity');
  if(colormap || edgeSensitivity){
    const update = ()=> processHeatmap('Canny', Number(edgeSensitivity ? edgeSensitivity.value : 50), (colormap ? colormap.value : 'Jet'));
    if(colormap) colormap.addEventListener('change', update);
    if(edgeSensitivity) edgeSensitivity.addEventListener('input', update);
  }

  // Generate buttons
  const btnRouter = qs('generateRouter');
  const btnLaser = qs('generateLaser');
  if(btnRouter) btnRouter.addEventListener('click', ()=>{ taskManager.addTask(()=>{ generateGcode('router'); }, 'Generate Router Gcode'); });
  if(btnLaser) btnLaser.addEventListener('click', ()=>{ taskManager.addTask(()=>{ generateGcode('laser'); }, 'Generate Laser Gcode'); });

  // Top view / Simulation triggers
  const btnTop = qs('btnTopView');
  if(btnTop) btnTop.addEventListener('click', ()=>{ processTopView(); updateView('topview'); });

  // Cleanup on unload
  window.addEventListener('beforeunload', ()=>{ cleanupUI(); });
}
