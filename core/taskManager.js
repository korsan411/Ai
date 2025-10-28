// taskManager.js - skeleton implementation
export class TaskManager {
  constructor(){
    this.queue = [];
    this.running = false;
  }
  addTask(fn, desc='task'){
    this.queue.push({fn, desc});
    this._runNext();
  }
  async _runNext(){
    if(this.running) return;
    const item = this.queue.shift();
    if(!item) return;
    this.running = true;
    try {
      await item.fn();
      console.log('Task done:', item.desc);
    } catch(e){
      console.error('Task error', e);
    } finally {
      this.running = false;
      this._runNext();
    }
  }
}
export const taskManager = new TaskManager();
