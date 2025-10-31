/* CncAi — cnc-gcode.js | توليد وتحليل G-code */

(function(){
  try{
    const container = document.querySelector('.tab-buttons');
    if(!container) return;
    function buildMore(){ // move extra tabs into More
      const buttons = Array.from(container.querySelectorAll('button.tab-btn, a.tab-btn'));
      const maxVisible = 6;
      // remove existing more if any
      const existing = container.querySelector('.more-dropdown');
      if(existing) existing.remove();
      if(buttons.length <= maxVisible) return;
      const moreDiv = document.createElement('div');
      moreDiv.className = 'more-dropdown';
      const moreBtn = document.createElement('button');
      moreBtn.textContent = 'المزيد ▾';
      moreBtn.className = 'tab-btn';
      moreBtn.type = 'button';
      const list = document.createElement('div');
      list.className = 'more-list';
      // move extras
      buttons.slice(maxVisible).forEach(function(b){
        const copy = b.cloneNode(true);
        copy.addEventListener('click', function(ev){ b.click(); list.style.display='none'; });
        list.appendChild(copy);
        b.style.display = 'none';
      });
      moreDiv.appendChild(moreBtn);
      moreDiv.appendChild(list);
      container.appendChild(moreDiv);
      moreBtn.addEventListener('click', function(){ list.style.display = list.style.display==='block' ? 'none' : 'block'; });
      document.addEventListener('click', function(e){ if(!moreDiv.contains(e.target)) list.style.display='none'; });
    }
    window.addEventListener('load', buildMore);
    window.addEventListener('resize', function(){ setTimeout(buildMore,120); });
  }catch(e){}
})();

