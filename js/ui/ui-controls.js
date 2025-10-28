// ui-controls.js - core UI logic connecting CV, G-code, and Simulation
import { loadImageToMat, detectEdges, applyColormap, renderMatToCanvas, generateHeightMap, cleanupCV } from '../cv/cv-processing.js';
import { generateRasterGcode, generateContourGcode, generateLaserGcode } from '../gcode/gcode-generator.js';
import { renderGcodePreview, clearSimulation, setScaleZ } from '../three/simulation3d.js';
import { memoryManager } from '../core/memoryManager.js';
import { qs, show, hide, hideAll, setText, downloadFile } from './ui-helpers.js';

let currentImage = null;
let currentEdges = null;
let currentHeatmap = null;

export function updateView(mode){
  const map = {
    original: ['canvasOriginal'],
    heatmap: ['canvasHeatmap'],
    contour: ['canvasContour'],
    topview: ['canvasTopview'],
    simulation: ['threeContainer']
  };
  // hide all
  ['canvasOriginal','canvasHeatmap','canvasContour','canvasTopview','threeContainer'].forEach(id=>{ const e=qs(id); if(e) e.style.display='none'; });
  const showIds = map[mode] || ['canvasOriginal'];
  showIds.forEach(id=>{ const e=qs(id); if(e) e.style.display='block'; });
}

export async function onImageLoaded(file){
  try{
    const img = new Image();
    img.onload = async ()=>{ 
      // draw to original canvas to keep same behavior
      const c = qs('canvasOriginal');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0);
      // load mat via cv module
      try{
        currentImage = loadImageToMat(c);
        console.log('[UI] Image loaded into Mat');
        // auto-generate initial heatmap
        const sensitivity = Number(qs('edgeSensitivity') ? qs('edgeSensitivity').value : 50);
        await processHeatmap('Canny', sensitivity, qs('colormap') ? qs('colormap').value : 'Jet');
      }catch(e){ console.warn('CV loadImageToMat failed', e); }
    };
    img.src = URL.createObjectURL(file);
  }catch(e){ console.error('onImageLoaded error', e); }
}

export async function processHeatmap(method='Canny', sensitivity=50, colormap='Jet'){
  if(!currentImage){ console.warn('No image'); return; }
  try{
    if(currentEdges){ memoryManager.safeDelete(currentEdges); currentEdges = null; }
    if(currentHeatmap){ memoryManager.safeDelete(currentHeatmap); currentHeatmap = null; }
    currentEdges = detectEdges(currentImage, method, sensitivity);
    currentHeatmap = applyColormap(currentEdges, colormap);
    renderMatToCanvas(currentHeatmap, 'canvasHeatmap');
    renderMatToCanvas(currentEdges, 'canvasContour');
    console.log('[UI] Heatmap & Contour updated');
  }catch(e){ console.error('processHeatmap error', e); }
}

export async function processTopView(scaleZ=1.0, invert=false){
  if(!currentHeatmap){ console.warn('No heatmap'); return; }
  try{
    const hm = generateHeightMap(currentHeatmap, {invert});
    // topview currently render heatmap to canvasTopview
    renderMatToCanvas(currentHeatmap, 'canvasTopview');
    // optionally pass height map to 3D preview
    console.log('[UI] TopView generated', hm);
  }catch(e){ console.error('processTopView', e); }
}

export function generateGcode(type='router'){
  if(!currentHeatmap){ console.warn('No heatmap'); return; }
  try{
    const hm = generateHeightMap(currentHeatmap, {invert:false});
    let gcode = '';
    if(type==='router') gcode = generateRasterGcode(hm, { pixelSize:0.5, invertZ:true });
    else if(type==='laser') gcode = generateLaserGcode(hm, { pixelSize:0.5, invert:true });
    else gcode = '';
    // show in debug output area if exists
    const out = qs('gcodeOut');
    if(out) out.value = gcode;
    // render to 3D
    clearSimulation();
    renderGcodePreview(gcode);
    // download option
    downloadFile(type + '_gcode.nc', gcode);
    console.log('[UI] G-code generated');
  }catch(e){ console.error('generateGcode error', e); }
}

export function cleanupUI(){
  try{ cleanupCV(); memoryManager.cleanup(); clearSimulation(); }catch(e){ console.warn(e); }
}
