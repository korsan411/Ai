// ================= Top View rendering - الإصدار المحسن =================
function renderTopViewFromGcode(gcode) {
  try {
    if (!previewCanvas && !threeDModel) return;
    
    const topCanvas = document.getElementById('topView');
    const legendDiv = document.getElementById('topLegend');
    if (!topCanvas || !legendDiv) return;
    
    const tw = Math.min(400, 400); // تقليل الدقة للأداء
    const th = Math.min(300, 300);
    
    topCanvas.width = tw; 
    topCanvas.height = th;
    const ctx = topCanvas.getContext('2d');
    if (!ctx) return;

    const depthMap = new Float32Array(tw * th);
    const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3.0;

    const points = parseGcodeForSimulation(gcode);

    const machineType = document.getElementById('machineCategory').value;
    const isLaser = machineType === 'laser';
    const is3D = machineType === 'threed';
    
    // wood color base for router, dark platform for laser, gray for 3D
    let baseRgb;
    if (is3D) {
      baseRgb = { r: 60, g: 60, b: 60 };
    } else if (isLaser) {
      baseRgb = { r: 40, g: 40, b: 40 };
    } else {
      baseRgb = hexToRgb(document.getElementById('woodColor').value || '#a0522d');
    }
    const blackRgb = { r: 10, g: 6, b: 3 };

    // mm -> pixel mapping
    let workWidth, workHeight, originX, originY;
    
    if (is3D) {
      workWidth = cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30);
      workHeight = cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20);
      originX = cmToMm(parseFloat(document.getElementById('threedOriginX').value) || 0);
      originY = cmToMm(parseFloat(document.getElementById('threedOriginY').value) || 0);
    } else if (isLaser) {
      workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
      workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
      originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
      originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);
    } else {
      workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
      workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
      originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
      originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);
    }

    function mmToPixel(px_mm_x, px_mm_y) {
      const xRatio = (px_mm_x - originX) / workWidth;
      const yRatio = (px_mm_y - originY) / workHeight;
      const xPix = Math.round(xRatio * (tw - 1));
      // invert Y to match visual orientation
      const yPix = th - 1 - Math.round(yRatio * (th - 1));
      return { x: xPix, y: yPix };
    }

    // init depth map
    for (let i=0;i<depthMap.length;i++) depthMap[i]=0;

    // If no points and we have a 3D model, create a simple representation
    if ((!points || points.length === 0) && threeDModel && is3D) {
      const imgData = ctx.createImageData(tw, th);
      // Create a simple top-down view of the 3D model
      for (let y=0;y<th;y++){
        for (let x=0;x<tw;x++){
          // Simple projection - in a real app you'd project the 3D model
          const normalizedX = x / tw;
          const normalizedY = y / th;
          
          // Create a pattern based on position
          const pattern = (Math.sin(normalizedX * 10) + Math.cos(normalizedY * 10)) / 2;
          const t = (pattern + 1) / 2; // Normalize to 0-1
          
          const cmapCol = getColormapColor(t, currentColormap);
          const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
          const finalCol = mixColors(mixed1, cmapCol, 0.5);
          const idx = (y*tw + x)*4;
          imgData.data[idx]=finalCol.r; 
          imgData.data[idx+1]=finalCol.g; 
          imgData.data[idx+2]=finalCol.b; 
          imgData.data[idx+3]=255;
        }
      }
      ctx.putImageData(imgData,0,0);
      drawTopLegend(currentColormap);
      return;
    }

    // If no points, fallback to grayscale->depth using image (for 2D modes)
    if (!points || points.length === 0) {
      if (!previewCanvas) return;
      
      const imgData = ctx.createImageData(tw, th);
      for (let y=0;y<th;y++){
        for (let x=0;x<tw;x++){
          const v = sampleGrayAt(
            (x / tw) * previewCanvas.width, 
            (y / th) * previewCanvas.height
          );
          const depth = ((255 - v)/255.0)*maxDepth;
          const t = depth / maxDepth;
          const cmapCol = getColormapColor(t, currentColormap);
          const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
          const finalCol = mixColors(mixed1, cmapCol, isLaser ? 0.5 : 0.35);
          const idx = (y*tw + x)*4;
          imgData.data[idx]=finalCol.r; 
          imgData.data[idx+1]=finalCol.g; 
          imgData.data[idx+2]=finalCol.b; 
          imgData.data[idx+3]=255;
        }
      }
      ctx.putImageData(imgData,0,0);
      drawTopLegend(currentColormap);
      return;
    }

    // accumulate depths from gcode points
    for (let i=0;i<points.length;i++) {
      const p = points[i];
      if (typeof p.x === 'undefined') continue;
      const coords = mmToPixel(p.x, p.y);
      if (coords.x < 0 || coords.x >= tw || coords.y < 0 || coords.y >= th) continue;
      const depth = is3D ? Math.abs(p.z) : (isLaser ? Math.abs(p.z) : Math.min(Math.abs(p.z), maxDepth));
      const idx = coords.y * tw + coords.x;
      depthMap[idx] = Math.max(depthMap[idx], depth);
    }

    const imgData = ctx.createImageData(tw, th);
    for (let y=0;y<th;y++) {
      for (let x=0;x<tw;x++) {
        const idx = y*tw + x;
        const d = Math.min(depthMap[idx], maxDepth);
        const t = (maxDepth === 0) ? 0 : (d / maxDepth);
        const cmapCol = getColormapColor(t, currentColormap);
        const mixed1 = mixColors(baseRgb, blackRgb, t*0.6);
        const finalCol = mixColors(mixed1, cmapCol, is3D ? 0.7 : (isLaser ? 0.5 : 0.35));
        const di = (y*tw + x)*4;
        imgData.data[di] = finalCol.r;
        imgData.data[di+1] = finalCol.g;
        imgData.data[di+2] = finalCol.b;
        imgData.data[di+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // draw legend gradient for current colormap
    drawTopLegend(currentColormap);

  } catch (e) {
    console.error('خطأ في عرض العرض العلوي:', e);
  }
}

function drawTopLegend(map) {
  try {
    const legend = document.getElementById('topLegend');
    if (!legend) return;
    
    const steps = 6;
    const stops = [];
    for (let i=0;i<=steps;i++){
      const t = i / steps;
      const c = getColormapColor(t, map);
      stops.push(`rgb(${c.r},${c.g},${c.b}) ${Math.round((i/steps)*100)}%`);
    }
    legend.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  } catch(e){
    console.warn('فشل في رسم وسيلة الإيضاح:', e);
  }
}