// ================= Colormap utilities - الإصدار المحسن =================
function clamp(v, a=0, b=1){ return Math.max(a, Math.min(b, v)); }

function getColormapColor(t, map) {
  try {
    t = clamp(t);
    if (map === 'hot') {
      if (t < 0.33) return { r: Math.round(t/0.33*128), g: 0, b: 0 };
      if (t < 0.66) return { r: Math.round(128 + (t-0.33)/0.33*127), g: Math.round((t-0.33)/0.33*128), b: 0 };
      return { r: 255, g: Math.round(128 + (t-0.66)/0.34*127), b: Math.round((t-0.66)/0.34*127) };
    } else if (map === 'cool') {
      return { r: Math.round(255 * t), g: Math.round(255 * (1 - t)), b: 255 };
    } else if (map === 'gray') {
      const v = Math.round(255 * t);
      return { r: v, g: v, b: v };
    } else {
      // jet-like approximation
      const r = Math.round(255 * clamp(1.5 - Math.abs(1.0 - 4.0*(t-0.5)), 0, 1));
      const g = Math.round(255 * clamp(1.5 - Math.abs(0.5 - 4.0*(t-0.25)), 0, 1));
      const b = Math.round(255 * clamp(1.5 - Math.abs(0.5 - 4.0*(t)), 0, 1));
      return { r, g, b };
    }
  } catch (error) {
    console.warn('خطأ في توليد لون الخريطة:', error);
    return { r: 128, g: 128, b: 128 };
  }
}

function hexToRgb(hex) {
  try {
    if (!hex) return { r:160, g:82, b:45 };
    const h = hex.replace('#','');
    const hh = (h.length===3) ? h.split('').map(c=>c+c).join('') : h;
    const bigint = parseInt(hh, 16);
    return { 
      r: (bigint >> 16) & 255, 
      g: (bigint >> 8) & 255, 
      b: bigint & 255 
    };
  } catch {
    return { r:160, g:82, b:45 };
  }
}

function mixColors(c1, c2, t) {
  try {
    t = clamp(t);
    return {
      r: Math.round(c1.r * (1 - t) + c2.r * t),
      g: Math.round(c1.g * (1 - t) + c2.g * t),
      b: Math.round(c1.b * (1 - t) + c2.b * t)
    };
  } catch {
    return c1;
  }
}