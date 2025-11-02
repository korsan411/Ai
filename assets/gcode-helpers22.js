// ================= Bilinear sampling from grayscale Mat - الإصدار المحسن =================
function sampleGrayAt(x, y) {
  try {
    if (!grayMat || !previewCanvas) return 128;
    
    const gw = grayMat.cols, gh = grayMat.rows;
    if (gw === 0 || gh === 0) return 128;
    
    // التحقق من الحدود
    const gx_f = Math.max(0, Math.min(gw - 1, (x / previewCanvas.width) * (gw - 1)));
    const gy_f = Math.max(0, Math.min(gh - 1, (y / previewCanvas.height) * (gh - 1)));
    
    const x0 = Math.floor(gx_f), y0 = Math.floor(gy_f);
    const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
    const sx = gx_f - x0, sy = gy_f - y0;
    
    // التحقق من حدود المصفوفة
    const idx00 = y0 * gw + x0;
    const idx10 = y0 * gw + x1;
    const idx01 = y1 * gw + x0;
    const idx11 = y1 * gw + x1;
    
    if (idx00 >= grayMat.data.length || idx10 >= grayMat.data.length || 
        idx01 >= grayMat.data.length || idx11 >= grayMat.data.length) {
      return 128;
    }
    
    const v00 = grayMat.data[idx00];
    const v10 = grayMat.data[idx10];
    const v01 = grayMat.data[idx01];
    const v11 = grayMat.data[idx11];
    
    const v0 = v00 * (1 - sx) + v10 * sx;
    const v1 = v01 * (1 - sx) + v11 * sx;
    return Math.round(v0 * (1 - sy) + v1 * sy);
  } catch (error) {
    console.warn('خطأ في أخذ عينات الرمادي:', error);
    return 128;
  }
}

// ================= Raster helpers - الإصدار المحسن =================
function addSegmentPoints(rowPoints, startX, endX, y, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue) {
  try {
    for (let x = startX; x <= endX; x += 2) {
      const pv = sampleGrayAt(x, y);
      let z;
      if (useFixedZ) {
        z = fixedZValue;
      } else {
        z = -((255 - pv) / 255.0) * maxDepth;
      }
      if (invertZ) z = -z;
      const scaledX = (x * scaleX) + originX;
      const scaledY = (y * scaleY) + originY;
      rowPoints.push({ x: scaledX, y: scaledY, z });
    }
  } catch (error) {
    console.warn('خطأ في إضافة نقاط المقطع:', error);
  }
}

function addVerticalSegmentPoints(colPoints, x, startY, endY, scaleX, scaleY, originX, originY, maxDepth, invertZ, useFixedZ, fixedZValue) {
  try {
    for (let y = startY; y <= endY; y += 2) {
      const pv = sampleGrayAt(x, y);
      let z;
      if (useFixedZ) {
        z = fixedZValue;
      } else {
        z = -((255 - pv) / 255.0) * maxDepth;
      }
      if (invertZ) z = -z;
      const scaledX = (x * scaleX) + originX;
      const scaledY = (y * scaleY) + originY;
      colPoints.push({ x: scaledX, y: scaledY, z });
    }
  } catch (error) {
    console.warn('خطأ في إضافة نقاط المقطع الرأسي:', error);
  }
}

function processRowPoints(rowPoints, lines, feed, safeZ, reverse) {
  try {
    if (reverse) rowPoints.reverse();
    if (rowPoints.length === 0) return;
    
    lines.push('G0 X' + rowPoints[0].x.toFixed(2) + ' Y' + rowPoints[0].y.toFixed(2) + ' Z' + safeZ.toFixed(2));
    lines.push('G1 F' + feed.toFixed(0));
    
    for (let i = 0; i < rowPoints.length; i++) {
      const p = rowPoints[i];
      lines.push('G1 X' + p.x.toFixed(2) + ' Y' + p.y.toFixed(2) + ' Z' + p.z.toFixed(3));
    }
    
    lines.push('G0 Z' + safeZ.toFixed(2));
  } catch (error) {
    console.warn('خطأ في معالجة نقاط الصف:', error);
  }
}

function calculateRowLength(rowPoints) {
  try {
    let length = 0;
    for (let i = 1; i < rowPoints.length; i++) {
      length += Math.hypot(rowPoints[i].x - rowPoints[i-1].x, rowPoints[i].y - rowPoints[i-1].y);
    }
    return length;
  } catch {
    return 0;
  }
}