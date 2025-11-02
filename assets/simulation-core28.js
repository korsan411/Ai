// ================= Simulation 3D & Controls - الإصدار المحسن =================

// إضافة تحقق من تحميل المكتبات
function checkThreeJSLoaded() {
  if (typeof THREE === 'undefined') {
    throw new Error('THREE.js غير محمل');
  }
  
  // التحقق من OrbitControls
  if (typeof THREE.OrbitControls === 'undefined') {
    console.warn('OrbitControls غير محمل - ستعمل المحاكاة بدون تحكم بالكاميرا');
  }
  
  return true;
}

function parseGcodeForSimulation(gcode) {
  if (!gcode || gcode.length === 0) return [];
  
  try {
    const lines = gcode.split('\n');
    const path = [];
    let pos = { x: 0, y: 0, z: 0 };
    let pointCount = 0;
    const maxPoints = 1500; // تقليل الحد الأقصى للأداء
    
    for (let line of lines) {
      if (pointCount >= maxPoints) break;
      
      line = line.trim();
      if (!line || line.startsWith(';')) continue;
      
      if (line.startsWith('G0') || line.startsWith('G1')) {
        const xm = line.match(/X([-\d.]+)/i);
        const ym = line.match(/Y([-\d.]+)/i);
        const zm = line.match(/Z([-\d.]+)/i);
        
        if (xm) pos.x = parseFloat(xm[1]) || pos.x;
        if (ym) pos.y = parseFloat(ym[1]) || pos.y;
        if (zm) pos.z = parseFloat(zm[1]) || pos.z;
        
        // أخذ عينات أقل للتحسين
        if (pointCount % 8 === 0) {
          path.push({ x: pos.x, y: pos.y, z: pos.z });
        }
        pointCount++;
      }
    }
    
    return path;
  } catch (error) {
    console.error('خطأ في تحليل G-code للمحاكاة:', error);
    return [];
  }
}

function createToolPathVisualization(pathPoints, dir) {
  if (!pathPoints || pathPoints.length < 2) return null;
  
  try {
    const points = pathPoints.map(p => new THREE.Vector3(p.x / 10, -p.z, p.y / 10));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    let color = 0x10b981; // x
    if (dir === 'y') color = 0x3b82f6;
    if (dir === 'contour') color = 0xf59e0b;
    if (dir === 'laser') color = 0xff4444;
    if (dir === 'threed') color = 0x10b981;
    const material = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geometry, material);
    return line;
  } catch (error) {
    console.error('فشل في إنشاء تصور مسار الأداة:', error);
    return null;
  }
}

// دالة مساعدة لتنظيف المحاكاة
function cleanupSimulation() {
  try {
    simulation.isPlaying = false;
    if (simulation.animationFrame) {
      cancelAnimationFrame(simulation.animationFrame);
      simulation.animationFrame = null;
    }
    
    simulation.index = 0;
    simulation.pathPoints = [];
    
    if (controls) {
      controls.dispose();
      controls = null;
    }
    
    if (renderer) {
      try {
        const container = document.getElementById('threeContainer');
        if (container && renderer.domElement && renderer.domElement.parentNode) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
        renderer = null;
      } catch (e) {
        console.warn('خطأ في التخلص من العارض:', e);
      }
    }
    
    scene = null;
    camera = null;
    simulation.tool = null;
    simulation.toolPath = null;
  } catch (error) {
    console.error('فشل في تنظيف المحاكاة:', error);
  }
}

