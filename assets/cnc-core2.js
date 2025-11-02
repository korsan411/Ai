/* CncAi — cnc-core.js | تحليل الصور و OpenCV (مقتطفات) */

// Safe delete helper for OpenCV Mats
function safeDelete(mat){
  try{
    if(!mat) return;
    if(typeof mat.delete === 'function') mat.delete();
  }catch(e){ try{ console.warn('safeDelete error', e && e.message? e.message : e); }catch(e){} }
}
// patch cv.Mat.prototype.delete if possible
(function(){
  try{
    if(typeof cv !== 'undefined' && cv && cv.Mat && cv.Mat.prototype && !cv.Mat.prototype.__safePatched){
      const p = cv.Mat.prototype;
      const orig = p.delete;
      p.delete = function(){ try{ return orig.call(this); }catch(e){ try{ console.warn('Mat.delete wrapped error', e && e.message? e.message: e); }catch(e){} } };
      p.__safePatched = true;
    }
  }catch(e){}
  window.addEventListener('load', function(){ setTimeout(function(){ try{ if(typeof cv !== 'undefined' && cv && cv.Mat && cv.Mat.prototype && !cv.Mat.prototype.__safePatched){ const p = cv.Mat.prototype; const orig = p.delete; p.delete = function(){ try{ return orig.call(this); }catch(e){} }; p.__safePatched = true; } }catch(e){} },1500); });
})();

