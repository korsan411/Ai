// ================= توليد G-code للنماذج ثلاثية الأبعاد =================
function generate3DGcode() {
  if (!threeDModel) {
    throw new Error("لا يوجد نموذج ثلاثي الأبعاد محمل");
  }
  
  try {
    InputValidator.validate3DSettings();
    
    // الحصول على الإعدادات
    const layerHeight = parseFloat(document.getElementById('threedLayerHeight').value) || 0.2;
    const printSpeed = parseFloat(document.getElementById('threedPrintSpeed').value) || 50;
    const fillDensity = parseFloat(document.getElementById('threedFillDensity').value) || 20;
    const workWidth = cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30);
    const workHeight = cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20);
    const workDepth = parseFloat(document.getElementById('threedWorkDepth').value) || 10;
    const infillPattern = document.getElementById('threedInfillPattern').value || 'rectilinear';
    const supportEnabled = document.getElementById('threedSupport').checked;
    const raftEnabled = document.getElementById('threedRaft').checked;
    
    const originX = cmToMm(parseFloat(document.getElementById('threedOriginX').value) || 0);
    const originY = cmToMm(parseFloat(document.getElementById('threedOriginY').value) || 0);

    const lines = [];
    lines.push('; G-code للنموذج ثلاثي الأبعاد');
    lines.push('; تم التوليد بواسطة CNC AI');
    lines.push('G21 G90 G94 ; Set units to millimeters, absolute positioning, feedrate per minute');
    lines.push('M82 ; Set extruder to absolute mode');
    lines.push('M107 ; Fan off');
    lines.push('G28 ; Home all axes');
    lines.push('G1 Z15 F3000 ; Move Z up');
    
    // إعدادات البداية
    lines.push('M104 S200 ; Start heating extruder');
    lines.push('M140 S60 ; Start heating bed');
    lines.push('G92 E0 ; Reset extruder position');
    lines.push('G1 E-1 F300 ; Retract filament');
    
    // انتظار التسخين
    lines.push('M109 S200 ; Wait for extruder temperature');
    lines.push('M190 S60 ; Wait for bed temperature');
    
    // رافدة (Raft) إذا مفعل
    if (raftEnabled) {
      lines.push('; Start Raft');
      lines.push('G1 Z0.3 F3000');
      for (let i = 0; i < 3; i++) {
        const z = 0.3 + (i * layerHeight);
        lines.push(`G1 Z${z.toFixed(2)} F1200`);
        lines.push('G1 X10 Y10 F2400');
        lines.push(`G1 X${workWidth - 10} Y10`);
        lines.push(`G1 X${workWidth - 10} Y${workHeight - 10}`);
        lines.push(`G1 X10 Y${workHeight - 10}`);
        lines.push('G1 X10 Y10');
      }
      lines.push('; End Raft');
    }
    
    // حساب عدد الطبقات
    const layers = Math.floor(workDepth / layerHeight);
    
    // توليد G-code للطبقات
    for (let layer = 0; layer < layers; layer++) {
      const z = (raftEnabled ? 0.9 : 0) + (layer * layerHeight);
      lines.push(`; Layer ${layer + 1}, Z = ${z.toFixed(2)}`);
      lines.push(`G0 Z${z.toFixed(2)} F3000`);
      
      // طباعة الإطار الخارجي
      lines.push('; Outer perimeter');
      lines.push('G1 X10 Y10 F2400');
      lines.push(`G1 X${workWidth - 10} Y10`);
      lines.push(`G1 X${workWidth - 10} Y${workHeight - 10}`);
      lines.push(`G1 X10 Y${workHeight - 10}`);
      lines.push('G1 X10 Y10');
      
      // الحشو حسب النمط المختار
      lines.push(`; Infill pattern: ${infillPattern}`);
      const infillStep = Math.max(5, 20 * (100 - fillDensity) / 100);
      
      if (infillPattern === 'rectilinear') {
        // نمط مستقيم
        for (let y = 15; y < workHeight - 15; y += infillStep) {
          lines.push(`G0 X10 Y${y} F3000`);
          lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
        }
      } else if (infillPattern === 'grid') {
        // نمط شبكي
        for (let y = 15; y < workHeight - 15; y += infillStep) {
          lines.push(`G0 X10 Y${y} F3000`);
          lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
        }
        for (let x = 15; x < workWidth - 15; x += infillStep) {
          lines.push(`G0 X${x} Y15 F3000`);
          lines.push(`G1 X${x} Y${workHeight - 15} F${printSpeed * 60}`);
        }
      } else if (infillPattern === 'triangles') {
        // نمط مثلثات
        let flip = false;
        for (let y = 15; y < workHeight - 15; y += infillStep) {
          if (flip) {
            lines.push(`G0 X${workWidth - 10} Y${y} F3000`);
            lines.push(`G1 X10 Y${y} F${printSpeed * 60}`);
          } else {
            lines.push(`G0 X10 Y${y} F3000`);
            lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
          }
          flip = !flip;
        }
      } else if (infillPattern === 'honeycomb') {
        // نمط خلية النحل (مبسط)
        for (let y = 15; y < workHeight - 15; y += infillStep * 1.5) {
          lines.push(`G0 X10 Y${y} F3000`);
          lines.push(`G1 X${workWidth - 10} Y${y} F${printSpeed * 60}`);
          if (y + infillStep / 2 < workHeight - 15) {
            lines.push(`G0 X${workWidth - 10} Y${y + infillStep / 2} F3000`);
            lines.push(`G1 X10 Y${y + infillStep / 2} F${printSpeed * 60}`);
          }
        }
      }
      
      // دعم (Support) إذا مفعل
      if (supportEnabled && layer < layers * 0.7) {
        lines.push('; Support structure');
        const supportStep = infillStep * 2;
        for (let x = 20; x < workWidth - 20; x += supportStep) {
          for (let y = 20; y < workHeight - 20; y += supportStep) {
            if ((x + y) % (supportStep * 2) === 0) {
              lines.push(`G0 X${x} Y${y} F3000`);
              lines.push(`G1 Z${(z + layerHeight).toFixed(2)} F600`);
              lines.push(`G1 Z${z.toFixed(2)} F600`);
            }
          }
        }
      }
    }
    
    // نهاية البرنامج
    lines.push('; Finished printing');
    lines.push('G0 Z15 F3000 ; Move Z up');
    lines.push('M104 S0 ; Turn off extruder');
    lines.push('M140 S0 ; Turn off bed');
    lines.push('M107 ; Fan off');
    lines.push('M84 ; Disable steppers');
    lines.push('M30 ; End of program');
    
    // تقدير الوقت
    const estimatedTime = (layers * 2) / 60; // تقدير مبسط
    document.getElementById('estTime').innerHTML = "⏱️ تقدير وقت الطباعة: " + estimatedTime.toFixed(1) + " دقيقة | " + layers + " طبقة";
    
    return lines.join('\n');
  } catch (error) {
    console.error('خطأ في توليد G-code ثلاثي الأبعاد:', error);
    throw new Error('فشل في توليد G-code ثلاثي الأبعاد: ' + error.message);
  }
}