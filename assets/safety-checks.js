// safety_checks.js
// CncAi — Safety Checks (silent mode)
// Injects non-destructive runtime protections (idempotent).
// Place this script early (before other app scripts) to be most effective.

(function () {
  if (window.__CncAiSafetyChecksInstalled) return;
  window.__CncAiSafetyChecksInstalled = true;

  // --- Config ---
  const DEBUG = false; // silent mode: set true only for development
  const MAX_EVENT_LISTENERS_PER_ELEMENT = 200; // sanity cap

  // --- Helpers ---
  function dlog(...args) { if (DEBUG) console.debug('[SAFETY]', ...args); }
  function dwarn(...args) { if (DEBUG) console.warn('[SAFETY]', ...args); }

  // --- 1) Disable dangerous evaluators ---
  try {
    Object.defineProperty(window, 'eval', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: function () {
        dwarn('Blocked eval() call');
        return undefined;
      }
    });
  } catch (e) { dlog('eval override skipped', e); }

  try {
    Object.defineProperty(window, 'Function', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: function () {
        dwarn('Blocked Function() constructor');
        throw new Error('Function constructor disabled by safety_checks');
      }
    });
  } catch (e) { dlog('Function override skipped', e); }

  // Wrap setTimeout / setInterval to block string-based invocation
  const _setTimeout = window.setTimeout;
  const _setInterval = window.setInterval;
  window.setTimeout = function (fn, ...rest) {
    if (typeof fn === 'string') {
      dwarn('Blocked setTimeout with string code');
      return 0;
    }
    return _setTimeout(fn, ...rest);
  };
  window.setInterval = function (fn, ...rest) {
    if (typeof fn === 'string') {
      dwarn('Blocked setInterval with string code');
      return 0;
    }
    return _setInterval(fn, ...rest);
  };

  // --- 2) Guard against reckless use of innerHTML / insertAdjacentHTML ---
  (function protectDOMInsertions() {
    try {
      const proto = Element.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
      if (desc && desc.set) {
        const originalSetter = desc.set.bind(proto);
        Object.defineProperty(proto, 'innerHTML', {
          configurable: true,
          enumerable: false,
          get: desc.get ? desc.get : function () { return this.innerHTML; },
          set: function (val) {
            // If value contains script tags or onxxx attributes, block silently
            if (typeof val === 'string' && /<script[\s>]|on\w+=/i.test(val)) {
              dwarn('Blocked suspicious innerHTML assignment on', this);
              return;
            }
            return originalSetter.call(this, val);
          }
        });
        dlog('innerHTML setter wrapped');
      }
    } catch (e) {
      dlog('protectDOMInsertions failed', e);
    }

    // insertAdjacentHTML
    try {
      const origIAH = Element.prototype.insertAdjacentHTML;
      Element.prototype.insertAdjacentHTML = function (position, text) {
        if (typeof text === 'string' && /<script[\s>]|on\w+=/i.test(text)) {
          dwarn('Blocked suspicious insertAdjacentHTML on', this);
          return;
        }
        return origIAH.call(this, position, text);
      };
      dlog('insertAdjacentHTML wrapped');
    } catch (e) {
      dlog('insertAdjacentHTML wrap failed', e);
    }
  })();

  // --- 3) Prevent duplicate event listeners (simple tracker) ---
  (function eventListenerGuard() {
    try {
      const origAdd = EventTarget.prototype.addEventListener;
      const listenerMap = new WeakMap(); // element -> { type -> Set(listeners) }

      EventTarget.prototype.addEventListener = function (type, listener, options) {
        try {
          if (!listenerMap.has(this)) listenerMap.set(this, new Map());
          const map = listenerMap.get(this);
          if (!map.has(type)) map.set(type, new Set());
          const set = map.get(type);
          // Use function.toString() as a heuristic key for duplicates (not perfect for bound funcs)
          const key = listener && listener.toString ? listener.toString() : listener;
          if (set.has(key)) {
            // duplicate detected — silently ignore
            dwarn('Prevented duplicate event listener', this, type);
            return;
          }
          set.add(key);
          // cleanup cap: avoid memory blow if too many listeners
          if (set.size > MAX_EVENT_LISTENERS_PER_ELEMENT) {
            dwarn('Exceeded listener cap for element — clearing record', this, type);
            set.clear();
          }
        } catch (e) {
          dlog('listener guard internal error', e);
        }
        return origAdd.call(this, type, listener, options);
      };
      dlog('EventTarget.addEventListener wrapped');
    } catch (e) {
      dlog('eventListenerGuard failed', e);
    }
  })();

  // --- 4) Intercept script insertion from external origins (non-destructive) ---
  (function blockExternalScripts() {
    try {
      const origAppend = Node.prototype.appendChild;
      Node.prototype.appendChild = function (node) {
        try {
          if (node && node.tagName === 'SCRIPT') {
            const src = node.src || '';
            if (src) {
              // allow same-origin or relative scripts; block others
              const link = document.createElement('a');
              link.href = src;
              const sameOrigin = link.hostname === window.location.hostname && link.protocol === window.location.protocol;
              if (!sameOrigin) {
                dwarn('Blocked external script appendChild:', src);
                return node; // ignore insertion
              }
            }
          }
        } catch (e) { dlog('appendChild interceptor error', e); }
        return origAppend.call(this, node);
      };
      dlog('appendChild wrapped to guard external scripts');
    } catch (e) {
      dlog('blockExternalScripts failed', e);
    }
  })();

  // --- 5) Protect against multiple init calls (idempotency detector) ---
  (function idempotencyGuard() {
    try {
      // Mark known init functions if they exist so they can check before re-initialization.
      // We don't change their code; instead we provide a helper function on window.
      window.__cncai_markInitialized = function (name, element) {
        try {
          if (!window.__cncai_inits) window.__cncai_inits = {};
          if (window.__cncai_inits[name]) return false;
          window.__cncai_inits[name] = {
            ts: Date.now(),
            el: element ? (element.id || element.tagName) : null
          };
          dlog('Marked initialized:', name);
          return true;
        } catch (e) { dlog('markInitialized error', e); return false; }
      };
      dlog('idempotency helper injected: window.__cncai_markInitialized');
    } catch (e) {
      dlog('idempotencyGuard failed', e);
    }
  })();

  // --- 6) Light memory watchdog for OpenCV / WebGL (silent warnings) ---
  (function memoryWatchdog() {
    try {
      const mem = { lastJSHeap: 0, lastCheck: Date.now() };
      setInterval(() => {
        try {
          if (performance && performance.memory) {
            const used = performance.memory.usedJSHeapSize || 0;
            if (mem.lastJSHeap && used > mem.lastJSHeap * 1.45) {
              dwarn('Possible JS heap growth detected: ', Math.round(mem.lastJSHeap), '->', Math.round(used));
            }
            mem.lastJSHeap = used;
          }
        } catch (e) { dlog('memory watchdog error', e); }
      }, 60000); // every minute
      dlog('Memory watchdog installed (silent)');
    } catch (e) {
      dlog('memoryWatchdog failed', e);
    }
  })();

  // --- 7) Prevent accidental file execution by tag (basic) ---
  (function preventDangerousFileTypes() {
    try {
      // Hook at createElement to mark suspicious anchors
      const origCreate = Document.prototype.createElement;
      Document.prototype.createElement = function (tagName, options) {
        const el = origCreate.call(this, tagName, options);
        try {
          if (tagName && tagName.toLowerCase() === 'a') {
            // wrap click to ensure only allowed extensions downloaded via anchor
            const origClick = el.click;
            el.click = function () {
              try {
                const href = el.href || '';
                if (href && /\.(exe|bat|cmd|sh|msi|php|py|pl|scr)(\?|$)/i.test(href)) {
                  dwarn('Blocked suspicious file download attempt via anchor:', href);
                  return;
                }
              } catch (e) { dlog('anchor click intercept error', e); }
              return origClick.call(this);
            };
          }
        } catch (e) { dlog('createElement wrapper internal', e); }
        return el;
      };
      dlog('createElement wrapper installed');
    } catch (e) {
      dlog('preventDangerousFileTypes failed', e);
    }
  })();

  // --- 8) Expose a small API for runtime checks (silent) ---
  window.__CncAiSafety = {
    isInstalled: true,
    debug: function (on) { DEBUG = !!on; },
    logState: function () {
      console.debug('[SAFETY] installed at', new Date().toISOString());
      if (performance && performance.memory) console.debug('[SAFETY] memory', performance.memory);
    }
  };

  dlog('safety_checks installed (silent mode)');
})();