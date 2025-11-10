// ================= إعدادات الألوان القابلة للتخصيص =================

// ✅ خيارات أنماط الألوان
const colorSchemes = {
  ocean: {
    name: "Ocean 🌊",
    function: getOceanColors
  },
  hot: {
    name: "Hot 🔥", 
    function: getHotColors
  },
  forest: {
    name: "Forest 🌳",
    function: getForestColors
  },
  sunset: {
    name: "Sunset 🌅",
    function: getSunsetColors
  },
  plasma: {
    name: "Plasma ⚡",
    function: getPlasmaColors
  }
};

// ✅ المتغير الحالي لنمط الألوان
let currentColorScheme = 'ocean';

// ✅ دالة لتعيين نمط الألوان
function setColorScheme(schemeName) {
  if (colorSchemes[schemeName]) {
    currentColorScheme = schemeName;
    
    // ✅ حفظ التفضيل في localStorage
    localStorage.setItem('preferredColorScheme', schemeName);
    
    // ✅ تحديث الواجهة إذا كانت موجودة
    updateColorSchemeUI();
    
    console.log('تم تغيير نمط الألوان إلى:', colorSchemes[schemeName].name);
  } else {
    console.warn('نمط الألوان غير معروف:', schemeName);
  }
}

// ✅ دالة لتحديث واجهة اختيار الألوان
function updateColorSchemeUI() {
  const selector = document.getElementById('colorSchemeSelector');
  if (selector) {
    selector.value = currentColorScheme;
    
    // ✅ تحديث عرض الاسم الحالي
    const currentSchemeDisplay = document.getElementById('currentSchemeDisplay');
    if (currentSchemeDisplay) {
      currentSchemeDisplay.textContent = colorSchemes[currentColorScheme].name;
      currentSchemeDisplay.style.color = getSchemePreviewColor(currentColorScheme);
    }
  }
}

// ✅ دالة للحصول على لون معاينة للنمط
function getSchemePreviewColor(schemeName) {
  const previewColors = {
    ocean: '#4a90e2',
    hot: '#ff4500', 
    forest: '#228b22',
    sunset: '#ff6347',
    plasma: '#8a2be2'
  };
  return previewColors[schemeName] || '#4a90e2';
}

// ✅ دالة لإنشاء واجهة اختيار الألوان
function createColorSchemeSelector() {
  // ✅ التحقق إذا كانت الواجهة موجودة مسبقاً
  if (document.getElementById('colorSchemeSelector')) {
    return;
  }
  
  const controlsContainer = document.getElementById('topViewControls') || 
                           document.querySelector('.controls') || 
                           document.createElement('div');
  
  if (!document.getElementById('topViewControls') && !document.querySelector('.controls')) {
    controlsContainer.id = 'topViewControls';
    controlsContainer.style.marginBottom = '15px';
    controlsContainer.style.padding = '10px';
    controlsContainer.style.background = 'rgba(30, 30, 50, 0.8)';
    controlsContainer.style.borderRadius = '8px';
    controlsContainer.style.border = '1px solid #444';
    
    const topViewContainer = document.getElementById('topView').parentElement;
    if (topViewContainer) {
      topViewContainer.insertBefore(controlsContainer, document.getElementById('topView'));
    }
  }
  
  // ✅ إنشاء عناصر التحكم
  const selectorHTML = `
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <label style="color: white; font-weight: bold; font-size: 14px;">
        🎨 نمط الألوان:
      </label>
      <select id="colorSchemeSelector" style="
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #555;
        background: #2a2a4a;
        color: white;
        font-size: 14px;
        cursor: pointer;
        min-width: 120px;
      ">
        <option value="ocean">Ocean 🌊</option>
        <option value="hot">Hot 🔥</option>
        <option value="forest">Forest 🌳</option>
        <option value="sunset">Sunset 🌅</option>
        <option value="plasma">Plasma ⚡</option>
      </select>
      <span id="currentSchemeDisplay" style="
        font-size: 12px;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255,255,255,0.1);
      ">Ocean 🌊</span>
    </div>
  `;
  
  controlsContainer.innerHTML = selectorHTML + controlsContainer.innerHTML;
  
  // ✅ إضافة event listener
  const selector = document.getElementById('colorSchemeSelector');
  selector.addEventListener('change', function(e) {
    setColorScheme(e.target.value);
    
    // ✅ إعادة رسم العرض إذا كان هناك G-code محمل
    const gcodeTextarea = document.getElementById('gcode') || 
                         document.querySelector('textarea');
    if (gcodeTextarea && gcodeTextarea.value.trim()) {
      renderTopViewFromGcode(gcodeTextarea.value);
    } else {
      // ✅ إعادة رسم العرض التجريبي
      const topCanvas = document.getElementById('topView');
      if (topCanvas) {
        const ctx = topCanvas.getContext('2d');
        renderHighQualityDemo(ctx, topCanvas.width, topCanvas.height, 
                            window.devicePixelRatio || 2);
        drawHighQualityLegend();
      }
    }
  });
  
  // ✅ تحميل التفضيلات المحفوظة
  const savedScheme = localStorage.getItem('preferredColorScheme');
  if (savedScheme && colorSchemes[savedScheme]) {
    setColorScheme(savedScheme);
  } else {
    updateColorSchemeUI();
  }
}

