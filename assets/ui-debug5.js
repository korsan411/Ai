// ================= Debug overlay system =================
(function initDebugOverlay(){
  try {
    const debugList = document.getElementById('debugList');
    const dbgClear = document.getElementById('dbgClear');
    const dbgCopy = document.getElementById('dbgCopy');
    const dbgToggleSize = document.getElementById('dbgToggleSize');
    const debugOverlay = document.getElementById('debugOverlay');
    const debugSummary = document.getElementById('debugSummary');
    const logs = [];

    function formatTime(d) { 
      try {
        return d.toISOString().slice(11, 23);
      } catch {
        return '--:--:--';
      }
    }
    
    function updateSummary() { 
      debugSummary.textContent = logs.length + ' سجلات'; 
    }

    function addEntry(type, message, stack) {
      try {
        const time = new Date();
        const entry = { time, type, message, stack };
        logs.push(entry);
        updateSummary();

        const div = document.createElement('div');
        div.className = 'dbg-item ' + (type === 'error' ? 'dbg-error' : (type === 'warn' ? 'dbg-warn' : 'dbg-info'));
        const tspan = document.createElement('span');
        tspan.className = 'dbg-time';
        tspan.textContent = `[${formatTime(time)}] ${type.toUpperCase()}`;
        const msg = document.createElement('div');
        msg.textContent = String(message).substring(0, 500); // تحديد طول الرسالة
        div.appendChild(tspan);
        div.appendChild(msg);
        if (stack && type !== 'info') {
          const meta = document.createElement('div');
          meta.className = 'dbg-meta';
          meta.textContent = String(stack).split('\n').slice(0,2).join(' | ');
          div.appendChild(meta);
        }
        debugList.prepend(div);

        // تحديد عدد السجلات المحفوظة
        if (logs.length > 100) {
          const oldLog = logs.shift();
          if (debugList.lastChild) {
            debugList.removeChild(debugList.lastChild);
          }
        }
      } catch (e) {
        console.error('فشل في إضافة سجل تصحيح:', e);
      }
    }

    dbgClear.addEventListener('click', () => {
      try {
        debugList.innerHTML = '';
        logs.length = 0;
        updateSummary();
      } catch (e) {
        console.error('فشل في مسح السجلات:', e);
      }
    });

    dbgCopy.addEventListener('click', async () => {
      try {
        const text = logs.map(l => `[${l.time.toISOString()}] ${l.type.toUpperCase()}: ${l.message}\n${l.stack||''}`).join('\n\n');
        await navigator.clipboard.writeText(text);
        addEntry('info', 'تم نسخ السجل إلى الحافظة');
      } catch (e) {
        addEntry('error', 'فشل نسخ السجل: ' + (e.message || e));
      }
    });

    dbgToggleSize.addEventListener('click', (ev) => {
      try {
        ev.stopPropagation();
        debugOverlay.classList.toggle('minimized');
        dbgToggleSize.textContent = debugOverlay.classList.contains('minimized') ? '🔼' : '🔽';
      } catch (e) {
        console.error('فشل في تبديل حجم التصحيح:', e);
      }
    });

    // Click restore when minimized
    debugOverlay.addEventListener('click', (ev) => {
      try {
        if (debugOverlay.classList.contains('minimized')) {
          debugOverlay.classList.remove('minimized');
          dbgToggleSize.textContent = '🔽';
        }
      } catch (e) {
        console.error('فشل في استعادة حجم التصحيح:', e);
      }
    });

    // override console methods
    const _log = console.log, _warn = console.warn, _error = console.error;
    console.log = function(...args) {
      try { 
        addEntry('info', args.map(a=> {
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch { return String(a); }
          }
          return String(a);
        }).join(' ')); 
      } catch(e){}
      _log.apply(console, args);
    };
    
    console.warn = function(...args) {
      try { 
        addEntry('warn', args.map(a=> {
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch { return String(a); }
          }
          return String(a);
        }).join(' '), new Error().stack); 
      } catch(e){}
      _warn.apply(console, args);
    };
    
    console.error = function(...args) {
      try { 
        addEntry('error', args.map(a=> {
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch { return String(a); }
          }
          return String(a);
        }).join(' '), new Error().stack); 
      } catch(e){}
      _error.apply(console, args);
    };

    window.addEventListener('error', function(ev){
      try { 
        addEntry('error', 
          (ev.message || 'Unknown error') + ' (' + (ev.filename || 'unknown') + ':' + (ev.lineno || 'unknown') + ')', 
          ev.error && ev.error.stack ? ev.error.stack : ''
        ); 
      } catch(e){}
    });

    window.addEventListener('unhandledrejection', function(ev){
      try { 
        addEntry('error', 
          'UnhandledRejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || 'Unknown reason')), 
          ev.reason && ev.reason.stack ? ev.reason.stack : ''
        ); 
      } catch(e){}
    });

    addEntry('info', 'تم تهيئة نظام التصحيح');

  } catch (error) {
    console.error('فشل في تهيئة نظام التصحيح:', error);
  }
})();