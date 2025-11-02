// ================= Load image - الإصدار المحسن =================
function initFileInput() {
  try {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', async function (e) {
      if (isProcessing) {
        showToast('جاري معالجة صورة سابقة...');
        return;
      }

      const file = e.target.files[0];
      if (!file) return;
      
      // تحقق من نوع الملف
      if (!file.type.match('image.*')) {
        showToast('الرجاء اختيار ملف صورة فقط (JPEG, PNG, etc.)');
        return;
      }
      
      // تحقق من حجم الملف
      if (file.size > 10 * 1024 * 1024) { // 10MB
        showToast('حجم الملف كبير جداً. الرجاء اختيار صورة أصغر من 10MB');
        return;
      }
      
      await taskManager.addTask(async () => {
        try {
          isProcessing = true;
          memoryManager.cleanupMats();
          
          const img = new Image();
          const imgUrl = URL.createObjectURL(file);
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
            img.src = imgUrl;
          });

          previewCanvas = document.getElementById('canvasOriginal');
          if (!previewCanvas) {
            throw new Error('عنصر canvas غير موجود');
          }

          const ctx = previewCanvas.getContext('2d');
          if (!ctx) {
            throw new Error('لا يمكن الحصول على سياق الرسم');
          }

          let w = img.width, h = img.height;
          
          // تحقق من حجم الصورة وقللها إذا لزم الأمر
          InputValidator.validateImageSize(previewCanvas);
          
          // تعيين الأبعاد الجديدة
          previewCanvas.width = w;
          previewCanvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          
          // 🧠 تمرير الصورة إلى وحدة التحليل AI Analyzer
          if (window.Analysis && typeof window.Analysis.loadImage === 'function') {
            try {
              const mat = cv.imread(previewCanvas);
              window.Analysis.loadImage(mat);
              mat.delete();
              console.log('✅ Analysis image attached manually.');
            } catch (e) {
              console.warn('⚠️ Analysis image attach failed:', e);
            }
          }
          
          showElement('canvasOriginal', 'originalPlaceholder');

          // تحرير الذاكرة
          URL.revokeObjectURL(imgUrl);

          if (cvReady) {
            const machineType = document.getElementById('machineCategory').value;
            if (machineType === 'laser') {
              await detectLaserContours();
            } else if (machineType === 'router') {
              await detectContours();
            }
          } else {
            showToast('في انتظار OpenCV...');
            await new Promise(resolve => {
              const checkCv = setInterval(() => {
                if (cvReady) {
                  clearInterval(checkCv);
                  resolve();
                }
              }, 100);
            });
            
            const machineType = document.getElementById('machineCategory').value;
            if (machineType === 'laser') {
              await detectLaserContours();
            } else if (machineType === 'router') {
              await detectContours();
            }
          }
        } catch (error) {
          console.error('خطأ في تحميل الصورة:', error);
          throw new Error('فشل في تحميل الصورة: ' + error.message);
        } finally {
          isProcessing = false;
        }
      }, 'تحميل الصورة');
    });
  } catch (error) {
    console.error('فشل في تهيئة إدخال الملف:', error);
  }
}