// ✅ دالة الحصول على الألوان الحالية
function getCurrentColors(value) {
  return colorSchemes[currentColorScheme].function(value);
}

// ================= الدوال الأساسية للألوان =================

// ✅ دالة ألوان Ocean (محيطية)
function getOceanColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.33) {
    const intensity = value * 3;
    return {
      r: Math.round(0 + 50 * intensity),
      g: Math.round(50 + 100 * intensity),
      b: Math.round(100 + 155 * intensity)
    };
  } else if (value < 0.66) {
    const intensity = (value - 0.33) * 3;
    return {
      r: Math.round(50 + 100 * intensity),
      g: Math.round(150 + 80 * intensity),
      b: 255
    };
  } else {
    const intensity = (value - 0.66) * 3;
    return {
      r: Math.round(150 + 105 * intensity),
      g: Math.round(230 + 25 * intensity),
      b: Math.round(255 - 100 * intensity)
    };
  }
}

// ✅ دالة ألوان Hot الكلاسيكية
function getHotColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.4) {
    const intensity = value * 2.5;
    return {
      r: Math.round(0 + 255 * intensity),
      g: 0,
      b: 0
    };
  } else if (value < 0.8) {
    const intensity = (value - 0.4) * 2.5;
    return {
      r: 255,
      g: Math.round(0 + 255 * intensity),
      b: 0
    };
  } else {
    const intensity = (value - 0.8) * 5;
    return {
      r: 255,
      g: 255,
      b: Math.round(0 + 255 * intensity)
    };
  }
}

// ✅ دالة ألوان Forest (غابات)
function getForestColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.25) {
    const intensity = value * 4;
    return {
      r: Math.round(30 + 40 * intensity),
      g: Math.round(60 + 60 * intensity),
      b: Math.round(30 + 40 * intensity)
    };
  } else if (value < 0.5) {
    const intensity = (value - 0.25) * 4;
    return {
      r: Math.round(70 + 80 * intensity),
      g: Math.round(120 + 80 * intensity),
      b: Math.round(70 + 50 * intensity)
    };
  } else if (value < 0.75) {
    const intensity = (value - 0.5) * 4;
    return {
      r: Math.round(150 + 80 * intensity),
      g: Math.round(200 + 55 * intensity),
      b: Math.round(120 + 60 * intensity)
    };
  } else {
    const intensity = (value - 0.75) * 4;
    return {
      r: Math.round(230 + 25 * intensity),
      g: Math.round(255 - 50 * intensity),
      b: Math.round(180 - 80 * intensity)
    };
  }
}