(function(){
  // elements
  const toggle = document.getElementById('adv-machine-toggle');
  const body = document.getElementById('adv-machine-body');
  const arrow = document.getElementById('adv-arrow');
  const inputs = {
    origin_x: document.getElementById('adv_origin_x'),
    origin_y: document.getElementById('adv_origin_y'),
    origin_z: document.getElementById('adv_origin_z'),
    cal_x: document.getElementById('adv_cal_x'),
    cal_y: document.getElementById('adv_cal_y'),
    cal_x_val: document.getElementById('adv_cal_x_val'),
    cal_y_val: document.getElementById('adv_cal_y_val'),
    rev_x: document.getElementById('adv_rev_x'),
    rev_y: document.getElementById('adv_rev_y'),
    exec: document.getElementById('adv_exec'),
    delay: document.getElementById('adv_delay'),
    reset: document.getElementById('adv_reset'),
    save: document.getElementById('adv_save')
  };

  const STORAGE_KEY = 'cnc_machine_advanced_v2';

  function loadSettings(){
    try{
      const stored = localStorage.getItem(STORAGE_KEY);
      if(stored){
        const s = JSON.parse(stored);
        inputs.origin_x.value = s.origin_x ?? 0;
        inputs.origin_y.value = s.origin_y ?? 0;
        inputs.origin_z.value = s.origin_z ?? 0;
        inputs.cal_x.value = s.cal_x ?? 0;
        inputs.cal_y.value = s.cal_y ?? 0;
        inputs.cal_x_val.textContent = (inputs.cal_x.value||0);
        inputs.cal_y_val.textContent = (inputs.cal_y.value||0);
        inputs.rev_x.checked = !!s.rev_x;
        inputs.rev_y.checked = !!s.rev_y;
        inputs.exec.value = s.exec || 'raster';
        inputs.delay.value = s.delay || 0;
      } else {
        // defaults
        inputs.cal_x_val.textContent = inputs.cal_x.value;
        inputs.cal_y_val.textContent = inputs.cal_y.value;
      }
    }catch(e){}
  }
  function saveSettings(){
    const obj = {
      origin_x: parseFloat(inputs.origin_x.value)||0,
      origin_y: parseFloat(inputs.origin_y.value)||0,
      origin_z: parseFloat(inputs.origin_z.value)||0,
      cal_x: parseFloat(inputs.cal_x.value)||0,
      cal_y: parseFloat(inputs.cal_y.value)||0,
      rev_x: !!inputs.rev_x.checked,
      rev_y: !!inputs.rev_y.checked,
      exec: inputs.exec.value,
      delay: parseInt(inputs.delay.value)||0
    };
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch(e){}
    return obj;
  }
  function resetSettings(){
    inputs.origin_x.value = 0;
    inputs.origin_y.value = 0;
    inputs.origin_z.value = 0;
    inputs.cal_x.value = 0;
    inputs.cal_y.value = 0;
    inputs.cal_x_val.textContent = 0;
    inputs.cal_y_val.textContent = 0;
    inputs.rev_x.checked = false;
    inputs.rev_y.checked = false;
    inputs.exec.value = 'raster';
    inputs.delay.value = 0;
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  // toggle behavior
  if(toggle){
    toggle.addEventListener('click', function(){
      const open = body.style.display !== 'flex' && body.style.display !== 'block';
      body.style.display = open ? 'flex' : 'none';
      body.setAttribute('aria-hidden', !open);
      arrow.textContent = open ? '▲' : '▼';
    });
  }

  // live update values
  if(inputs.cal_x){
    inputs.cal_x.addEventListener('input', ()=>{ inputs.cal_x_val.textContent = inputs.cal_x.value; saveSettings(); });
  }
  if(inputs.cal_y){
    inputs.cal_y.addEventListener('input', ()=>{ inputs.cal_y_val.textContent = inputs.cal_y.value; saveSettings(); });
  }
  // save on changes
  ['origin_x','origin_y','origin_z','rev_x','rev_y','exec','delay'].forEach(function(k){
    const el = inputs[k];
    if(!el) return;
    el.addEventListener('change', saveSettings);
  });
  if(inputs.save) inputs.save.addEventListener('click', saveSettings);
  if(inputs.reset) inputs.reset.addEventListener('click', function(){ resetSettings(); });

  // expose getAdvancedSettings
  window.getAdvancedMachineSettings = function(){
    try{
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return {
        origin_x: parseFloat(s.origin_x)||0,
        origin_y: parseFloat(s.origin_y)||0,
        origin_z: parseFloat(s.origin_z)||0,
        cal_x: parseFloat(s.cal_x)||0,
        cal_y: parseFloat(s.cal_y)||0,
        rev_x: !!s.rev_x,
        rev_y: !!s.rev_y,
        exec: s.exec || 'raster',
        delay: parseInt(s.delay)||0
      };
    }catch(e){
      return { origin_x:0,origin_y:0,origin_z:0,cal_x:0,cal_y:0,rev_x:false,rev_y:false,exec:'raster',delay:0 };
    }
  };

  // applyAdvancedMachineSettings: transforms G-code string (safely)
  window.applyAdvancedMachineSettings = function(gcode, settings){
    if(!gcode || typeof gcode !== 'string') return gcode;
    settings = settings || window.getAdvancedMachineSettings();
    // regex helpers
    function replCoord(line, axis, offset, reverse){
      const rx = new RegExp(axis + '(-?\\d+(?:\\.\\d+)?)', 'i');
      if(!rx.test(line)) return line;
      return line.replace(rx, function(full, val){
        let num = parseFloat(val);
        if(reverse) num = -num;
        if(offset) num = num + offset;
        return axis + num.toFixed(4);
      });
    }
    const out = gcode.split('\\n').map(function(line){
      const t = line.trim();
      if(t.startsWith('G0') || t.startsWith('G1') || t.startsWith('g0') || t.startsWith('g1')){
        let l = line;
        l = replCoord(l, 'X', settings.origin_x || 0, settings.rev_x);
        l = replCoord(l, 'Y', settings.origin_y || 0, settings.rev_y);
        l = replCoord(l, 'Z', settings.origin_z || 0, false);
        // calibration scaling (simple multiply)
        if(settings.cal_x && settings.cal_x !== 0){
          l = l.replace(/X(-?\\d+(?:\\.\\d+)?)/i, function(full,val){ return 'X' + (parseFloat(val) * (1 + settings.cal_x)).toFixed(4); });
        }
        if(settings.cal_y && settings.cal_y !== 0){
          l = l.replace(/Y(-?\\d+(?:\\.\\d+)?)/i, function(full,val){ return 'Y' + (parseFloat(val) * (1 + settings.cal_y)).toFixed(4); });
        }
        return l;
      }
      return line;
    }).join('\\n');
    return out;
  };

  // patch generateGCode if exists: wrap sync or promise-returning functions
  try{
    if(typeof window.generateGCode === 'function'){
      const orig = window.generateGCode;
      window.generateGCode = function(){
        const res = orig.apply(this, arguments);
        if(res && typeof res.then === 'function'){
          return res.then(function(g){ try{ return window.applyAdvancedMachineSettings(g); }catch(e){ return g; } });
        } else {
          try{ return window.applyAdvancedMachineSettings(res); }catch(e){ return res; }
        }
      };
    }
  }catch(e){}
  // initial load
  loadSettings();
})();

/* CNC_AI_GCODE_LIB_2_5_0 */
// Lightweight G-code parser for G0/G1 lines (supports X/Y/Z/F and comments)
window.parseGCode = function(gcodeText){
  const lines = gcodeText.split(/\r?\n/);
  const out = [];
  for(const raw of lines){
    const line = raw.trim();
    if(line === ''){ out.push({raw:raw}); continue; }
    const parts = line.split(';')[0].trim(); // remove inline comment after ;
    const obj = { raw: raw };
    const m = parts.match(/^(G\d+)\s*(.*)/i);
    if(m){
      obj.cmd = m[1].toUpperCase();
      const args = m[2];
      const re = /([XYZFI])(-?\d+(?:\.\d+)?)/ig;
      let arg;
      while((arg = re.exec(args)) !== null){
        obj[arg[1].toUpperCase()] = parseFloat(arg[2]);
      }
    }
    out.push(obj);
  }
  return out;
};

window.stringifyGCode = function(parsed){
  return parsed.map(function(obj){
    if(obj.raw && !obj.cmd) return obj.raw;
    if(obj.cmd){
      var s = obj.cmd;
      var keys = ['X','Y','Z','F','I'];
      keys.forEach(function(k){ if(obj[k]!==undefined) s += ' ' + k + Number(obj[k]).toFixed(4); });
      return s;
    }
    return obj.raw || '';
  }).join('\n');
};

// applyAdvancedMachineSettings uses model-based transform
window.applyAdvancedMachineSettings = window.applyAdvancedMachineSettings || function(gcodeText, settings){
  if(!gcodeText || typeof gcodeText !== 'string') return gcodeText;
  settings = settings || (window.getAdvancedMachineSettings? window.getAdvancedMachineSettings() : {});
  try{
    const parsed = window.parseGCode(gcodeText);
    const out = parsed.map(function(obj){
      if(!obj.cmd) return obj;
      const cmd = obj.cmd.toUpperCase();
      if(cmd === 'G0' || cmd === 'G1'){ // transform coordinates
        const nx = (obj.X!==undefined)?obj.X:undefined;
        const ny = (obj.Y!==undefined)?obj.Y:undefined;
        const nz = (obj.Z!==undefined)?obj.Z:undefined;
        let X = nx, Y = ny, Z = nz;
        if(X!==undefined){ if(settings.rev_x) X = -X; if(settings.origin_x) X = X + (parseFloat(settings.origin_x)||0); if(settings.cal_x) X = X * (1 + parseFloat(settings.cal_x)||0); obj.X = Number(X); }
        if(Y!==undefined){ if(settings.rev_y) Y = -Y; if(settings.origin_y) Y = Y + (parseFloat(settings.origin_y)||0); if(settings.cal_y) Y = Y * (1 + parseFloat(settings.cal_y)||0); obj.Y = Number(Y); }
        if(Z!==undefined){ obj.Z = Number(Z + (parseFloat(settings.origin_z)||0)); }
      }
      return obj;
    });
    return window.stringifyGCode(out);
  }catch(e){ return gcodeText; }
};

// wrapper for generateGCode if exists
(function(){
  try{
    if(typeof window.generateGCode === 'function'){
      const orig = window.generateGCode;
      window.generateGCode = function(){
        const res = orig.apply(this, arguments);
        if(res && typeof res.then === 'function'){
          return res.then(function(g){ try{ return window.applyAdvancedMachineSettings(g); }catch(e){ return g; } });
        } else {
          try{ return window.applyAdvancedMachineSettings(res); }catch(e){ return res; }
        }
      };
    }
  }catch(e){ console.warn('gcode wrapper error', e); }
})();
