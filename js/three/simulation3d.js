// simulation3d.js - Three.js simulation module
let renderer, scene, camera, pathGroup = null;
let containerEl = null;
let currentScaleZ = 1;

export function initSimulation(containerId = 'threeContainer') {
  containerEl = document.getElementById(containerId);
  if(!containerEl){
    containerEl = document.createElement('div');
    containerEl.id = containerId;
    containerEl.style.width = '100%';
    containerEl.style.height = '400px';
    document.body.appendChild(containerEl);
  }
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  containerEl.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  camera = new THREE.PerspectiveCamera(45, containerEl.clientWidth / containerEl.clientHeight, 0.1, 10000);
  camera.position.set(200, 200, 200);
  camera.lookAt(0,0,0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemi.position.set(0, 200, 0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(0, 200, 100).normalize();
  scene.add(dir);

  const grid = new THREE.GridHelper(400, 40, 0x888888, 0xcccccc);
  scene.add(grid);
  const axes = new THREE.AxesHelper(100);
  scene.add(axes);

  pathGroup = new THREE.Group();
  scene.add(pathGroup);

  let isDragging = false, prevX = 0, prevY = 0;
  containerEl.addEventListener('pointerdown', (e) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  containerEl.addEventListener('pointerup', () => isDragging = false);
  containerEl.addEventListener('pointermove', (e) => {
    if(!isDragging) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX; prevY = e.clientY;
    const rotY = dx * 0.01;
    const rotX = dy * 0.01;
    camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), rotY);
    camera.position.applyAxisAngle(new THREE.Vector3(1,0,0), rotX);
    camera.lookAt(0,0,0);
  });
  containerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY * 0.01;
    camera.position.multiplyScalar(1 + delta);
    camera.lookAt(0,0,0);
  }, { passive: false });

  window.addEventListener('resize', function(){
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  (function animate(){ requestAnimationFrame(animate); renderer.render(scene, camera); })();
}

export function parseGcodeLines(gcodeText){
  const lines = gcodeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const path = [];
  let x = 0, y = 0, z = 0;
  for (const line of lines) {
    if (/^(G0|G1)/i.test(line)) {
      const nx = /X([-0-9.]+)/i.test(line) ? parseFloat(RegExp.$1) : x;
      const ny = /Y([-0-9.]+)/i.test(line) ? parseFloat(RegExp.$1) : y;
      const nz = /Z([-0-9.]+)/i.test(line) ? parseFloat(RegExp.$1) : z;
      x = nx; y = ny; z = nz;
      path.push({x, y, z});
    }
  }
  return path;
}

export function renderGcodePreview(gcodeText, options = {}){
  if(!pathGroup) {
    console.warn('simulation3d: call initSimulation() first');
    return;
  }
  clearSimulation();
  const paths = [];
  const lines = gcodeText.split(/\r?\n/);
  let currentPts = [];
  let penDown = false;
  let lastPos = {x:0,y:0,z:0};

  function pushCurrent(){
    if(currentPts.length>0){
      paths.push({points: currentPts.slice(), penDown});
      currentPts = [];
    }
  }

  for(const raw of lines){
    const line = raw.trim();
    if(!line) continue;
    if(/^\s*;/i.test(line) || /^\s*\(/.test(line)) continue;
    if(/^M30/i.test(line)) break;
    const moveMatch = line.match(/^(G0|G1)\s*(.*)/i);
    if(moveMatch){
      const params = moveMatch[2];
      const nx = /X([-0-9.]+)/i.test(params) ? parseFloat(RegExp.$1) : lastPos.x;
      const ny = /Y([-0-9.]+)/i.test(params) ? parseFloat(RegExp.$1) : lastPos.y;
      const nz = /Z([-0-9.]+)/i.test(params) ? parseFloat(RegExp.$1) : lastPos.z;
      const lowered = (nz < lastPos.z - 0.0001);
      if(lowered && !penDown){
        penDown = true;
        currentPts.push(new THREE.Vector3(nx, nz * currentScaleZ, ny));
      } else if(!lowered && penDown && Math.abs(nz - lastPos.z) > 0.0001){
        currentPts.push(new THREE.Vector3(nx, nz * currentScaleZ, ny));
        pushCurrent();
        penDown = false;
      } else {
        currentPts.push(new THREE.Vector3(nx, nz * currentScaleZ, ny));
      }
      lastPos = {x:nx,y:ny,z:nz};
    } else if(/^M3/i.test(line) || /^M4/i.test(line)){
      penDown = true;
    } else if(/^M5/i.test(line)){
      penDown = false;
      pushCurrent();
    }
  }
  pushCurrent();

  paths.forEach((p,i)=>{
    if(p.points.length<2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(p.points);
    const mat = new THREE.LineBasicMaterial({ linewidth: 2, color: p.penDown ? 0xff0000 : 0x0000ff });
    const line = new THREE.Line(geometry, mat);
    pathGroup.add(line);
  });

  if(pathGroup.children.length>0){
    const bbox = new THREE.Box3().setFromObject(pathGroup);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z, 1);
    camera.position.set(center.x + maxSize, center.y + maxSize, center.z + maxSize);
    camera.lookAt(center);
  }
}

export function clearSimulation(){
  if(!pathGroup) return;
  while(pathGroup.children.length>0){
    const ch = pathGroup.children[0];
    pathGroup.remove(ch);
    if(ch.geometry) ch.geometry.dispose();
    if(ch.material) {
      if(Array.isArray(ch.material)){
        ch.material.forEach(m=>m.dispose());
      } else ch.material.dispose();
    }
  }
}

export function setScaleZ(s){ currentScaleZ = s || 1; }