// Simulation controls UI will be created inside the three container
function addSimulationControls(container) {
  try {
    const old = container.querySelector('.sim-controls');
    if (old) old.remove();
    const oldInfo = container.querySelector('.sim-progress');
    if (oldInfo) oldInfo.remove();

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'sim-controls';
    controlsDiv.innerHTML = `
      <button id="simPlay">▶</button><button id="simPause">⏸</button><button id="simReset">⏮</button>
      <label style="color:#cfeaf2;font-size:12px;margin-right:6px">سرعة</label>
      <input id="simSpeed" type="range" min="0.2" max="3" step="0.1" value="${simulation.speed}" style="width:120px">
      <span id="simSpeedLabel" style="min-width:36px;text-align:center">${simulation.speed.toFixed(1)}x</span>
    `;
    container.appendChild(controlsDiv);

    const prog = document.createElement('div');
    prog.className = 'sim-progress';
    prog.innerHTML = `الحالة: <span id="simStatus">جاهز</span> — تقدم: <span id="simProgress">0%</span>`;
    container.appendChild(prog);

    // Events
    const simPlay = document.getElementById('simPlay');
    const simPause = document.getElementById('simPause');
    const simReset = document.getElementById('simReset');
    const simSpeed = document.getElementById('simSpeed');
    const simSpeedLabel = document.getElementById('simSpeedLabel');

    if (simPlay) {
      simPlay.addEventListener('click', () => {
        if (!simulation.pathPoints || simulation.pathPoints.length === 0) return;
        if (!simulation.isPlaying) {
          simulation.isPlaying = true;
          animateSimPath();
          const status = document.getElementById('simStatus');
          if (status) status.textContent = 'جاري التشغيل';
          showToast('بدأت المحاكاة');
        }
      });
    }

    if (simPause) {
      simPause.addEventListener('click', () => {
        if (simulation.isPlaying) {
          simulation.isPlaying = false;
          cancelAnimationFrame(simulation.animationFrame);
          const status = document.getElementById('simStatus');
          if (status) status.textContent = 'متوقف';
          showToast('أقفلت المحاكاة مؤقتاً');
        }
      });
    }

    if (simReset) {
      simReset.addEventListener('click', () => {
        simulation.isPlaying = false;
        cancelAnimationFrame(simulation.animationFrame);
        simulation.index = 0;
        simulation.elapsedTime = 0;
        updateToolPosition(0);
        const progress = document.getElementById('simProgress');
        const status = document.getElementById('simStatus');
        if (progress) progress.textContent = '0%';
        if (status) status.textContent = 'جاهز';
        showToast('تم إعادة المحاكاة');
      });
    }

    if (simSpeed && simSpeedLabel) {
      simSpeed.addEventListener('input', (e) => {
        simulation.speed = parseFloat(e.target.value);
        simSpeedLabel.textContent = simulation.speed.toFixed(1) + 'x';
      });
    }
  } catch (error) {
    console.error('فشل في إضافة عناصر تحكم المحاكاة:', error);
  }
}

function animateSimPath() {
  if (!simulation.pathPoints || simulation.pathPoints.length === 0) return;
  
  function step() {
    if (!simulation.isPlaying) return;
    
    simulation.index += simulation.speed;
    if (simulation.index >= simulation.pathPoints.length) {
      simulation.index = simulation.pathPoints.length - 1;
      updateToolPosition(simulation.index);
      const progress = document.getElementById('simProgress');
      const status = document.getElementById('simStatus');
      if (progress) progress.textContent = '100%';
      if (status) status.textContent = 'مكتمل';
      simulation.isPlaying = false;
      cancelAnimationFrame(simulation.animationFrame);
      showToast('اكتملت المحاكاة');
      return;
    }
    
    updateToolPosition(simulation.index);
    const prog = ((Math.floor(simulation.index) + 1) / simulation.pathPoints.length) * 100;
    const progress = document.getElementById('simProgress');
    if (progress) progress.textContent = prog.toFixed(1) + '%';
    
    simulation.animationFrame = requestAnimationFrame(step);
  }
  
  if (!simulation.animationFrame) {
    step();
  }
}

function updateToolPosition(index) {
  if (!simulation.tool || !simulation.pathPoints || simulation.pathPoints.length === 0) return;
  
  try {
    const i = Math.floor(index);
    const p = simulation.pathPoints[i];
    if (!p) return;
    
    simulation.tool.position.set(p.x / 10, -p.z, p.y / 10);
  } catch (error) {
    console.warn('فشل في تحديث موضع الأداة:', error);
  }
}

