// ================= نظام إدارة المهام المحسن =================
class TaskManager {
  constructor() {
    this.queue = [];
    this.isRunning = false;
    this.currentTask = null;
  }

  async addTask(taskFn, description = 'مهمة') {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, description, resolve, reject });
      if (!this.isRunning) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isRunning = false;
      return;
    }

    this.isRunning = true;
    const task = this.queue.shift();
    this.currentTask = task;

    try {
      showProgress(task.description);
      const result = await task.taskFn();
      task.resolve(result);
    } catch (error) {
      console.error(`فشل في ${task.description}:`, error);
      showToast(`فشل في ${task.description}: ${error.message}`, 5000);
      task.reject(error);
    } finally {
      this.currentTask = null;
      hideProgress();
      // استدعاء تالي بعد فترة راحة
      setTimeout(() => this.processQueue(), 50);
    }
  }

  clear() {
    this.queue = [];
    this.isRunning = false;
    this.currentTask = null;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

const taskManager = new TaskManager();