(function(){
  function ensureTabBar(){
    var tb = document.querySelector('.tab-bar') || document.getElementById('tabBar');
    if(!tb){
      var hdr = document.querySelector('header');
      tb = document.createElement('div');
      tb.className = 'tab-bar';
      if(hdr && hdr.parentNode) hdr.parentNode.insertBefore(tb, hdr.nextSibling);
      else document.body.insertBefore(tb, document.body.firstChild);
    }
    return tb;
  }
  function injectOpencvIfNeeded(){
    if(document.querySelector('script[src*="opencv"]')) return;
    var s = document.createElement('script'); s.src='https://docs.opencv.org/4.8.0/opencv.js'; s.async=true;
    s.onload = function(){ console.info('[AI] OpenCV injected'); };
    s.onerror = function(){ console.warn('[AI] OpenCV failed to load'); };
    document.head.appendChild(s);
  }

  function createAiTab(){
    var tb = ensureTabBar();
    if(tb.querySelector('[data-tab="ai-analysis"]')) return;
    var btn = document.createElement('button');
    btn.className='tab-button';
    btn.dataset.tab='ai-analysis';
    btn.textContent='🧠 تحليل الصورة';
    tb.appendChild(btn);

    var main = document.getElementById('mainContent') || document.querySelector('main') || document.body;
    if(!document.getElementById('ai-analysis')){
      var div = document.createElement('div');
      div.id='ai-analysis'; div.className='tab-content';
      div.innerHTML = `
        <h2>🧠 تحليل الصورة المتقدم</h2>
        <p>تحليل شامل للسطوع، التباين، الحدة، الملمس، كثافة الحواف وتوصيات الماكينة.</p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button id="runAiAnalysis" class="action-btn">بدء التحليل</button>
          <button id="aiApplyToMachine" class="action-btn" style="display:none">تطبيق التوصيات</button>
          <button id="aiCopyResult" class="action-btn" style="display:none">نسخ النتائج</button>
          <span id="aiStatus" style="margin-inline-start:8px;color:#9fb6c3"></span>
        </div>
        <div id="aiTableWrap" style="margin-top:12px;">
          <table id="aiResultTable" style="width:100%;border-collapse:collapse;text-align:right">
            <thead><tr style="text-align:right"><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.04)">المؤشر</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.04)">القيمة</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.04)">ملاحظة</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <img id="aiPreviewImage" class="preview-img" style="display:none;margin-top:12px" alt="صورة مصغرة"/>
      `;
      main.appendChild(div);
    }

    btn.addEventListener('click', function(){
      try{ if(typeof switchTab==='function'){ switchTab('ai-analysis'); return; } }catch(e){}
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active'));
      var t=document.getElementById('ai-analysis'); if(t) t.classList.add('active');
      btn.classList.add('active');
    });
  }

  function toNum(v, fallback=0){ var n = Number(v); return isNaN(n)?fallback:n; }

  function applyToMachine(rec){
    try{
      if(!rec) return;
      var feed = document.getElementById('adv_feedRate') || document.getElementById('feedRate') || document.querySelector('input[name="feed"]');
      var depth = document.getElementById('adv_zOffset') || document.getElementById('zOffset') || document.getElementById('depth');
      var sens = document.getElementById('edgeSensitivity') || document.getElementById('edge-sens') || document.getElementById('edge-sensitivity');
      if(feed && rec.speed!==undefined){ feed.value = rec.speed; feed.dispatchEvent(new Event('change')); }
      if(depth && rec.depth!==undefined){ depth.value = rec.depth; depth.dispatchEvent(new Event('change')); }
      if(sens && rec.sens!==undefined){ sens.value = rec.sens; sens.dispatchEvent(new Event('change')); }
      if(typeof window.saveSettings==='function') try{ window.saveSettings(); }catch(e){}
    }catch(e){ console.warn('[AI] applyToMachine failed', e); }
  }

  async function analyzeAdvanced(canvas){
    if(!canvas) return null;
    var waited=0; while((typeof cv==='undefined' || !cv.Mat) && waited<8000){ await new Promise(r=>setTimeout(r,200)); waited+=200; }
    if(typeof cv==='undefined' || !cv.Mat) throw new Error('OpenCV not ready');

    var w=canvas.width, h=canvas.height, maxDim=1024; var scale=1;
    if(Math.max(w,h)>maxDim) scale = maxDim/Math.max(w,h);
    var tmp=document.createElement('canvas'); tmp.width=Math.max(1,Math.round(w*scale)); tmp.height=Math.max(1,Math.round(h*scale));
    tmp.getContext('2d').drawImage(canvas,0,0,tmp.width,tmp.height);

    var mat=null, gray=null, mean=null, stddev=null, lap=null, absLap=null, edges=null;
    try{
      mat = cv.imread(tmp);
      if(!mat || mat.rows===0 || mat.cols===0) throw new Error('empty-mat');
      gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

      mean = new cv.Mat(); stddev = new cv.Mat();
      cv.meanStdDev(gray, mean, stddev);
      var brightness = (mean && mean.data64F && mean.data64F.length)?Math.round(mean.data64F[0]):((mean&&mean.data&&mean.data.length)?Math.round(mean.data[0]):0);
      var contrast = (stddev && stddev.data64F && stddev.data64F.length)?Math.round(stddev.data64F[0]):((stddev&&stddev.data&&stddev.data.length)?Math.round(stddev.data[0]):0);

      try{
        lap = new cv.Mat();
        cv.Laplacian(gray, lap, cv.CV_64F);
        var mv = new cv.Mat(), sv = new cv.Mat();
        cv.meanStdDev(lap, mv, sv);
        var sharpness = (sv && sv.data64F && sv.data64F.length)?Math.round(sv.data64F[0]):0;
        try{ mv.delete(); sv.delete(); }catch(e){}
      }catch(e){ var sharpness = 0; }

      try{
        var blur = new cv.Mat();
        cv.GaussianBlur(gray, blur, new cv.Size(7,7), 0);
        var diff = new cv.Mat();
        cv.absdiff(gray, blur, diff);
        var td = cv.mean(diff);
        var texture = (td && td.length)?Math.round(td[0]):0;
        try{ blur.delete(); diff.delete(); }catch(e){}
      }catch(e){ var texture = 0; }

      try{
        edges = new cv.Mat();
        cv.Canny(gray, edges, 80, 160);
        var edgeCount = cv.countNonZero(edges);
        var edgeDensity = Math.round((edgeCount / (edges.rows * edges.cols)) * 100);
      }catch(e){ var edgeDensity = 0; }

      var material = 'بلاستيك/خشب صلب';
      if(contrast < 40 && texture < 30) material = 'خشب لين';
      else if(contrast > 70 && sharpness > 80) material = 'معدن';

      var rec = { speed:1200, depth:0.8, sens:0.5 };
      if(material==='خشب لين') rec = { speed:2000, depth:1.5, sens:0.7 };
      if(material==='معدن') rec = { speed:700, depth:0.4, sens:0.2 };

      try{ mat.delete(); }catch(e){} try{ gray.delete(); }catch(e){}
      try{ mean.delete(); }catch(e){} try{ stddev.delete(); }catch(e){}
      try{ lap.delete(); }catch(e){} try{ edges.delete(); }catch(e){}
      return { brightness, contrast, sharpness, texture, edgeDensity, material, rec, timestamp:Date.now() };
    }catch(err){
      try{ if(mat) mat.delete(); }catch(e){} try{ if(gray) gray.delete(); }catch(e){}
      try{ if(mean) mean.delete(); }catch(e){} try{ if(stddev) stddev.delete(); }catch(e){}
      try{ if(lap) lap.delete(); }catch(e){} try{ if(edges) edges.delete(); }catch(e){}
      throw err;
    }
  }

  function renderResults(res){
    var tbody = document.querySelector('#aiResultTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    function addRow(k,v,note){
      var tr = document.createElement('tr');
      tr.innerHTML = '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">'+k+'</td>'
                   + '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">'+v+'</td>'
                   + '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">'+(note||'')+'</td>';
      tbody.appendChild(tr);
    }
    addRow('السطوع (Brightness)', res.brightness, 'قيمة متوسطة للسطوع');
    addRow('التباين (Contrast)', res.contrast, 'انحراف القياسات');
    addRow('الحدة (Sharpness)', res.sharpness, 'Laplacian variance');
    addRow('الملمس (Texture)', res.texture, 'اختلاف محلي عن الضبابية');
    addRow('كثافة الحواف (Edge Density)', (res.edgeDensity||0)+'%', 'نسبة البكسلات الحادة');
    addRow('المادة (Estimated)', res.material, '');
    addRow('التوصية (Speed/Depth/Sens)', (res.rec? (res.rec.speed + ' / ' + res.rec.depth + ' / ' + res.rec.sens) : '-'), '');
    try{ localStorage.setItem('cnc_ai_analysis', JSON.stringify(res)); }catch(e){}
  }

  function applyToMachine(rec){
    try{
      if(!rec) return;
      var feed = document.getElementById('adv_feedRate') || document.getElementById('feedRate') || document.querySelector('input[name="feed"]');
      var depth = document.getElementById('adv_zOffset') || document.getElementById('zOffset') || document.getElementById('depth');
      var sens = document.getElementById('edgeSensitivity') || document.getElementById('edge-sens') || document.getElementById('edge-sensitivity');
      if(feed && rec.speed!==undefined){ feed.value = rec.speed; feed.dispatchEvent(new Event('change')); }
      if(depth && rec.depth!==undefined){ depth.value = rec.depth; depth.dispatchEvent(new Event('change')); }
      if(sens && rec.sens!==undefined){ sens.value = rec.sens; sens.dispatchEvent(new Event('change')); }
      if(typeof window.saveSettings==='function') try{ window.saveSettings(); }catch(e){}
    }catch(e){ console.warn('[AI] applyToMachine failed', e); }
  }

  function setup(){
    injectOpencvIfNeeded();
    createAiTab();
    var runBtn = document.getElementById('runAiAnalysis');
    var applyBtn = document.getElementById('aiApplyToMachine');
    var copyBtn = document.getElementById('aiCopyResult');
    var status = document.getElementById('aiStatus');
    var previewImg = document.getElementById('aiPreviewImage');
    if(!runBtn) return;
    runBtn.addEventListener('click', async function(){
      status.textContent = '⏳ جاري التحليل...';
      var canvas = document.querySelector('#previewCanvas') || document.querySelector('canvas') || null;
      var img = null;
      if(!canvas){
        img = document.querySelector('img#previewImage, img.preview, img[src]') || null;
      }
      if(!canvas && img){
        var c = document.createElement('canvas'); c.width = img.naturalWidth||img.width||800; c.height = img.naturalHeight||img.height||600;
        try{ c.getContext('2d').drawImage(img,0,0,c.width,c.height); }catch(e){}
        canvas = c;
      }
      if(!canvas){ status.textContent='لا توجد معاينة'; return; }
      try{
        var res = await analyzeAdvanced(canvas);
        if(!res){ status.textContent='فشل التحليل'; return; }
        renderResults(res);
        try{
          var tcan = document.createElement('canvas'); tcan.width = Math.min(200, canvas.width); tcan.height = Math.min(200, canvas.height);
          tcan.getContext('2d').drawImage(canvas,0,0,tcan.width,tcan.height);
          previewImg.src = tcan.toDataURL('image/png'); previewImg.style.display='block';
        }catch(e){ previewImg.style.display='none'; }
        if(applyBtn) applyBtn.style.display='inline-block';
        if(copyBtn) copyBtn.style.display='inline-block';
        status.textContent='تم التحليل';
      }catch(err){
        console.error('[AI] analyzeAdvanced error', err);
        status.textContent='خطأ أثناء التحليل';
      }
    });
    if(applyBtn){
      applyBtn.addEventListener('click', function(){ try{ var r=JSON.parse(localStorage.getItem('cnc_ai_analysis')||'null'); if(r&&r.rec){ applyToMachine(r.rec); showToast('تم تطبيق التوصيات'); } }catch(e){ console.warn(e); } });
    }
    if(copyBtn){
      copyBtn.addEventListener('click', function(){ var txt=document.getElementById('aiResultTable').innerText||''; try{ navigator.clipboard.writeText(txt); }catch(e){} });
    }
  }

  window.addEventListener('load', setup);
  var bar = document.querySelector('.tab-bar') || document.getElementById('tabBar');
  if(bar){ var mo=new MutationObserver(function(){ setup(); }); mo.observe(bar,{childList:true,subtree:true}); }
  setTimeout(setup,300);
})();
