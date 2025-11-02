// ================= Generate Raster G-code للراوتر - الإصدار المحسن =================
function generateRasterGcode(scaleDown = false) {
  if (!grayMat || !contour) {
    throw new Error("لا توجد صورة جاهزة للمعالجة");
  }
  
  try {
    InputValidator.validateRouterSettings();
    
    const dir = document.getElementById('scanDir').value;
    lastScanDir = dir;
    const stepOver = parseFloat(document.getElementById('stepOver').value) || 5;
    const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3;
    const feed = parseFloat(document.getElementById('feedRate').value) || 800;
    const safeZ = parseFloat(document.getElementById('safeZ').value) || 5;

    const useFixedZ = document.getElementById('fixedZ').checked;
    const fixedZValue = parseFloat(document.getElementById('fixedZValue').value) || -1.0;
    const invertZ = document.getElementById('invertZ').checked;

    const workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
    const originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);

    const lines = [];
    lines.push('G21 G90 G17');
    lines.push('G0 Z' + safeZ.toFixed(2));

    let totalLen = 0;
    const step = scaleDown ? stepOver * 4 : stepOver;
    const scaleX = workWidth / previewCanvas.width;
    const scaleY = workHeight / previewCanvas.height;

    if (dir === 'x') {
      for (let y = 0; y < previewCanvas.height; y += step) {
        const rowPoints = [];
        let inContour = false;
        let segmentStart = -1;
        
        for (let x = 0; x < previewCanvas.width; x += 2) {
          const pt = new cv.Point(x, y);
          const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
          if (inside && !inContour) { 
            segmentStart = x; 
            inContour = true; 
          } else if (!inside && inContour) {
            addSegmentPoints(rowPoints, segmentStart, x - 1, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
            inContour = false;
          }
        }
        
        if (inContour) {
          addSegmentPoints(rowPoints, segmentStart, previewCanvas.width - 1, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
        }
        
        if (rowPoints.length > 1) {
          processRowPoints(rowPoints, lines, feed, safeZ, (y / step) % 2 !== 0);
          totalLen += calculateRowLength(rowPoints);
        }
      }
    } else if (dir === 'y') {
      for (let x = 0; x < previewCanvas.width; x += step) {
        const colPoints = [];
        let inContour = false;
        let segmentStart = -1;
        
        for (let y = 0; y < previewCanvas.height; y += 2) {
          const pt = new cv.Point(x, y);
          const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
          if (inside && !inContour) { 
            segmentStart = y; 
            inContour = true; 
          } else if (!inside && inContour) {
            addVerticalSegmentPoints(colPoints, x, segmentStart, y - 1, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
            inContour = false;
          }
        }
        
        if (inContour) {
          addVerticalSegmentPoints(colPoints, x, segmentStart, previewCanvas.height - 1, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue);
        }
        
        if (colPoints.length > 1) {
          processRowPoints(colPoints, lines, feed, safeZ, (x / step) % 2 !== 0);
          totalLen += calculateRowLength(colPoints);
        }
      }
    }

    lines.push('M5');
    lines.push('M30');

    // improved estimate
    const timeMin = (totalLen / (feed || 1)) + ((Math.max(0, safeZ) / 50) * (totalLen / 1000));
    document.getElementById('estTime').innerHTML = "⏱️ تقدير الوقت: " + timeMin.toFixed(1) + " دقيقة";

    return lines.join('\n');
  } catch (error) {
    console.error('خطأ في توليد G-code:', error);
    throw new Error('فشل في توليد G-code (Raster): ' + error.message);
  }
}

// ================= Generate Contour G-code للراوتر - الإصدار المحسن =================
function generateContourGcode() {
  if (!grayMat || !contour) {
    throw new Error("لا توجد بيانات حواف لتوليد الكود");
  }
  
  try {
    InputValidator.validateRouterSettings();
    
    const mode = document.getElementById('contourMode').value || 'outer';
    lastScanDir = 'contour';
    const feed = parseFloat(document.getElementById('feedRate').value) || 800;
    const safeZ = parseFloat(document.getElementById('safeZ').value) || 5;
    const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3;

    const useFixedZ = document.getElementById('fixedZ').checked;
    const fixedZValue = parseFloat(document.getElementById('fixedZValue').value) || -1.0;
    const invertZ = document.getElementById('invertZ').checked;

    const workWidth = cmToMm(parseFloat(document.getElementById('workWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('workHeight').value) || 20);
    const originX = cmToMm(parseFloat(document.getElementById('originX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('originY').value) || 0);
    const scaleX = workWidth / previewCanvas.width;
    const scaleY = workHeight / previewCanvas.height;

    const lines = [];
    lines.push('G21 G90 G17');
    lines.push('G0 Z' + safeZ.toFixed(2));

    const contoursToUse = (mode === 'outer') ? [contour] : [contour, ...additionalContours.map(c => c.contour)];
    let totalLen = 0;

    for (const cnt of contoursToUse) {
      if (!cnt) continue;
      
      const data = cnt.data32S;
      if (!data || data.length < 4) continue;

      let x0 = data[0], y0 = data[1];
      const startX = (x0 * scaleX + originX).toFixed(2);
      const startY = (y0 * scaleY + originY).toFixed(2);
      const startGray = sampleGrayAt(x0, y0);

      let zStart;
      if (useFixedZ) zStart = fixedZValue;
      else zStart = -((255 - startGray) / 255.0) * maxDepth;
      if (invertZ) zStart = -zStart;

      lines.push(`G0 X${startX} Y${startY} Z${safeZ.toFixed(2)}`);
      lines.push(`G1 F${feed.toFixed(0)}`);
      lines.push(`G1 Z${zStart.toFixed(3)}`);

      for (let i = 2; i < data.length; i += 2) {
        const x = data[i], y = data[i + 1];
        const px = (x * scaleX + originX).toFixed(2);
        const py = (y * scaleY + originY).toFixed(2);
        const pv = sampleGrayAt(x, y);
        let zVal;
        if (useFixedZ) zVal = fixedZValue;
        else zVal = -((255 - pv) / 255.0) * maxDepth;
        if (invertZ) zVal = -zVal;
        lines.push(`G1 X${px} Y${py} Z${zVal.toFixed(3)}`);
        totalLen += Math.hypot(x - x0, y - y0);
        x0 = x; y0 = y;
      }

      lines.push(`G1 X${startX} Y${startY} Z${zStart.toFixed(3)}`);
      lines.push(`G0 Z${safeZ.toFixed(2)}`);
    }

    lines.push('M5');
    lines.push('M30');

    const timeMin = totalLen / (parseFloat(document.getElementById('feedRate').value)||800);
    document.getElementById('estTime').innerHTML = "⏱️ تقدير الوقت (Contour): " + timeMin.toFixed(1) + " دقيقة";

    return lines.join('\n');

  } catch (error) {
    console.error('خطأ في توليد G-code الكنتور:', error);
    throw new Error('فشل في توليد G-code (Contour): ' + error.message);
  }
}