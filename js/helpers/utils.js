/* CncAi — utils.js
   أدوات عامة مساعدة
*/

(function() {
  window.CncAi = window.CncAi || {};

  const Utils = {
    delay(ms){ return new Promise(res => setTimeout(res, ms)); },
    formatTime(){ 
      const d = new Date(); 
      return d.toLocaleTimeString('ar-EG'); 
    },
    clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
  };

  window.CncAi.utils = Utils;
})();
