// ================= دعم تحميل ملفات STL و SVG و DXF =================
function initFileFormatButtons() {
  try {
    document.querySelectorAll('#fileFormatButtons button').forEach(btn => {
      btn.addEventListener('click', function() {
        const format = this.getAttribute('data-format');
        
        // إزالة النشط من جميع الأزرار
        document.querySelectorAll('#fileFormatButtons button').forEach(b => {
          b.classList.remove('active');
        });
        
        // إضافة النشط للزر المحدد
        this.classList.add('active');
        
        // إنشاء عنصر إدخال ملف مخفي
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        
        // تحديد نوع الملفات المقبولة
        switch(format) {
          case 'stl':
            fileInput.accept = '.stl';
            break;
          case 'svg':
            fileInput.accept = '.svg';
            break;
          case 'dxf':
            fileInput.accept = '.dxf';
            break;
        }
        
        fileInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;
          
          handleFileFormatUpload(file, format);
          
          // تنظيف
          document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
      });
    });
  } catch (error) {
    console.error('فشل في تهيئة أزرار تنسيقات الملفات:', error);
  }
}

// معالجة تحميل ملفات STL و SVG و DXF
function handleFileFormatUpload(file, format) {
  taskManager.addTask(async () => {
    try {
      let message = '';
      
      switch(format) {
        case 'stl':
          message = 'تم تحميل ملف STL بنجاح. يمكنك معاينته في قسم 3D Models.';
          await loadSTLFile(file);
          break;
        case 'svg':
          message = 'تم تحميل ملف SVG بنجاح. يمكن تحويله إلى G-code.';
          await processSVGFile(file);
          break;
        case 'dxf':
          message = 'تم تحميل ملف DXF بنجاح. يمكن تحويله إلى G-code.';
          await processDXFFile(file);
          break;
      }
      
      showToast(`✅ ${message}`);
    } catch (error) {
      console.error(`خطأ في تحميل ملف ${format.toUpperCase()}:`, error);
      throw new Error(`فشل في تحميل ملف ${format.toUpperCase()}: ${error.message}`);
    }
  }, `تحميل ملف ${format.toUpperCase()}`);
}