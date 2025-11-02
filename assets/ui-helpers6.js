// ================= Helper UI funcs =================
function showToast(msg, ms = 3000) {
  try {
    const t = document.getElementById('toast');
    if (!t) return;
    
    t.textContent = String(msg).substring(0, 200);
    t.style.display = 'block';
    clearTimeout(t._t);
    t._t = setTimeout(() => {
      if (t) t.style.display = 'none';
    }, ms);
    
    console.log('Toast: ' + msg);
  } catch (e) {
    console.error('فشل في عرض الإشعار:', e);
  }
}

function cmToMm(cm) { 
  const result = parseFloat(cm) * 10;
  return isNaN(result) ? 0 : result;
}

function mmToCm(mm) { 
  const result = parseFloat(mm) / 10;
  return isNaN(result) ? 0 : result;
}

function updateDimensionDisplay() {
  try {
    const widthCm = parseFloat(document.getElementById('workWidth').value) || 0;
    const heightCm = parseFloat(document.getElementById('workHeight').value) || 0;
    
    const widthMmElem = document.getElementById('widthMm');
    const heightMmElem = document.getElementById('heightMm');
    
    if (widthMmElem) widthMmElem.textContent = cmToMm(widthCm).toFixed(1) + ' مم';
    if (heightMmElem) heightMmElem.textContent = cmToMm(heightCm).toFixed(1) + ' مم';
    
    // Update laser dimensions too
    const laserWidthCm = parseFloat(document.getElementById('laserWorkWidth').value) || 0;
    const laserHeightCm = parseFloat(document.getElementById('laserWorkHeight').value) || 0;
    
    const laserWidthMmElem = document.getElementById('laserWidthMm');
    const laserHeightMmElem = document.getElementById('laserHeightMm');
    
    if (laserWidthMmElem) laserWidthMmElem.textContent = cmToMm(laserWidthCm).toFixed(1) + ' مم';
    if (laserHeightMmElem) laserHeightMmElem.textContent = cmToMm(laserHeightCm).toFixed(1) + ' مم';
    
    // Update 3D dimensions
    const threedWidthCm = parseFloat(document.getElementById('threedWorkWidth').value) || 0;
    const threedHeightCm = parseFloat(document.getElementById('threedWorkHeight').value) || 0;
    const threedDepth = parseFloat(document.getElementById('threedWorkDepth').value) || 0;
    
    const threedWidthMmElem = document.getElementById('threedWidthMm');
    const threedHeightMmElem = document.getElementById('threedHeightMm');
    const threedDepthMmElem = document.getElementById('threedDepthMm');
    
    if (threedWidthMmElem) threedWidthMmElem.textContent = cmToMm(threedWidthCm).toFixed(1) + ' مم';
    if (threedHeightMmElem) threedHeightMmElem.textContent = cmToMm(threedHeightCm).toFixed(1) + ' مم';
    if (threedDepthMmElem) threedDepthMmElem.textContent = threedDepth.toFixed(1) + ' مم';
  } catch (error) {
    console.error('فشل في تحديث عرض الأبعاد:', error);
  }
}

function showElement(elementId, hidePlaceholderId) {
  try {
    const element = document.getElementById(elementId);
    const placeholder = document.getElementById(hidePlaceholderId);
    
    if (element) {
      element.style.display = 'block';
    }
    if (placeholder) {
      placeholder.style.display = 'none';
    }
  } catch (error) {
    console.error('فشل في إظهار العنصر:', error);
  }
}

function hideElement(elementId) {
  try {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'none';
    }
  } catch (error) {
    console.error('فشل في إخفاء العنصر:', error);
  }
}