// ✅ دالة ألوان Sunset (غروب)
function getSunsetColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.2) {
    const intensity = value * 5;
    return {
      r: Math.round(70 + 80 * intensity),
      g: Math.round(40 + 60 * intensity),
      b: Math.round(100 + 50 * intensity)
    };
  } else if (value < 0.4) {
    const intensity = (value - 0.2) * 5;
    return {
      r: Math.round(150 + 80 * intensity),
      g: Math.round(100 + 80 * intensity),
      b: Math.round(150 - 50 * intensity)
    };
  } else if (value < 0.6) {
    const intensity = (value - 0.4) * 5;
    return {
      r: Math.round(230 + 25 * intensity),
      g: Math.round(180 + 50 * intensity),
      b: Math.round(100 - 50 * intensity)
    };
  } else if (value < 0.8) {
    const intensity = (value - 0.6) * 5;
    return {
      r: 255,
      g: Math.round(230 + 25 * intensity),
      b: Math.round(50 + 30 * intensity)
    };
  } else {
    const intensity = (value - 0.8) * 5;
    return {
      r: 255,
      g: Math.round(255 - 50 * intensity),
      b: Math.round(80 + 175 * intensity)
    };
  }
}

// ✅ دالة ألوان Plasma (متقدة)
function getPlasmaColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.25) {
    const intensity = value * 4;
    return {
      r: Math.round(0 + 50 * intensity),
      g: 0,
      b: Math.round(100 + 155 * intensity)
    };
  } else if (value < 0.5) {
    const intensity = (value - 0.25) * 4;
    return {
      r: Math.round(50 + 150 * intensity),
      g: Math.round(0 + 100 * intensity),
      b: 255
    };
  } else if (value < 0.75) {
    const intensity = (value - 0.5) * 4;
    return {
      r: Math.round(200 + 55 * intensity),
      g: Math.round(100 + 155 * intensity),
      b: Math.round(255 - 150 * intensity)
    };
  } else {
    const intensity = (value - 0.75) * 4;
    return {
      r: 255,
      g: Math.round(255 - 100 * intensity),
      b: Math.round(105 + 150 * intensity)
    };
  }
}

// ✅ دالة ألوان Hot معدلة للوضوح
function getEnhancedHotColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.25) {
    const intensity = value * 4;
    return {
      r: Math.round(50 + 205 * intensity),
      g: 0,
      b: 0
    };
  } else if (value < 0.5) {
    const intensity = (value - 0.25) * 4;
    return {
      r: 255,
      g: Math.round(0 + 128 * intensity),
      b: 0
    };
  } else if (value < 0.75) {
    const intensity = (value - 0.5) * 4;
    return {
      r: 255,
      g: Math.round(128 + 127 * intensity),
      b: 0
    };
  } else {
    const intensity = (value - 0.75) * 4;
    return {
      r: 255,
      g: 255,
      b: Math.round(0 + 255 * intensity)
    };
  }
}

// ✅ دالة ألوان Hot مع لمسات زرقاء
function getHotWithCoolColors(value) {
  value = Math.max(0, Math.min(1, value));
  
  if (value < 0.2) {
    const intensity = value * 5;
    return {
      r: 0,
      g: Math.round(0 + 100 * intensity),
      b: Math.round(100 + 155 * intensity)
    };
  } else if (value < 0.4) {
    const intensity = (value - 0.2) * 5;
    return {
      r: Math.round(0 + 128 * intensity),
      g: Math.round(100 - 100 * intensity),
      b: 255
    };
  } else if (value < 0.6) {
    const intensity = (value - 0.4) * 5;
    return {
      r: Math.round(128 + 127 * intensity),
      g: 0,
      b: Math.round(255 - 255 * intensity)
    };
  } else if (value < 0.8) {
    const intensity = (value - 0.6) * 5;
    return {
      r: 255,
      g: Math.round(0 + 128 * intensity),
      b: 0
    };
  } else {
    const intensity = (value - 0.8) * 5;
    return {
      r: 255,
      g: Math.round(128 + 127 * intensity),
      b: 0
    };
  }
}

