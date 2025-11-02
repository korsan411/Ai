// ================= تهيئة المشهد ثلاثي الأبعاد =================
function init3DScene() {
  const container = document.getElementById('threeDContainer');
  if (!container) return;
  
  threeDScene = new THREE.Scene();
  threeDScene.background = new THREE.Color(0x041022);
  
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 400;
  
  threeDCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  threeDCamera.position.z = 5;
  
  const canvas3D = document.getElementById('canvas3D');
  threeDRenderer = new THREE.WebGLRenderer({ 
    canvas: canvas3D,
    antialias: true 
  });
  threeDRenderer.setSize(width, height);
  
  // إضاءة
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  threeDScene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  threeDScene.add(directionalLight);
  
  // عناصر تحكم الكاميرا
  if (typeof THREE.OrbitControls !== 'undefined') {
    threeDControls = new THREE.OrbitControls(threeDCamera, threeDRenderer.domElement);
    threeDControls.enableDamping = true;
    threeDControls.dampingFactor = 0.05;
  }
  
  // شبكة مساعدة
  const gridHelper = new THREE.GridHelper(10, 10);
  threeDScene.add(gridHelper);
  
  // محاور
  const axesHelper = new THREE.AxesHelper(5);
  threeDScene.add(axesHelper);
}

// ================= ضبط الكاميرا لتناسب الموديل =================
function fitCameraToObject(camera, object, controls, offset = 1.25) {
  const boundingBox = new THREE.Box3().setFromObject(object);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * offset;
  
  cameraZ *= 1.5; // مسافة إضافية
  
  camera.position.set(center.x, center.y, cameraZ);
  camera.lookAt(center);
  
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}

// ================= عرض المشهد ثلاثي الأبعاد =================
function render3DScene() {
  if (!threeDRenderer || !threeDScene || !threeDCamera) return;
  
  requestAnimationFrame(render3DScene);
  
  if (threeDControls) {
    threeDControls.update();
  }
  
  threeDRenderer.render(threeDScene, threeDCamera);
}

// ================= تنظيف المشهد ثلاثي الأبعاد =================
function cleanup3DScene() {
  if (threeDControls) {
    threeDControls.dispose();
    threeDControls = null;
  }
  
  if (threeDRenderer) {
    threeDRenderer.dispose();
    threeDRenderer = null;
  }
  
  threeDScene = null;
  threeDCamera = null;
  threeDModel = null;
}