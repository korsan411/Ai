// ================= Colormap Event Listeners - الإصدار المحسن =================
function initColormapButtons() {
  try {
    document.querySelectorAll('#colormapButtons button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        try {
          document.querySelectorAll('#colormapButtons button').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          currentColormap = btn.dataset.map;
          
          // تحديث الـ heatmap إذا كان ظاهر
          if (document.getElementById('heatmap').classList.contains('active')) {
            renderHeatmap();
          }
          
          // تحديث الـ top view إذا كان هناك G-code
          if (lastGeneratedGcode) {
            renderTopViewFromGcode(lastGeneratedGcode);
          }
          
          // تحديث الـ contour view إذا كان ظاهر
          if (document.getElementById('contour').classList.contains('active') && grayMat && contour) {
            renderContour(grayMat, contour);
          }
          
          showToast('تم تغيير نموذج الألوان إلى ' + currentColormap);
        } catch (error) {
          console.error('فشل في تغيير خريطة الألوان:', error);
        }
      });
    });
  } catch (error) {
    console.error('فشل في تهيئة أزرار خريطة الألوان:', error);
  }
}