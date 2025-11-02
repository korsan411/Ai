// ================= نظام التقدم =================
function showProgress(message = 'جاري المعالجة...') {
  try {
    document.getElementById('progressText').textContent = message;
    document.getElementById('progressOverlay').style.display = 'flex';
  } catch (error) {
    console.warn('فشل في عرض التقدم:', error);
  }
}

function hideProgress() {
  try {
    document.getElementById('progressOverlay').style.display = 'none';
  } catch (error) {
    console.warn('فشل في إخفاء التقدم:', error);
  }
}