// ✅ دالة لاستخراج حجم العمل من G-code
function extractWorkSizeFromGcode(gcode) {
  if (!gcode || typeof gcode !== 'string') {
    return { width: 400, height: 300 }; // القيم الافتراضية
  }
  
  const lines = gcode.split('\n');
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let hasData = false;
  
  // البحث عن إحداثيات X و Y في G-code
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // تخطي التعليقات والأسطر الفارغة
    if (line.startsWith(';') || line.startsWith('(') || line.length === 0) {
      continue;
    }
    
    // البحث عن أوامر الحركة (G0, G1, G2, G3)
    if (line.startsWith('G0') || line.startsWith('G1') || line.startsWith('G2') || line.startsWith('G3')) {
      const xMatch = line.match(/X([-\d.]+)/);
      const yMatch = line.match(/Y([-\d.]+)/);
      
      if (xMatch) {
        const x = parseFloat(xMatch[1]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        hasData = true;
      }
      
      if (yMatch) {
        const y = parseFloat(yMatch[1]);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hasData = true;
      }
    }
  }
  
  // إذا لم توجد بيانات، استخدام القيم الافتراضية
  if (!hasData || minX === Infinity || maxX === -Infinity) {
    return { width: 400, height: 300 };
  }
  
  // حساب الأبعاد مع هامش
  const margin = Math.max((maxX - minX), (maxY - minY)) * 0.1;
  const width = (maxX - minX) + (margin * 2);
  const height = (maxY - minY) + (margin * 2);
  
  return {
    width: Math.max(width, 100),  // حد أدنى 100mm
    height: Math.max(height, 100), // حد أدنى 100mm
    minX: minX - margin,
    maxX: maxX + margin,
    minY: minY - margin,
    maxY: maxY + margin
  };
}

// ✅ دالة مساعدة لتفتيح اللون
function lightenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

// ✅ حساب حدود مبسط
function calculateSimpleBounds(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  
  const margin = Math.max(maxX - minX, maxY - minY) * 0.1;
  
  return {
    minX: minX - margin,
    maxX: maxX + margin,
    minY: minY - margin,
    maxY: maxY + margin
  };
}

// ✅ دالة محسنة لتحليل G-code
function parseGcodeForTopView(gcode) {
  if (!gcode || typeof gcode !== 'string') {
    return [];
  }
  
  const points = [];
  const lines = gcode.split('\n');
  
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith(';') || line.startsWith('(') || line.length === 0) {
      continue;
    }
    
    if (line.startsWith('G0') || line.startsWith('G1') || line.startsWith('G2') || line.startsWith('G3')) {
      let x = null, y = null, z = null;
      
      const xMatch = line.match(/X([-\d.]+)/);
      const yMatch = line.match(/Y([-\d.]+)/);
      const zMatch = line.match(/Z([-\d.]+)/);
      
      if (xMatch) x = parseFloat(xMatch[1]);
      if (yMatch) y = parseFloat(yMatch[1]);
      if (zMatch) z = parseFloat(zMatch[1]);
      
      if (x !== null) currentX = x;
      if (y !== null) currentY = y;
      if (z !== null) currentZ = z;
      
      if (x !== null || y !== null) {
        points.push({
          x: currentX,
          y: currentY,
          z: currentZ
        });
      }
    }
  }
  
  return points;
}

// ✅ نسخة مبسطة للعرض
function renderSimpleDemo(ctx, width, height) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);
  
  const previewColor = getSchemePreviewColor(currentColorScheme);
  ctx.fillStyle = previewColor;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎨 معاينة التصميم', width/2, height/2);
}

// ✅ نسخة مبسطة للوسيلة
function drawSimpleLegend() {
  try {
    const legend = document.getElementById('topLegend');
    if (!legend) return;
    
    const steps = 5;
    const stops = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const color = getCurrentColors(t);
      stops.push(`rgb(${color.r},${color.g},${color.b}) ${Math.round((i/steps)*100)}%`);
    }
    
    const borderColor = getSchemePreviewColor(currentColorScheme);
    
    legend.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    legend.style.border = `2px solid ${borderColor}`;
    legend.style.height = '30px';
    legend.style.borderRadius = '5px';
    legend.style.marginTop = '10px';
    
  } catch(e) {
    console.warn('فشل في رسم وسيلة الإيضاح:', e);
  }
}

