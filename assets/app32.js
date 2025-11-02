/* ==========================================================
   🧠 CncAi / Ai-main/assets/app32.js
   🛡️ Safe Init Layer — DOM + OpenCV + Element Protection (v2)
   ========================================================== */

function safeGet(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`⚠️ العنصر ${id} غير موجود في DOM`);
    return null;
  }
  return el;
}

function initWhenReady() {
  // ✅ تأكد من جاهزية OpenCV
  if (typeof cv === "undefined" || !cv || !cv.Mat) {
    console.log("⏳ انتظار تهيئة OpenCV...");
    setTimeout(initWhenReady, 200);
    return;
  }

  // ✅ تحقق من وجود عناصر الواجهة
  const imageInput = safeGet("imageInput");
  const previewContainer = safeGet("previewContainer");
  const analysisCanvas = safeGet("analysisCanvas");

  if (!imageInput || !previewContainer || !analysisCanvas) {
    console.log("⏳ انتظار ظهور عناصر الواجهة...");
    setTimeout(initWhenReady, 300);
    return;
  }

  // ✅ تحقق من جاهزية الـ Canvas
  const ctx = analysisCanvas.getContext("2d");
  if (!ctx) {
    console.warn("⚠️ لم يتم إنشاء سياق الرسم للـ Canvas");
    setTimeout(initWhenReady, 300);
    return;
  }

  console.log("✅ البيئة جاهزة — بدء initApp...");
  if (typeof initApp === "function") {
    try {
      initApp();
    } catch (err) {
      console.error("❌ خطأ أثناء تشغيل initApp:", err);
    }
  } else {
    console.error("❌ لم يتم العثور على الدالة initApp()");
  }
}

// ✅ تأكد من جاهزية DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWhenReady);
} else {
  initWhenReady();
}

/* ==========================================================
   👇 بقية محتوى app32.js الأصلي (لم يتم تغييره)
   ========================================================== */
(function () {
  // وظائفك الأصلية هنا كما هي

  window.initApp = function () {
    console.log("🔧 initApp بدأ التنفيذ الفعلي للتطبيق");

    // جلب العناصر بأمان
    const imageInput = safeGet("imageInput");
    const analysisCanvas = safeGet("analysisCanvas");
    const previewContainer = safeGet("previewContainer");

    if (!imageInput || !analysisCanvas || !previewContainer) {
      console.warn("⚠️ بعض العناصر غير موجودة — تأجيل التحليل");
      return;
    }

    // الكود الأصلي الذي يتعامل مع واجهة المستخدم أو المعالجة
    // مثال:
    // setupEventListeners();
    // initialize3DView();
    // loadUserPreferences();
  };

  console.log("🧩 app32.js جاهز.");
})();
