/* ===========================================================
   CncAi — Startup Guard
   يتحقق من تحميل مكتبات THREE و OpenCV قبل تشغيل initApp()
   =========================================================== */

(function ensureLibrariesReady() {
  const MAX_WAIT = 8000; // أقصى انتظار 8 ثوانٍ
  const CHECK_INTERVAL = 200; // فحص كل 200 مللي ثانية
  let waited = 0;

  function check() {
    const threeReady = typeof THREE !== "undefined";
    const cvReady = typeof cv !== "undefined" && typeof cv.Mat === "function";

    if (threeReady && cvReady) {
      console.log("✅ المكتبات جاهزة: THREE و OpenCV محملتان بالكامل.");
      // استدعاء الدالة الرئيسية لتشغيل التطبيق
      if (typeof initApp === "function") {
        initApp();
      } else {
        console.warn("⚠️ لم يتم العثور على initApp() — تأكد من ترتيب السكربتات.");
      }
      return;
    }

    waited += CHECK_INTERVAL;
    if (waited >= MAX_WAIT) {
      console.error("❌ فشل تحميل المكتبات في الوقت المحدد.");
      alert("حدث خطأ أثناء تحميل المكتبات. يرجى إعادة تحميل الصفحة.");
      return;
    }

    setTimeout(check, CHECK_INTERVAL);
  }

  // بدء الفحص بعد تحميل الصفحة
  window.addEventListener("load", check);
})();
