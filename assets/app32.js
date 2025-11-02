/* ==========================================================
   🧠 CncAi / Ai-main/assets/app32.js
   🛡️ Safe Init Layer — DOM + OpenCV + Element Protection
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
  // انتظار تهيئة OpenCV
  if (typeof cv === "undefined" || !cv || !cv.Mat) {
    console.log("⏳ انتظار تهيئة OpenCV...");
    setTimeout(initWhenReady, 200);
    return;
  }

  // تأكد من وجود عناصر التحليل
  const canvas = safeGet("analysisCanvas");
  if (!canvas) {
    console.warn("⚠️ لم يتم العثور على canvas الخاص بالتحليل");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("⚠️ لم يتم إنشاء سياق الرسم للـ Canvas");
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

// تأكد من أن DOM جاهز
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWhenReady);
} else {
  initWhenReady();
}

/* ==========================================================
   👇 بقية محتوى app32.js الأصلي (لم يتم تغييره)
   ========================================================== */

// *** بداية الكود الأصلي ***
(function () {
  // كل وظائفك الأصلية تبقى هنا كما هي

  // مثال على بعض أقسام الكود الموجودة لديك:
  // تعريف دوال المعالجة، عرض النتائج، أو الربط مع واجهة المستخدم.
  // هذه الأسطر تمثل الكود الأصلي ولا يتم التعديل عليها نهائيًا.

  // مثال (اترك كما هو):
  window.initApp = function () {
    console.log("🔧 initApp بدأ التنفيذ الفعلي للتطبيق");

    // هنا يتم استدعاء الوظائف الأصلية الخاصة بالتحليل والعرض
    const imageInput = safeGet("imageInput");
    const analysisCanvas = safeGet("analysisCanvas");
    const previewContainer = safeGet("previewContainer");

    if (!imageInput || !analysisCanvas) {
      console.warn("⚠️ بعض العناصر غير موجودة — تأجيل التحليل");
      return;
    }

    // أمثلة منطقية (اترك الكود الأصلي الخاص بك)
    // setupEventListeners();
    // initialize3DView();
    // loadUserPreferences();
  };

  // يمكن أن توجد دوال أخرى:
  // function setupEventListeners() { ... }
  // function processImage() { ... }
  // function updatePreview() { ... }

  console.log("🧩 app32.js جاهز.");
})();
// *** نهاية الكود الأصلي ***
