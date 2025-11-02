// ================= تحميل ملفات STL =================
async function loadSTLFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        // تنظيف المشهد السابق
        cleanup3DScene();
        
        // إنشاء مشهد جديد
        init3DScene();
        
        // استخدام STLLoader إذا كان متاحاً
        if (typeof THREE !== 'undefined' && THREE.STLLoader) {
          const loader = new THREE.STLLoader();
          const geometry = loader.parse(e.target.result);
          
          const material = new THREE.MeshPhongMaterial({ 
            color: 0x049ef4, 
            specular: 0x111111, 
            shininess: 200 
          });
          
          threeDModel = new THREE.Mesh(geometry, material);
          threeDModel.position.set(0, 0, 0);
          threeDScene.add(threeDModel);
          
          // ضبط الكاميرا لتناسب الموديل
          fitCameraToObject(threeDCamera, threeDModel, threeDControls);
          
          showElement('threeDContainer', 'threedPlaceholder');
          render3DScene();
          resolve();
        } else {
          reject(new Error('STL Loader غير متاح'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}