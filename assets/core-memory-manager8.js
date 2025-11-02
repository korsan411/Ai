// ================= نظام إدارة الذاكرة المحسن =================
class MemoryManager {
  static safeDelete(mat, name = 'mat') {
    try {
      if (mat && typeof mat.delete === 'function') {
        if (!mat.isDeleted) {
          mat.delete();
          mat.isDeleted = true;
          console.log(`🧹 تم حذف ${name} بأمان`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ فشل في حذف المصفوفة (${name}):`, error);
      const dbgList = document.getElementById('debugList');
      if (dbgList) {
        const div = document.createElement('div');
        div.className = 'dbg-item dbg-warn';
        div.textContent = `فشل في حذف ${name}: ${error.message}`;
        dbgList.prepend(div);
      }
    }
  }

  constructor() {
    this.mats = new Set();
    this.maxMats = 15; // تقليل الحد الأقصى لتحسين الأداء
  }

  track(mat) {
    try {
      if (mat && !this.isMatDeleted(mat)) {
        this.mats.add(mat);
        // تنظيف الذاكرة إذا تجاوزنا الحد
        if (this.mats.size > this.maxMats) {
          this.cleanupOldest();
        }
      }
    } catch (error) {
      console.warn('فشل في تتبع المصفوفة:', error);
    }
  }

  isMatDeleted(mat) {
    try {
      return !mat || typeof mat.delete !== 'function';
    } catch {
      return true;
    }
  }

  cleanupOldest() {
    try {
      if (this.mats.size > 0) {
        const oldest = this.mats.values().next().value;
        this.safeDelete(oldest);
        this.mats.delete(oldest);
      }
    } catch (error) {
      console.warn('فشل في تنظيف أقدم مصفوفة:', error);
    }
  }

  safeDelete(mat) {
    try {
      if (!this.isMatDeleted(mat) && typeof mat.delete === 'function') {
        mat.delete();
      }
    } catch (error) {
      console.warn('فشل في حذف المصفوفة بأمان:', error);
    }
  }

  cleanupAll() {
    try {
      this.mats.forEach(mat => this.safeDelete(mat));
      this.mats.clear();
    } catch (error) {
      console.warn('فشل في التنظيف الكامل:', error);
    }
  }

  cleanupMats() {
    try {
      if (grayMat && !this.isMatDeleted(grayMat)) { 
        this.safeDelete(grayMat);
        grayMat = null; 
      }
    } catch (error) { 
      console.warn('فشل في تنظيف grayMat:', error); 
    }
    
    try {
      if (contour && !this.isMatDeleted(contour) && typeof contour.delete === 'function') {
        this.safeDelete(contour);
        contour = null;
      }
    } catch (error) { 
      console.warn('فشل في تنظيف contour:', error); 
    }
    
    try {
      additionalContours.forEach(item => {
        if (item && item.contour && !this.isMatDeleted(item.contour)) {
          this.safeDelete(item.contour);
        }
      });
      additionalContours = [];
    } catch (error) { 
      console.warn('فشل في تنظيف additionalContours:', error); 
    }
  }

  getMemoryUsage() {
    return this.mats.size;
  }
}

const memoryManager = new MemoryManager();