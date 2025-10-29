/* Debug Overlay — simple logging console with controls
   Exposes window.CncAi.debug for programmatic logging.
*/

(function(){
  var overlay, logArea, btnClear, btnClose, btnToggleSize;

  function createElements(){
    overlay = document.getElementById('debugOverlay');
    logArea = document.getElementById('debugLog');
    btnClear = document.getElementById('dbgClear');
    btnClose = document.getElementById('dbgClose');
    btnToggleSize = document.getElementById('dbgToggleSize');

    if (!overlay || !logArea) {
      // if DOM not ready, create minimal fallback
      overlay = overlay || document.createElement('div');
      overlay.id = 'debugOverlay';
      overlay.style.display = 'none';
      logArea = logArea || document.createElement('pre');
      logArea.id = 'debugLog';
      overlay.appendChild(logArea);
      document.body.appendChild(overlay);
      btnClear = btnClear || null;
      btnClose = btnClose || null;
      btnToggleSize = btnToggleSize || null;
    }
  }

  function appendLog(msg, cls){
    if (!logArea) return;
    var time = new Date().toLocaleTimeString();
    var line = '[' + time + '] ' + msg + '\n';
    logArea.textContent = line + logArea.textContent;
  }

  function showOverlay(){
    if (!overlay) return;
    overlay.style.display = 'flex';
  }
  function hideOverlay(){ if (!overlay) return; overlay.style.display = 'none'; }

  function clearLog(){ if (!logArea) return; logArea.textContent = ''; }

  function toggleSize(){
    if (!overlay) return;
    if (overlay.classList.contains('big')) {
      overlay.classList.remove('big');
      overlay.style.width = '380px';
      overlay.style.maxHeight = '60vh';
    } else {
      overlay.classList.add('big');
      overlay.style.width = '720px';
      overlay.style.maxHeight = '80vh';
    }
  }

  function initDebug(){
    createElements();
    // attach controls if exist
    if (btnClear) btnClear.addEventListener('click', clearLog);
    if (btnClose) btnClose.addEventListener('click', hideOverlay);
    if (btnToggleSize) btnToggleSize.addEventListener('click', toggleSize);

    // expose global API
    window.CncAi = window.CncAi || {};
    window.CncAi.debug = {
      log: function(msg){ appendLog(String(msg)); showOverlay(); },
      info: function(msg){ appendLog('[i] ' + String(msg)); showOverlay(); },
      warn: function(msg){ appendLog('[!] ' + String(msg)); showOverlay(); },
      error: function(msg){ appendLog('[x] ' + String(msg)); showOverlay(); },
      clear: clearLog,
      show: showOverlay,
      hide: hideOverlay,
      toggleSize: toggleSize
    };

    // initial test message
    window.CncAi.debug.info('Debug overlay initialized');
  }

  // auto-init when DOM ready
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initDebug);
  } else {
    initDebug();
  }
})();