// ✅ تصميم تجريبي عالي الجودة
function renderHighQualityDemo(ctx, width, height, scaleFactor) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  // ✅ رسم دائرة بلون النمط الحالي
  const radius = Math.min(width, height) * 0.3;
  const previewColor = getSchemePreviewColor(currentColorScheme);
  ctx.strokeStyle = previewColor;
  ctx.lineWidth = 4 / scaleFactor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  
  // ✅ نص
  ctx.fillStyle = previewColor;
  ctx.font = `bold ${24 / scaleFactor}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('🎨 معاينة عالية الجودة', centerX, centerY - 30 / scaleFactor);
  
  // ✅ نص ثانوي بلون أفتح
  const lightColor = lightenColor(previewColor, 40);
  ctx.fillStyle = lightColor;
  ctx.font = `${16 / scaleFactor}px Arial`;
  ctx.fillText('قم بتحميل ملف G-code', centerX, centerY + 30 / scaleFactor);
}

// ✅ دالة عالية الجودة مبسطة
function renderHighQualityGcode(ctx, width, height, points, maxDepth, scaleFactor, workSize) {
  const depthMap = new Float32Array(width * height);
  depthMap.fill(0);

  // ✅ استخدام الحدود المستخرجة من G-code أو حساب جديدة
  let bounds = workSize && workSize.minX ? workSize : calculateSimpleBounds(points);
  
  function mmToPixel(px_mm_x, px_mm_y) {
    const xRatio = (px_mm_x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
    const yRatio = (px_mm_y - bounds.minY) / (bounds.maxY - bounds.minY || 1);
    const xPix = Math.round(xRatio * (width - 1));
    const yPix = height - 1 - Math.round(yRatio * (height - 1));
    return { x: xPix, y: yPix };
  }

  // ✅ تعبئة خريطة العمق
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      const coords = mmToPixel(p.x, p.y);
      const depth = Math.abs(p.z || 0);
      
      if (coords.x >= 0 && coords.x < width && coords.y >= 0 && coords.y < height) {
        const idx = coords.y * width + coords.x;
        depthMap[idx] = Math.max(depthMap[idx], depth);
      }
    }
  }

  const imgData = ctx.createImageData(width, height);
  
  // ✅ خلفية داكنة
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 20;
    imgData.data[i + 1] = 30;
    imgData.data[i + 2] = 50;
    imgData.data[i + 3] = 255;
  }
  
  // ✅ إيجاد أقصى عمق
  let actualMaxDepth = 0.001;
  for (let i = 0; i < depthMap.length; i++) {
    if (depthMap[i] > actualMaxDepth) {
      actualMaxDepth = depthMap[i];
    }
  }
  
  const scaleDepth = Math.max(actualMaxDepth, maxDepth);
  
  // ✅ رسم البيانات - استخدام الألوان الحالية
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const depth = depthMap[idx];
      
      if (depth > 0) {
        const normalizedDepth = depth / scaleDepth;
        const color = getCurrentColors(normalizedDepth);
        
        const di = (y * width + x) * 4;
        imgData.data[di] = color.r;
        imgData.data[di + 1] = color.g;
        imgData.data[di + 2] = color.b;
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  
  // ✅ إضافة نقاط البداية والنهاية
  if (points.length > 0) {
    const start = mmToPixel(points[0].x, points[0].y);
    const end = mmToPixel(points[points.length - 1].x, points[points.length - 1].y);
    
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 6 / scaleFactor, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 6 / scaleFactor, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // ✅ إضافة معلومات الحجم (اختياري)
  if (workSize && points.length > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${12 / scaleFactor}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(`${workSize.width.toFixed(0)}×${workSize.height.toFixed(0)}mm`, width - 10, 20);
  }
}

// ✅ وسيلة إيضاح عالية الجودة
function drawHighQualityLegend() {
  try {
    const legend = document.getElementById('topLegend');
    if (!legend) return;
    
    const steps = 8;
    const stops = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const color = getCurrentColors(t);
      stops.push(`rgb(${color.r},${color.g},${color.b}) ${Math.round((i/steps)*100)}%`);
    }
    
    const borderColor = getSchemePreviewColor(currentColorScheme);
    
    legend.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    legend.style.border = `2px solid ${borderColor}`;
    legend.style.height = '35px';
    legend.style.borderRadius = '8px';
    legend.style.marginTop = '10px';
    legend.style.boxShadow = `0 2px 10px ${borderColor}30`;
    
    legend.innerHTML = `
      <div style="display: flex; justify-content: space-between; padding: 8px; font-size: 12px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black;">
        <span>⬤ منخفض</span>
        <span>⬤ متوسط</span>
        <span>⬤ مرتفع</span>
      </div>
    `;
    
  } catch(e) {
    console.warn('فشل في رسم وسيلة الإيضاح:', e);
    // ✅ نسخة بديلة في حالة الخطأ
    drawSimpleLegend();
  }
}

// ================= Top View rendering - نسخة محسنة =================
function renderTopViewFromGcode(gcode) {
  try {
    // ✅ إنشاء واجهة اختيار الألوان إذا لم تكن موجودة
    if (!document.getElementById('colorSchemeSelector')) {
      createColorSchemeSelector();
    }
    
    const topCanvas = document.getElementById('topView');
    const legendDiv = document.getElementById('topLegend');
    if (!topCanvas || !legendDiv) {
      console.log('لم يتم العثور على العناصر المطلوبة');
      return;
    }
    
    // ✅ استخراج حجم العمل من G-code لتحديد نسبة العرض إلى الارتفاع
    const workSize = extractWorkSizeFromGcode(gcode);
    
    // ✅ تحديد الأبعاد بناءً على نسبة العرض إلى الارتفاع مع الحفاظ على الحجم التقريبي
    let displayWidth, displayHeight;
    const targetArea = 500 * 400; // المساحة المستهدفة
    const aspectRatio = workSize.width / workSize.height;
    
    displayHeight = Math.sqrt(targetArea / aspectRatio);
    displayWidth = displayHeight * aspectRatio;
    
    // ✅ الحد من الحجم الأقصى للحفاظ على الأداء
    displayWidth = Math.min(Math.max(displayWidth, 300), 800);
    displayHeight = Math.min(Math.max(displayHeight, 200), 600);
    
    // ✅ إعداد الكانفاس بدقة عالية
    const scaleFactor = window.devicePixelRatio || 2;
    const renderWidth = Math.round(displayWidth * scaleFactor);
    const renderHeight = Math.round(displayHeight * scaleFactor);
    
    topCanvas.width = renderWidth;
    topCanvas.height = renderHeight;
    topCanvas.style.width = displayWidth + 'px';
    topCanvas.style.height = displayHeight + 'px';
    
    const ctx = topCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, renderWidth, renderHeight);
    
    // ✅ تحسين جودة الرسم
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const maxDepth = parseFloat(document.getElementById('maxDepth').value) || 3.0;

    // ✅ تحليل G-code
    const points = parseGcodeForTopView(gcode);
    console.log('تم تحليل النقاط:', points.length, 'نقطة');

    if (points && points.length > 0) {
      renderHighQualityGcode(ctx, renderWidth, renderHeight, points, maxDepth, scaleFactor, workSize);
    } else {
      renderHighQualityDemo(ctx, renderWidth, renderHeight, scaleFactor);
    }
    
    drawHighQualityLegend();

  } catch (e) {
    console.error('خطأ في عرض العرض العلوي:', e);
    // ✅ عرض نسخة مبسطة في حالة الخطأ
    const topCanvas = document.getElementById('topView');
    if (topCanvas) {
      const ctx = topCanvas.getContext('2d');
      renderSimpleDemo(ctx, topCanvas.width, topCanvas.height);
      drawSimpleLegend();
    }
  }
}

// ✅ استدعاء إنشاء واجهة الألوان عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(createColorSchemeSelector, 100);
});

// ✅ جعل الدالة متاحة عالمياً
window.renderTopViewFromGcode = renderTopViewFromGcode;