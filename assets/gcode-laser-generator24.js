// ================= Laser G-code Generation - الإصدار المحسن =================
function generateLaserEngraveGcode() {
  if (!grayMat || !contour) {
    throw new Error("لا توجد صورة جاهزة للمعالجة");
  }

  try {
    InputValidator.validateLaserSettings();
    
    const laserPower = parseInt(document.getElementById('laserPower').value) || 80;
    const laserSpeed = parseInt(document.getElementById('laserSpeed').value) || 2000;
    const dynamicPower = document.getElementById('laserDynamic').checked;

    const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
    const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);

    const lines = [];
    lines.push('G21 G90');
    lines.push('G0 X0 Y0');
    lines.push('M3 S' + Math.round(laserPower * 10));
    
    const scaleX = workWidth / previewCanvas.width;
    const scaleY = workHeight / previewCanvas.height;
    
    const stepOver = 3.0;
    let totalLen = 0;
    let pointCount = 0;

    for (let y = 0; y < previewCanvas.height; y += stepOver) {
      const rowPoints = [];
      
      for (let x = 0; x < previewCanvas.width; x += 3) {
        const pt = new cv.Point(x, y);
        const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
        
        if (inside) {
          const pv = sampleGrayAt(x, y);
          const power = dynamicPower ? Math.round((pv / 255) * laserPower) : laserPower;
          const scaledX = (x * scaleX) + originX;
          const scaledY = (y * scaleY) + originY;
          rowPoints.push({ x: scaledX, y: scaledY, power });
          pointCount++;
          
          if (pointCount > 2000) break;
        }
      }
      
      if (rowPoints.length > 1) {
        const reverse = (y / stepOver) % 2 !== 0;
        if (reverse) rowPoints.reverse();
        
        lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2));
        lines.push('G1 F' + laserSpeed.toFixed(0));
        
        for (let i = 0; i < rowPoints.length; i++) {
          const p = rowPoints[i];
          lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2));
        }
        
        totalLen += calculateRowLength(rowPoints);
      }
      
      if (pointCount > 2000) break;
    }

    lines.push('M5');
    lines.push('M30');

    const timeMin = totalLen / laserSpeed;
    document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت الليزر: " + timeMin.toFixed(1) + " دقيقة | " + pointCount + " نقطة";

    return lines.join('\n');
  } catch (error) {
    console.error('خطأ في توليد كود الليزر:', error);
    throw new Error('فشل في توليد كود الليزر: ' + error.message);
  }
}

function generateLaserQuickGcode() {
  if (!grayMat || !contour) {
    throw new Error("لا توجد صورة جاهزة للمعالجة");
  }

  try {
    const laserPower = 80;
    const laserSpeed = 3000;

    const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
    const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);

    const lines = [];
    lines.push('G21 G90');
    lines.push('G0 X0 Y0');
    lines.push('M3 S800');
    
    const scaleX = workWidth / previewCanvas.width;
    const scaleY = workHeight / previewCanvas.height;
    
    const stepOver = 5.0;
    let totalLen = 0;
    let pointCount = 0;

    for (let y = 0; y < previewCanvas.height; y += stepOver) {
      const rowPoints = [];
      
      for (let x = 0; x < previewCanvas.width; x += 5) {
        const pt = new cv.Point(x, y);
        const inside = cv.pointPolygonTest(contour, pt, false) >= 0;
        
        if (inside) {
          const scaledX = (x * scaleX) + originX;
          const scaledY = (y * scaleY) + originY;
          rowPoints.push({ x: scaledX, y: scaledY });
          pointCount++;
          
          if (pointCount > 1000) break;
        }
      }
      
      if (rowPoints.length > 1) {
        const reverse = (y / stepOver) % 2 !== 0;
        if (reverse) rowPoints.reverse();
        
        lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2));
        lines.push('G1 F' + laserSpeed.toFixed(0));
        
        for (let i = 0; i < rowPoints.length; i++) {
          const p = rowPoints[i];
          lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2));
        }
        
        totalLen += calculateRowLength(rowPoints);
      }
      
      if (pointCount > 1000) break;
    }

    lines.push('M5');
    lines.push('M30');

    document.getElementById('estTime').innerHTML = "⏱️ وضع سريع: " + pointCount + " نقطة";

    return lines.join('\n');
  } catch (error) {
    console.error('خطأ في التوليد السريع للليزر:', error);
    throw new Error('فشل في التوليد السريع: ' + error.message);
  }
}

function generateLaserCutGcode() {
  if (!grayMat || !contour) {
    throw new Error("لا توجد بيانات حواف لتوليد كود القص");
  }

  try {
    InputValidator.validateLaserSettings();
    
    const laserPower = parseInt(document.getElementById('laserPower').value) || 80;
    const laserSpeed = parseInt(document.getElementById('laserSpeed').value) || 1000;
    const laserPasses = parseInt(document.getElementById('laserPasses').value) || 1;
    const airAssist = document.getElementById('laserAirAssist').checked;

    const workWidth = cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20);
    const originX = cmToMm(parseFloat(document.getElementById('laserOriginX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('laserOriginY').value) || 0);
    const scaleX = workWidth / previewCanvas.width;
    const scaleY = workHeight / previewCanvas.height;

    const lines = [];
    lines.push('G21 G90');
    if (airAssist) lines.push('M8');

    const contoursToUse = [contour, ...additionalContours.map(c => c.contour)].filter(c => c);
    let totalLen = 0;

    for (let pass = 0; pass < laserPasses; pass++) {
      for (const cnt of contoursToUse) {
        const data = cnt.data32S;
        if (!data || data.length < 4) continue;

        let x0 = data[0], y0 = data[1];
        const startX = (x0 * scaleX + originX).toFixed(2);
        const startY = (y0 * scaleY + originY).toFixed(2);

        lines.push(`G0 X${startX} Y${startY}`);
        lines.push(`M3 S${Math.round(laserPower * 10)}`);
        lines.push(`G1 F${laserSpeed.toFixed(0)}`);

        for (let i = 2; i < data.length; i += 2) {
          const x = data[i], y = data[i + 1];
          const px = (x * scaleX + originX).toFixed(2);
          const py = (y * scaleY + originY).toFixed(2);
          lines.push(`G1 X${px} Y${py}`);
          totalLen += Math.hypot(x - x0, y - y0);
          x0 = x; y0 = y;
        }

        lines.push(`G1 X${startX} Y${startY}`);
        lines.push('M5');
      }
    }

    if (airAssist) lines.push('M9');
    lines.push('M30');

    const timeMin = totalLen / laserSpeed;
    document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت القص: " + timeMin.toFixed(1) + " دقيقة";

    return lines.join('\n');

  } catch (error) {
    console.error('خطأ في توليد كود قص الليزر:', error);
    throw new Error('فشل في توليد كود قص الليزر: ' + error.message);
  }
}