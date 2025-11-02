// ================= Rendering heatmap & contour (colormaps) - الإصدار المحسن =================
function renderHeatmap() {
  try {
    if (!grayMat || !previewCanvas) return;
    
    const heatCanvas = document.getElementById('canvasHeatmap');
    if (!heatCanvas) return;
    
    const ctx = heatCanvas.getContext('2d');
    if (!ctx) return;
    
    heatCanvas.width = grayMat.cols;
    heatCanvas.height = grayMat.rows;
    const imgData = ctx.createImageData(heatCanvas.width, heatCanvas.height);
    const data = grayMat.data;
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const t = value / 255.0;
      const col = getColormapColor(t, currentColormap);
      const idx = i * 4;
      imgData.data[idx] = col.r;
      imgData.data[idx + 1] = col.g;
      imgData.data[idx + 2] = col.b;
      imgData.data[idx + 3] = 255;
    }
    
    ctx.putImageData(imgData, 0, 0);
    showElement('canvasHeatmap', 'heatmapPlaceholder');

    // also update contour view (overlay)
    try {
      if (contour) renderContour(grayMat, contour);
    } catch(e){
      console.warn('فشل في عرض الكنتور:', e);
    }
    
    // update top view if G-code exists
    if (lastGeneratedGcode) {
      renderTopViewFromGcode(lastGeneratedGcode);
    }
  } catch (error) {
    console.error('فشل في عرض heatmap:', error);
  }
}

function renderContour(gray, mainContour) {
  try {
    const contourCanvas = document.getElementById('canvasContour');
    if (!contourCanvas) return;
    
    const ctx = contourCanvas.getContext('2d');
    if (!ctx) return;
    
    contourCanvas.width = gray.cols;
    contourCanvas.height = gray.rows;
    const heatCanvas = document.getElementById('canvasHeatmap');
    
    // draw heatmap first
    try {
      if (heatCanvas) {
        ctx.drawImage(heatCanvas, 0, 0);
      } else {
        ctx.fillStyle = '#222';
        ctx.fillRect(0,0,contourCanvas.width, contourCanvas.height);
      }
    } catch(e) {
      ctx.fillStyle = '#222';
      ctx.fillRect(0,0,contourCanvas.width, contourCanvas.height);
    }
    
    if (mainContour) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const data = mainContour.data32S;
      for (let i = 0; i < data.length; i += 2) {
        const x = data[i], y = data[i + 1];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    additionalContours.forEach(ci => {
      try {
        const cnt = ci.contour;
        if (!cnt) return;
        
        ctx.beginPath();
        const d = cnt.data32S;
        for (let i = 0; i < d.length; i += 2) {
          const x = d[i], y = d[i+1];
          if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath();
        ctx.stroke();
      } catch(e) { 
        console.warn('خطأ في عرض الكنتور الإضافي:', e); 
      }
    });
    
    showElement('canvasContour', 'contourPlaceholder');
  } catch (error) {
    console.error('فشل في عرض الكنتور:', error);
  }
}