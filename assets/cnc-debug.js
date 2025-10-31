/* CncAi — cnc-debug.js | DebugOverlay و TaskManager */

/* ================= 2D Vector Preview (SVG / DXF) — Injected Module =================
   - Adds a new tab "2D Vector Preview" and a canvas #vectorCanvas (transparent BG)
   - Provides loadSVGModel(file) and loadDXFModel(file)
   - Hooks into left file-format-buttons and threedFileInput for SVG/DXF files
   - Minimal, non-invasive: does not modify existing functions or variables
   - NOTE: This injects Three.r170 which will replace any existing window.THREE global.
     This may affect other Three.js-based code that depended on an earlier version.
*/
(function(){
  try {
    if (window._vectorModuleAdded) return;
    window._vectorModuleAdded = true;

    // create tab button + content and insert into DOM
    const tabBar = document.querySelector('.tab-buttons');
    if (!tabBar) {
      console.warn('Tab bar not found; abort vector preview injection.');
      return;
    }

    // create button
    const btn = document.createElement('button');
    btn.setAttribute('data-tab','vector2d');
    btn.textContent = '📐 2D Vector Preview';
    tabBar.appendChild(btn);

    // create content container (insert into left panel after existing threed tab-content)
    const threedContent = document.getElementById('threed');
    const container = document.createElement('div');
    container.id = 'vector2d';
    container.className = 'tab-content';
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="canvas-placeholder" id="vectorPlaceholder">اسحب أو ارفع ملف SVG أو DXF هنا للمعاينة</div>
        <canvas id="vectorCanvas" style="display:none;width:100%;height:420px;background:transparent;"></canvas>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button id="vectorZoomIn" class="secondary">🔍+</button>
          <button id="vectorZoomOut" class="secondary">🔍−</button>
          <button id="vectorFit" class="secondary">🎯 ملء الشاشة</button>
        </div>
      </div>
    `;
    if (threedContent && threedContent.parentNode) {
      threedContent.parentNode.insertBefore(container, threedContent.nextSibling);
    } else {
      // fallback: append at end of left panel
      const leftPanel = document.querySelector('.panel');
      if (leftPanel) leftPanel.appendChild(container);
    }

    // tab switching behavior reuse existing logic: add click listener to all tab buttons to toggle.
    function setupTabBehavior() {
      try {
        const tabs = document.querySelectorAll('.tab-buttons button');
        tabs.forEach(t => {
          t.addEventListener('click', () => {
            const tab = t.getAttribute('data-tab');
            // remove active from buttons
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            // hide all tab-contents
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            const el = document.getElementById(tab);
            if (el) el.classList.add('active');
          });
        });
      } catch(e){ console.error('tab behavior setup failed', e); }
    }
    setupTabBehavior();

    // ---------------- Vector viewer implementation ----------------
    const vCanvas = document.getElementById('vectorCanvas');
    const vPlaceholder = document.getElementById('vectorPlaceholder');
    if (!vCanvas) {
      console.warn('vectorCanvas not found; aborting vector viewer');
      return;
    }
    const ctx = vCanvas.getContext('2d');
    let vWidth = vCanvas.clientWidth;
    let vHeight = vCanvas.clientHeight;
    // devicePixelRatio handling
    function resizeCanvas() {
      try {
        const rect = vCanvas.getBoundingClientRect();
        vWidth = rect.width;
        vHeight = rect.height;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        vCanvas.width = Math.round(vWidth * dpr);
        vCanvas.height = Math.round(vHeight * dpr);
        vCanvas.style.width = vWidth + 'px';
        vCanvas.style.height = vHeight + 'px';
        ctx.setTransform(dpr,0,0,dpr,0,0);
        renderCurrent(); // re-render if something loaded
      } catch(e){ console.warn('vector resize failed', e); }
    }
    window.addEventListener('resize', resizeCanvas);

    let currentVector = null; // {type:'svg'|'dxf', paths:..., bbox:...}
    let view = { scale:1, offsetX:0, offsetY:0 };

    function showVectorCanvas() {
      vPlaceholder.style.display = 'none';
      vCanvas.style.display = 'block';
      resizeCanvas();
    }

    function clearVector() {
      currentVector = null;
      view = { scale:1, offsetX:0, offsetY:0 };
      ctx.clearRect(0,0,vCanvas.width,vCanvas.height);
      vCanvas.style.display = 'none';
      vPlaceholder.style.display = 'flex';
    }

    function renderCurrent() {
      try {
        if (!currentVector) return;
        // clear (use transparent background)
        ctx.clearRect(0,0,vCanvas.width, vCanvas.height);
        // compute transform: center content
        const rect = vCanvas.getBoundingClientRect();
        const canvasW = rect.width, canvasH = rect.height;
        const bbox = currentVector.bbox;
        const vbW = bbox.maxX - bbox.minX, vbH = bbox.maxY - bbox.minY;
        if (vbW === 0 || vbH === 0) return;
        const scaleFit = Math.min(canvasW / vbW, canvasH / vbH) * 0.9;
        const scale = view.scale * scaleFit;
        const cx = (canvasW/2) - ((bbox.minX + bbox.maxX)/2) * scale + view.offsetX;
        const cy = (canvasH/2) + ((bbox.minY + bbox.maxY)/2) * scale + view.offsetY;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, -scale); // flip Y to match SVG coord system
        ctx.lineWidth = 1/scale;
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = 'rgba(0,0,0,0)';
        // draw paths
        currentVector.paths.forEach(p => {
          ctx.beginPath();
          p.forEach((pt, i) => {
            if (i===0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        });
        ctx.restore();
      } catch(e){ console.error('renderCurrent failed', e); }
    }

    // zoom controls
    document.getElementById('vectorZoomIn').addEventListener('click', () => { view.scale *= 1.25; renderCurrent(); });
    document.getElementById('vectorZoomOut').addEventListener('click', () => { view.scale /= 1.25; renderCurrent(); });
    document.getElementById('vectorFit').addEventListener('click', () => { view.scale = 1; view.offsetX=0; view.offsetY=0; renderCurrent(); });

    // pan & zoom with mouse
    (function attachPanZoom(){
      let isP=false, lastX=0, lastY=0;
      vCanvas.addEventListener('mousedown', (e)=>{ isP=true; lastX=e.clientX; lastY=e.clientY; vCanvas.style.cursor='grabbing'; });
      window.addEventListener('mouseup', ()=>{ isP=false; vCanvas.style.cursor='default'; });
      window.addEventListener('mousemove', (e)=>{ if(!isP) return; const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; view.offsetX += dx; view.offsetY += dy; renderCurrent(); });
      vCanvas.addEventListener('wheel', (e)=>{ e.preventDefault(); const delta = e.deltaY>0?0.9:1.1; view.scale *= delta; renderCurrent(); }, {passive:false});
    })();

    // ---------------- loaders: SVG & DXF ----------------
    function parseSVGText(text) {
      try {
        // use SVGLoader from r170 (global THREE.SVGLoader)
        const loader = new THREE.SVGLoader();
        const svgData = loader.parse(text);
        const paths = [];
        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        svgData.paths.forEach(path => {
          const shapes = path.toShapes(true);
          shapes.forEach(shape => {
            const pts = shape.getPoints(); // array of Vector2
            const arr = pts.map(p=>({x:p.x, y:p.y}));
            if (arr.length) {
              arr.forEach(pt=>{ if(pt.x<minX)minX=pt.x; if(pt.x>maxX)maxX=pt.x; if(pt.y<minY)minY=pt.y; if(pt.y>maxY)maxY=pt.y; });
              paths.push(arr);
            }
          });
        });
        if (paths.length===0) {
          // fallback: try path subpaths
          svgData.paths.forEach(path=>{
            const sub = path.subPaths || [];
            sub.forEach(sp=>{
              const pts = sp.getPoints();
              const arr = pts.map(p=>({x:p.x, y:p.y}));
              if(arr.length){ arr.forEach(pt=>{ if(pt.x<minX)minX=pt.x; if(pt.x>maxX)maxX=pt.x; if(pt.y<minY)minY=pt.y; if(pt.y>maxY)maxY=pt.y; }); paths.push(arr); }
            });
          });
        }
        if (minX===Infinity) { minX=0; minY=0; maxX=1; maxY=1; }
        return { paths, bbox:{minX,minY,maxX,maxY} };
      } catch(e){ console.error('parseSVGText failed', e); return null; }
    }

    function loadSVGModel(file) {
      return new Promise((resolve,reject)=>{
        try {
          if (!file) return reject(new Error('no file'));
          const reader = new FileReader();
          reader.onerror = (e)=>{ showToast('فشل قراءة ملف SVG',3000); reject(e); };
          reader.onload = (ev)=>{
            try {
              const text = ev.target.result;
              const parsed = parseSVGText(text);
              if (!parsed) { showToast('فشل تحليل SVG',4000); return reject(new Error('parse failed')); }
              currentVector = { type:'svg', paths: parsed.paths, bbox: parsed.bbox };
              showVectorCanvas();
              renderCurrent();
              showToast('تم تحميل SVG',1500);
              resolve(currentVector);
            } catch(err){ console.error(err); showToast('خطأ عند معالجة SVG',4000); reject(err); }
          };
          reader.readAsText(file);
        } catch(e){ console.error('loadSVGModel error', e); reject(e); }
      });
    }

    function parseDXFArrayBuffer(ab) {
      try {
        // Use THREE.DXFLoader (r170) which parses text/arrayBuffer - loader returns an Object3D
        // We'll parse into simple 2D paths by inspecting geometry lines
        const loader = new THREE.DXFLoader();
        const text = typeof ab === 'string' ? ab : new TextDecoder().decode(ab);
        const obj = loader.parse(text);
        const paths = [];
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        obj.traverse(child=>{
          if (child.isLine || child.isMesh || child.type==='Line' || child.geometry) {
            const geom = child.geometry;
            if (geom && geom.attributes && geom.attributes.position) {
              const pos = geom.attributes.position.array;
              for (let i=0;i<pos.length;i+=3) {
                const x = pos[i], y = pos[i+1];
                if (isFinite(x) && isFinite(y)) {
                  if (x<minX) minX=x; if (x>maxX) maxX=x;
                  if (y<minY) minY=y; if (y>maxY) maxY=y;
                }
              }
              // convert to lines (group consecutive pairs)
              const pts = [];
              for (let i=0;i<pos.length;i+=3) pts.push({x:pos[i], y:pos[i+1]});
              if (pts.length) paths.push(pts);
            }
          }
        });
        if (minX===Infinity) { minX=0;minY=0;maxX=1;maxY=1; }
        return { paths, bbox:{minX,minY,maxX,maxY} };
      } catch(e){ console.error('parseDXF failed', e); return null; }
    }

    function loadDXFModel(file) {
      return new Promise((resolve,reject)=>{
        try {
          if(!file) return reject(new Error('no file'));
          const reader = new FileReader();
          reader.onerror = (e)=>{ showToast('فشل قراءة DXF',3000); reject(e); };
          reader.onload = (ev)=>{
            try {
              const ab = ev.target.result;
              const parsed = parseDXFArrayBuffer(ab);
              if (!parsed) { showToast('فشل تحليل DXF',4000); return reject(new Error('parse failed')); }
              currentVector = { type:'dxf', paths: parsed.paths, bbox: parsed.bbox };
              showVectorCanvas();
              renderCurrent();
              showToast('تم تحميل DXF',1500);
              resolve(currentVector);
            } catch(err){ console.error('dxf parse error', err); showToast('خطأ عند معالجة DXF',4000); reject(err); }
          };
          reader.readAsArrayBuffer(file);
        } catch(e){ console.error('loadDXFModel error', e); reject(e); }
      });
    }

    // Hook the left buttons and threedFileInput for svg/dxf
    function hookVectorFileButtons() {
      try {
        const fileBtns = document.querySelectorAll('#fileFormatButtons button[data-format]');
        fileBtns.forEach(btn => {
          btn.addEventListener('click', (ev)=>{
            try {
              const format = btn.getAttribute('data-format');
              if (format !== 'svg' && format !== 'dxf') return; // only intercept svg/dxf buttons
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = (format === 'svg' ? '.svg' : '.dxf');
              input.onchange = async (e)=>{
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                try {
                  if (f.name.toLowerCase().endsWith('.svg')) await loadSVGModel(f);
                  else if (f.name.toLowerCase().endsWith('.dxf')) await loadDXFModel(f);
                } catch(err){ console.error('vector load failed', err); }
              };
              input.click();
            } catch(e){ console.error(e); }
          });
        });

        const threedInput = document.getElementById('threedFileInput');
        if (threedInput) {
          // we will not override existing handler for 3D inputs; only handle svg/dxf when selected
          threedInput.addEventListener('change', async (ev)=>{
            try {
              const f = ev.target.files && ev.target.files[0];
              if (!f) return;
              const name = f.name.toLowerCase();
              if (name.endsWith('.svg')) await loadSVGModel(f);
              else if (name.endsWith('.dxf')) await loadDXFModel(f);
            } catch(err){ console.error('threed svg/dxf handler failed', err); }
          });
        }

        // drag & drop on vector container
        container.querySelector && container.addEventListener && container.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; });
        container.addEventListener && container.addEventListener('drop', async (ev)=>{
          try {
            ev.preventDefault();
            const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (!f) return;
            const name = f.name.toLowerCase();
            if (name.endsWith('.svg')) await loadSVGModel(f);
            else if (name.endsWith('.dxf')) await loadDXFModel(f);
            else showToast('ادعم SVG أو DXF فقط هنا', 3000);
          } catch(err){ console.error('vector drop failed', err); }
        });
      } catch(e){ console.error('hookVectorFileButtons failed', e); }
    }
    hookVectorFileButtons();

    // expose functions for manual use
    window.loadSVGModel = window.loadSVGModel || loadSVGModel;
    window.loadDXFModel = window.loadDXFModel || loadDXFModel;

    console.log('2D Vector Preview module injected');
  } catch(err){
    console.error('Vector module injection error', err);
  }
})();

// Legacy debug close wiring 2.2d
(function(){
  function $id(i){return document.getElementById(i);}
  document.addEventListener('DOMContentLoaded', function(){
    var floatBtn = $id('cncaiDebugFloatingBtnLegacy');
    var debugList = $id('debugList');
    var closeBtn = $id('dbgCloseLegacy');
    try{
      if(!debugList){
        debugList = document.createElement('div');
        debugList.id='debugList';
        var rightPanel = document.querySelectorAll('.panel')[1] || document.body;
        rightPanel.appendChild(debugList);
      }
      debugList.style.display = debugList.style.display || 'none';
      if(floatBtn){
        floatBtn.addEventListener('click', function(){
          try{ debugList.style.display = 'block'; floatBtn.style.display = 'none'; if(closeBtn) closeBtn.style.display='inline-block'; }catch(e){};
        });
      }
      if(closeBtn){
        closeBtn.addEventListener('click', function(){ try{ debugList.style.display='none'; if(floatBtn) floatBtn.style.display='flex'; }catch(e){} });
      }
    }catch(e){ try{ console.warn('debug close wiring failed', e); }catch(e){} }
  });
})();
// Debug topbar handlers (toggle size / hide / reset position)
try {
  const dbgToggleSizeTop = document.getElementById('dbgToggleSizeTop');
  const dbgHideTop = document.getElementById('dbgHideTop');
  const dbgResetTop = document.getElementById('dbgResetTop');
  const debugList = document.getElementById('debugList');
  const debugOverlay = document.getElementById('debugOverlay');

  if (dbgToggleSizeTop && debugList) {
    dbgToggleSizeTop.addEventListener('click', () => {
      if (debugList.style.maxHeight === '120px') {
        debugList.style.maxHeight = '40vh';
        dbgToggleSizeTop.textContent = '🔽';
      } else {
        debugList.style.maxHeight = '120px';
        dbgToggleSizeTop.textContent = '🔼';
      }
    });
  }

  if (dbgHideTop && debugOverlay) {
    dbgHideTop.addEventListener('click', () => {
      debugOverlay.style.display = (debugOverlay.style.display === 'none') ? 'flex' : 'none';
    });
  }

  if (dbgResetTop && debugOverlay) {
    dbgResetTop.addEventListener('click', () => {
      debugOverlay.style.bottom = '12px';
      debugOverlay.style.left = '5vw';
      debugOverlay.style.width = (window.innerWidth < 600) ? '96vw' : '90vw';
      debugOverlay.style.maxWidth = '420px';
      debugOverlay.style.display = 'flex';
    });
  }
} catch(e){
  console.error('debug topbar init failed', e);
}
// ================= نظام الحفاظ على النسبة المتكامل =================
function initAdvancedAspectRatio() {
    let aspectRatio = 2/3; // نسبة افتراضية
    let isLocked = true;
    
    // عناصر التحكم
    const lockBtn = document.createElement('button');
    lockBtn.innerHTML = '🔒 النسبة مقفلة';
    lockBtn.className = 'secondary';
    lockBtn.style.cssText = 'margin:8px 0; width:100%; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white;';
    
    const ratioInfo = document.createElement('div');
    ratioInfo.style.cssText = 'text-align:center; color:#cfeaf2; font-size:0.9rem; margin-bottom:8px; padding:8px; background:rgba(14,23,33,0.6); border-radius:6px;';
    
    // إضافة للواجهة - نضعها في المكان الصحيح
    const workWidthInput = document.getElementById('workWidth');
    if (workWidthInput && workWidthInput.parentNode && workWidthInput.parentNode.parentNode) {
        const workSettings = workWidthInput.parentNode.parentNode;
        workSettings.appendChild(ratioInfo);
        workSettings.appendChild(lockBtn);
    }
    
    // تحديث المعلومات
    function updateRatioInfo() {
        if (previewCanvas) {
            aspectRatio = previewCanvas.height / previewCanvas.width;
            const ratioText = aspectRatio.toFixed(2);
            ratioInfo.innerHTML = `📐 نسبة الصورة: ${previewCanvas.width} × ${previewCanvas.height} (${ratioText})`;
        } else {
            ratioInfo.innerHTML = '📐 قم بتحميل صورة أولاً';
        }
    }
    
    // تحديث الأبعاد
    function updateDimensions() {
        if (!isLocked || !previewCanvas) return;
        
        const widthInput = document.getElementById('workWidth');
        const heightInput = document.getElementById('workHeight');
        
        if (widthInput && heightInput) {
            const width = parseFloat(widthInput.value) || 30;
            const newHeight = width * aspectRatio;
            heightInput.value = newHeight.toFixed(1);
            updateDimensionDisplay();
        }
    }
    
    // أحداث
    const widthInput = document.getElementById('workWidth');
    if (widthInput) {
        widthInput.addEventListener('input', updateDimensions);
    }
    
    lockBtn.addEventListener('click', () => {
        isLocked = !isLocked;
        lockBtn.innerHTML = isLocked ? '🔒 النسبة مقفلة' : '🔓 النسبة مفتوحة';
        lockBtn.style.background = isLocked 
            ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' 
            : 'linear-gradient(135deg, #ef4444, #dc2626)';
        showToast(isLocked ? 'تم قفل النسبة - سيتم الحفاظ على الأبعاد' : 'تم فتح النسبة - يمكنك تعديل الأبعاد بحرية');
        
        // إذا تم القفل، تطبيق النسبة فوراً
        if (isLocked && previewCanvas) {
            updateDimensions();
        }
    });
    
    // عند تحميل صورة جديدة
    const originalFileHandler = document.getElementById('fileInput').onchange;
    document.getElementById('fileInput').onchange = function(e) {
        // تشغيل المعالج الأصلي أولاً
        if (originalFileHandler) {
            originalFileHandler.call(this, e);
        }
        
        // ثم تحديث النسبة بعد تحميل الصورة
        setTimeout(() => {
            updateRatioInfo();
            if (isLocked) {
                updateDimensions();
            }
        }, 300); // زيادة الوقت لضمان تحميل الصورة
    };
    
    // التهيئة الأولية
    updateRatioInfo();
}

// بدء النظام بعد تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initAdvancedAspectRatio, 1000);
});

(function(){
  const overlay = document.getElementById('cnc-debug-overlay');
  const body = document.getElementById('cnc-debug-body');
  const btn = document.getElementById('cnc-debug-btn');
  const copyBtn = document.getElementById('cnc-debug-copy');
  const clearBtn = document.getElementById('cnc-debug-clear');
  const closeBtn = document.getElementById('cnc-debug-close');
  const countEl = document.getElementById('cnc-debug-count');
  const MAX = 300;
  let logs = [];

  function updateCount(){ if(countEl) countEl.textContent = logs.length + ' logs'; }
  function makeLine(type,msg){
    const el = document.createElement('div');
    el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + (type?type.toUpperCase():'INFO') + ' ' + msg;
    el.style.padding='3px 0';
    el.style.borderBottom='1px solid rgba(255,255,255,0.02)';
    return el;
  }
  function pushLog(type,msg){
    logs.unshift({t:Date.now(),type:type,msg:String(msg)});
    const el = makeLine(type,String(msg));
    if(body.firstChild) body.insertBefore(el, body.firstChild); else body.appendChild(el);
    if(logs.length>MAX){ logs.pop(); if(body.lastChild) body.removeChild(body.lastChild); }
    updateCount();
  }

  const orig = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
  console.log = function(...a){ try{ pushLog('info', a.map(x=>String(x)).join(' ')); }catch(e){}; return orig.log(...a); };
  console.warn = function(...a){ try{ pushLog('warn', a.map(x=>String(x)).join(' ')); }catch(e){}; return orig.warn(...a); };
  console.error = function(...a){ try{ pushLog('error', a.map(x=>String(x)).join(' ')); }catch(e){}; return orig.error(...a); };

  window.debugAdd = function(type,msg){ pushLog(type||'info', msg||''); };
  window.debugClearLogs = function(){ logs=[]; if(body) body.innerHTML=''; updateCount(); };
  window.debugGetLogs = function(){ return logs.slice(); };

  if(btn) btn.addEventListener('click', function(){ overlay.classList.toggle('collapsed'); overlay.setAttribute('aria-hidden', overlay.classList.contains('collapsed')? 'true':'false'); });
  if(copyBtn) copyBtn.addEventListener('click', function(){ try{ navigator.clipboard.writeText(logs.map(l=> new Date(l.t).toISOString()+' '+l.type+' '+l.msg).join('\n')); }catch(e){} });
  if(clearBtn) clearBtn.addEventListener('click', function(){ window.debugClearLogs(); });
  if(closeBtn) closeBtn.addEventListener('click', function(){ overlay.classList.add('collapsed'); });

  window.cncDebug = { add: window.debugAdd, clear: window.debugClearLogs, get: window.debugGetLogs };

  if(overlay) overlay.classList.add('collapsed');
})();

/* CNC_AI_TASK_MANAGER_2_5_0 */
window.CncTaskManager = (function(){
  const q = [];
  let running = false;
  function runNext(){
    if(running) return;
    const task = q.shift();
    if(!task) return;
    running = true;
    try{
      const res = task.fn();
      if(res && typeof res.then === 'function'){
        res.then(()=>{ running=false; runNext(); }).catch(()=>{ running=false; runNext(); });
      } else {
        running=false; setTimeout(runNext, 0);
      }
    }catch(e){ running=false; setTimeout(runNext,0); }
  }
  return {
    queue(name, fn){
      q.push({name:name, fn:fn});
      setTimeout(runNext,0);
    }
  };
})();