function initSimulation() {
  const container = document.getElementById('threeContainer');
  if (!container) return;
  
  // التحقق من تحميل المكتبات
  if (!checkThreeJSLoaded()) {
    showToast('المكتبات ثلاثية الأبعاد غير جاهزة. جاري المحاولة مرة أخرى...');
    setTimeout(initSimulation, 1000);
    return;
  }
  
  // تنظيف المحاكاة السابقة بشكل كامل
  cleanupSimulation();
  
  const placeholder = document.getElementById('simulationPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  try {
    const gcode = document.getElementById('gcodeOut').value;
    if (!gcode || gcode.trim().length === 0) {
      showToast('لا يوجد G-code للمحاكاة');
      if (placeholder) placeholder.style.display = 'flex';
      return;
    }

    // إنشاء المشهد
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081224);

    const containerW = container.clientWidth || 800;
    const containerH = container.clientHeight || 400;
    
    camera = new THREE.PerspectiveCamera(60, containerW / containerH, 0.1, 2000);
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      preserveDrawingBuffer: true
    });
    renderer.setSize(containerW, containerH);
    container.appendChild(renderer.domElement);

    // استخدام OrbitControls إذا كان متاحاً
    if (typeof THREE.OrbitControls !== 'undefined') {
      try {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.screenSpacePanning = true;
      } catch (e) {
        console.warn('فشل في تهيئة OrbitControls:', e);
      }
    }

    // إضاءة مبسطة
    const ambient = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambient);

    const machineType = document.getElementById('machineCategory').value;
    const isLaser = machineType === 'laser';
    const is3D = machineType === 'threed';
    
    // منصة مبسطة
    const workWidth = is3D ? 
      cmToMm(parseFloat(document.getElementById('threedWorkWidth').value) || 30) / 10 :
      (isLaser ? 
        cmToMm(parseFloat(document.getElementById('laserWorkWidth').value) || 30) / 10 :
        cmToMm(parseFloat(document.getElementById('workWidth').value) || 30) / 10);
    const workHeight = is3D ?
      cmToMm(parseFloat(document.getElementById('threedWorkHeight').value) || 20) / 10 :
      (isLaser ?
        cmToMm(parseFloat(document.getElementById('laserWorkHeight').value) || 20) / 10 :
        cmToMm(parseFloat(document.getElementById('workHeight').value) || 20) / 10);
    
    let platformColor;
    if (is3D) platformColor = 0x444444;
    else if (isLaser) platformColor = 0x666666;
    else platformColor = 0x8B4513;
    
    const platformGeometry = new THREE.BoxGeometry(workWidth, 0.5, workHeight);
    const platformMaterial = new THREE.MeshPhongMaterial({ 
      color: platformColor 
    });
    const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    platformMesh.position.set(workWidth/2, -0.25, workHeight/2);
    scene.add(platformMesh);

    // مسار مبسط
    const pathPoints = parseGcodeForSimulation(gcode);
    
    // إذا كان المسار كبير جداً، نخففه أكثر
    if (pathPoints.length > 2000) {
      const simplifiedPoints = [];
      for (let i = 0; i < pathPoints.length; i += 10) {
        simplifiedPoints.push(pathPoints[i]);
      }
      simulation.pathPoints = simplifiedPoints;
      showToast('تم تبسيط المسار إلى ' + simplifiedPoints.length + ' نقطة');
    } else {
      simulation.pathPoints = pathPoints;
    }

    // إنشاء مسار مرئي مبسط
    if (simulation.pathPoints.length > 1) {
      let pathType = lastScanDir;
      if (is3D) pathType = 'threed';
      else if (isLaser) pathType = 'laser';
      
      simulation.toolPath = createToolPathVisualization(simulation.pathPoints, pathType);
      if (simulation.toolPath) {
        scene.add(simulation.toolPath);
      }
    }

    // أداة مبسطة
    if (is3D) {
      simulation.tool = create3DPrinterToolModel();
    } else if (isLaser) {
      simulation.tool = createLaserToolModel();
    } else {
      simulation.tool = createToolModel();
    }
    
    if (simulation.tool) {
      scene.add(simulation.tool);
    }

    // شبكة مساعدة
    const gridHelper = new THREE.GridHelper(Math.max(workWidth, workHeight), 10);
    gridHelper.position.set(workWidth/2, 0, workHeight/2);
    scene.add(gridHelper);

    // إعدادات المحاكاة
    simulation.index = 0;
    simulation.isPlaying = false;
    simulation.animationFrame = null;

    // عناصر تحكم مبسطة
    addSimulationControls(container);

    // حلقة التصيير
    (function renderLoop() {
      requestAnimationFrame(renderLoop);
      if (controls) controls.update();
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    })();

    showToast('تم تهيئة المحاكاة: ' + simulation.pathPoints.length + ' نقطة');

  } catch (error) {
    console.error('خطأ في تهيئة المحاكاة:', error);
    showToast('فشل في تهيئة المحاكاة');
    if (placeholder) placeholder.style.display = 'flex';
  }
}