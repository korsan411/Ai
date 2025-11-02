// ================= نماذج الأدوات للمحاكاة =================
function createToolModel() {
  try {
    const group = new THREE.Group();
    const bodyGeom = new THREE.CylinderGeometry(0.6, 0.6, 6, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    
    const tipGeom = new THREE.ConeGeometry(0.8, 2.5, 12);
    const tipMat = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const tip = new THREE.Mesh(tipGeom, tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 4;
    group.add(tip);
    
    group.scale.set(1.5,1.5,1.5);
    return group;
  } catch (error) {
    console.error('فشل في إنشاء نموذج الأداة:', error);
    return new THREE.Group();
  }
}

function createLaserToolModel() {
  try {
    const group = new THREE.Group();
    const bodyGeom = new THREE.CylinderGeometry(0.4, 0.4, 8, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    
    const lensGeom = new THREE.CylinderGeometry(0.6, 0.6, 1, 16);
    const lensMat = new THREE.MeshPhongMaterial({ color: 0x00ffff });
    const lens = new THREE.Mesh(lensGeom, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 4.5;
    group.add(lens);
    
    group.scale.set(1.2,1.2,1.2);
    return group;
  } catch (error) {
    console.error('فشل في إنشاء نموذج أداة الليزر:', error);
    return new THREE.Group();
  }
}

function create3DPrinterToolModel() {
  try {
    const group = new THREE.Group();
    const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 6, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x10b981 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    
    const nozzleGeom = new THREE.ConeGeometry(0.5, 2, 12);
    const nozzleMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = 4;
    group.add(nozzle);
    
    group.scale.set(1.2,1.2,1.2);
    return group;
  } catch (error) {
    console.error('فشل في إنشاء نموذج أداة الطابعة ثلاثية الأبعاد:', error);
    return new THREE.Group();
  }
}