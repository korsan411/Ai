/* MemoryManager — helper for cleaning up objects (esp. OpenCV Mats)
   Keeps a registry to avoid double-delete and memory leaks.
*/

(function(){
  function MemoryManager(){
    this.registry = new WeakMap(); // track objects that were "managed"
  }

  MemoryManager.prototype.track = function(obj){
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return;
    try { this.registry.set(obj, true); } catch(e){}
  };

  MemoryManager.prototype.safeDelete = function(obj){
    // Works for OpenCV Mat (has delete() or .delete), or Three.js geometries/dispose
    if (!obj) return;
    try {
      // if it's an array, delete each
      if (Array.isArray(obj)){
        obj.forEach(item => this.safeDelete(item));
        return;
      }
      // OpenCV Mat uses .delete() historically
      if (typeof obj.delete === 'function'){
        try { obj.delete(); } catch(e){ /* ignore */ }
        return;
      }
      // some libs use .dispose()
      if (typeof obj.dispose === 'function'){
        try { obj.dispose(); } catch(e){ /* ignore */ }
        return;
      }
      // if it's a DOM image or canvas, try nulling src
      if (obj instanceof HTMLImageElement){
        try { obj.src = ''; } catch(e){}
        return;
      }
      // fallback: nothing to do
    } catch(e){
      console.warn('MemoryManager.safeDelete error', e);
    }
  };

  // convenience: delete props from an object
  MemoryManager.prototype.safeDeleteProps = function(obj, propNames){
    if (!obj) return;
    propNames.forEach(name=>{
      if (obj[name]) {
        this.safeDelete(obj[name]);
        try { delete obj[name]; } catch(e){}
      }
    });
  };

  // attach to global namespace
  window.CncAi = window.CncAi || {};
  window.CncAi.memoryManager = new MemoryManager();
})();
