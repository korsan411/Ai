/* CncAi — validators.js
   التحقق من القيم والمعلمات
*/

(function() {
  window.CncAi = window.CncAi || {};

  const Validators = {
    isPositive(n){ return typeof n === 'number' && n >= 0; },
    isInt(n){ return Number.isInteger(n); },
    ensureRange(v, min, max){ return Math.max(min, Math.min(max, v)); }
  };

  window.CncAi.validators = Validators;
})();
