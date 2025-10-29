/* TaskManager — simple queue runner
   Designed to work without modules (attaches to window.CncAi.taskManager)
*/

(function(){
  function TaskManager(){
    this.queue = [];
    this.isRunning = false;
    this.onTaskStart = null;
    this.onTaskEnd = null;
  }

  TaskManager.prototype.addTask = function(taskFn, meta){
    // taskFn should return a Promise or be async
    const task = { fn: taskFn, meta: meta || {} };
    this.queue.push(task);
    // auto-run if idle
    if (!this.isRunning) this._runNext();
    return task;
  };

  TaskManager.prototype._runNext = function(){
    const self = this;
    if (self.queue.length === 0){
      self.isRunning = false;
      return;
    }
    const task = self.queue.shift();
    try {
      self.isRunning = true;
      if (typeof self.onTaskStart === 'function') {
        try { self.onTaskStart(task.meta); } catch(e){ console.warn('onTaskStart error', e); }
      }
      const res = task.fn();
      // support sync and promise
      Promise.resolve(res)
        .then((v)=>{
          if (typeof self.onTaskEnd === 'function') {
            try { self.onTaskEnd(null, task.meta, v); } catch(e){ console.warn('onTaskEnd cb error', e); }
          }
        })
        .catch((err)=>{
          if (typeof self.onTaskEnd === 'function') {
            try { self.onTaskEnd(err, task.meta); } catch(e){ console.warn('onTaskEnd cb error', e); }
          } else {
            console.error('Task error', err);
          }
        })
        .finally(()=>{
          // next tick to avoid deep recursion
          setTimeout(()=> self._runNext(), 10);
        });
    } catch (err){
      console.error('TaskManager _runNext caught', err);
      setTimeout(()=> self._runNext(), 10);
    }
  };

  TaskManager.prototype.clear = function(){
    this.queue = [];
  };

  TaskManager.prototype.isIdle = function(){
    return !this.isRunning && this.queue.length === 0;
  };

  // attach to global namespace
  window.CncAi = window.CncAi || {};
  window.CncAi.taskManager = new TaskManager();
})();
