/* CncAi — gcode-generator.js
   توليد كود G-code لأنماط Router / Laser (Raster وContour)
*/

(function() {
  window.CncAi = window.CncAi || {};
  const dbg = window.CncAi.debug;

  function generateRasterGcode(mat, step = 2) {
    if (!mat) {
      dbg.error("❌ لا توجد بيانات Raster");
      return "";
    }

    const rows = mat.rows;
    const cols = mat.cols;
    let gcode = [];
    gcode.push("; --- CncAi Raster Gcode ---");
    gcode.push("G21 ; mm mode");
    gcode.push("G90 ; absolute positioning");
    gcode.push("G1 F1000");

    for (let y = 0; y < rows; y += step) {
      const dir = y % (step * 2) === 0 ? 1 : -1;
      const xStart = dir === 1 ? 0 : cols - 1;
      const xEnd = dir === 1 ? cols : -1;
      for (let x = xStart; x !== xEnd; x += dir * step) {
        const val = mat.ucharPtr(y, x)[0];
        const z = (255 - val) / 255 * 2; // عمق بسيط حسب السطوع
        gcode.push(`G1 X${x} Y${y} Z${z.toFixed(2)}`);
      }
    }

    dbg.info("🪚 تم توليد G-code Raster");
    return gcode.join("\n");
  }

  function generateContourGcode(contours) {
    if (!contours || !contours.size) {
      dbg.error("❌ لا توجد حدود لاستخراجها");
      return "";
    }

    let gcode = [];
    gcode.push("; --- CncAi Contour Gcode ---");
    gcode.push("G21");
    gcode.push("G90");
    gcode.push("G1 F800");

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      if (c.data32S) {
        gcode.push("; contour " + i);
        for (let j = 0; j < c.data32S.length; j += 2) {
          const x = c.data32S[j];
          const y = c.data32S[j + 1];
          gcode.push(`G1 X${x} Y${y} Z0`);
        }
      }
    }

    dbg.info("✏️ تم توليد G-code Contour");
    return gcode.join("\n");
  }

  // ✅ واجهة عامة
  window.CncAi.gcodeGen = {
    generateRasterGcode,
    generateContourGcode
  };
})();
