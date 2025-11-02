// ================= النظام ثلاثي الأبعاد المنفصل =================
(function(){
  try {
    if (window._threeDViewerAdded) return;
    window._threeDViewerAdded = true;

    const container = document.getElementById('threeDContainer');
    const canvas = document.getElementById('canvas3D');
    if (!container || !canvas) {
      console.warn('ThreeD container or canvas not found. Aborting 3D viewer init.');
      return;
    }
    container.style.display = 'block';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    let _scene, _camera, _renderer, _controls, _modelGroup;
    let _animReq = null;

    function initThreeDViewer() {
      try {
        if (window._threeDViewerInit) return;
        window._threeDViewerInit = true;

        _renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        _renderer.setSize(container.clientWidth, container.clientHeight, false);
        _renderer.outputEncoding = THREE.sRGBEncoding;

        _scene = new THREE.Scene();
        _scene.background = new THREE.Color(0x081224);
        const aspect = container.clientWidth / Math.max(1, container.clientHeight);
        _camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        _camera.position.set(0, 80, 120);

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemi.position.set(0, 200, 0);
        _scene.add(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(0, 200, 100);
        _scene.add(dir);

        const grid = new THREE.GridHelper(200, 40, 0x1a2b3a, 0x0b1624);
        grid.position.y = -0.01;
        _scene.add(grid);

        const axes = new THREE.AxesHelper(40);
        axes.material.depthTest = false;
        axes.renderOrder = 2;
        _scene.add(axes);

        _modelGroup = new THREE.Group();
        _scene.add(_modelGroup);

        _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true;
        _controls.dampingFactor = 0.12;
        _controls.screenSpacePanning = false;
        _controls.minDistance = 10;
        _controls.maxDistance = 1000;

        window.addEventListener('resize', onWindowResize);
        animate();
        showToast('معاينة 3D جاهزة', 1200);
      } catch (e) {
        console.error('Failed to init ThreeD viewer', e);
        showToast('فشل تهيئة معاينة 3D', 4000);
      }
    }

    function onWindowResize() {
      try {
        if (!_camera || !_renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        _camera.aspect = w / Math.max(1, h);
        _camera.updateProjectionMatrix();
        _renderer.setSize(w, h, false);
      } catch (e) { console.warn(e); }
    }

    function clearModel() {
      try {
        if (!_modelGroup) return;
        _modelGroup.traverse(obj => {
          if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose && m.dispose(); });
              } else {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose && obj.material.dispose();
              }
            }
          }
        });
        while (_modelGroup.children.length) _modelGroup.remove(_modelGroup.children[0]);
      } catch (e) { console.warn('Failed to clear 3D model', e); }
    }

    function fitCameraToObject(object, offset) {
      try {
        offset = offset || 1.25;
        const box = new THREE.Box3().setFromObject(object);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          const fitDistance = maxSize / (2 * Math.tan(Math.PI * _camera.fov / 360));
          const distance = fitDistance * offset;
          _camera.position.set(center.x, center.y + distance*0.3, center.z + distance);
          _camera.lookAt(center);
          _controls.target.copy(center);
          _controls.update();
        }
      } catch(e){ console.warn(e); }
    }

    const stlLoader = new THREE.STLLoader();
    const objLoader = new THREE.OBJLoader();

    function load3DModel(file) {
      return new Promise((resolve, reject) => {
        try {
          if (!file) return reject(new Error('No file'));
          initThreeDViewer();
          const name = file.name.toLowerCase();
          showProgress('جاري تحميل الملف: ' + file.name);
          const reader = new FileReader();
          reader.onerror = function(err) {
            hideProgress();
            showToast('فشل قراءة الملف', 3000);
            reject(err);
          };
          reader.onload = function(e) {
            try {
              const contents = e.target.result;
              clearModel();
              if (name.endsWith('.stl')) {
                const geometry = stlLoader.parse(contents);
                const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.2, roughness: 0.6 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = mesh.receiveShadow = true;
                _modelGroup.add(mesh);
                fitCameraToObject(mesh);
                hideProgress();
                showToast('تم تحميل STL بنجاح', 1800);
                resolve(mesh);
              } else if (name.endsWith('.obj')) {
                const object = objLoader.parse(contents);
                object.traverse(child => {
                  if (child.isMesh) {
                    child.material = child.material || new THREE.MeshStandardMaterial({ color: 0xcccccc });
                    child.castShadow = child.receiveShadow = true;
                  }
                });
                _modelGroup.add(object);
                fitCameraToObject(object);
                hideProgress();
                showToast('تم تحميل OBJ بنجاح', 1800);
                resolve(object);
              } else {
                hideProgress();
                showToast('نوع الملف غير مدعوم: STL أو OBJ فقط', 4000);
                reject(new Error('Unsupported'));
              }
            } catch(err) {
              hideProgress();
              console.error('parse error', err);
              showToast('فشل في معالجة النموذج 3D', 4000);
              reject(err);
            }
          };
          reader.readAsArrayBuffer(file);
        } catch(err) {
          hideProgress();
          console.error('load3DModel error', err);
          showToast('خطأ أثناء تحميل الملف', 4000);
          reject(err);
        }
      });
    }

    function animate() {
      try {
        _animReq = requestAnimationFrame(animate);
        if (_controls) _controls.update();
        if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
      } catch(e){ console.warn('animate err', e); }
    }

    function hookFileButtons() {
      try {
        const fileBtns = document.querySelectorAll('#fileFormatButtons button[data-format]');
        fileBtns.forEach(btn => {
          btn.addEventListener('click', (ev) => {
            try {
              const format = btn.getAttribute('data-format');
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = (format === 'stl' ? '.stl' : (format === 'obj' ? '.obj' : '.svg,.dxf'));
              input.onchange = async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
                  showToast('اختر ملف STL أو OBJ للمعاينة ثلاثية الأبعاد', 3500);
                  return;
                }
                try { await load3DModel(f); } catch(err){ console.error(err); }
              };
              input.click();
            } catch(e){ console.error(e); }
          });
        });

        const threedInput = document.getElementById('threedFileInput');
        if (threedInput) {
          threedInput.addEventListener('change', async (ev) => {
            try {
              const f = ev.target.files && ev.target.files[0];
              if (!f) return;
              if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
                showToast('اختر ملف STL أو OBJ', 3500);
                return;
              }
              await load3DModel(f);
            } catch(err){ console.error('threed load failed', err); }
          });
        }

        container.addEventListener('dragover', ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
        container.addEventListener('drop', async (ev) => {
          try {
            ev.preventDefault();
            const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
            if (!f) return;
            if (!f.name.toLowerCase().match(/\.(stl|obj)$/)) {
              showToast('اسحب ملف STL أو OBJ فقط', 3500);
              return;
            }
            await load3DModel(f);
          } catch(err){ console.error('drop error', err); }
        });
      } catch(e){ console.error('hookFileButtons failed', e); }
    }

    hookFileButtons();

    const threedTabBtn = Array.from(document.querySelectorAll('.tab-buttons button')).find(b => b.dataset.tab === 'threed');
    if (threedTabBtn) {
      threedTabBtn.addEventListener('click', () => {
        try {
          setTimeout(() => { initThreeDViewer(); onWindowResize(); }, 120);
        } catch(e){ console.error(e); }
      });
    }

    if (document.getElementById('threed') && document.getElementById('threed').classList.contains('active')) {
      setTimeout(() => { initThreeDViewer(); onWindowResize(); }, 200);
    }

    window.load3DModel = load3DModel;
    window.initThreeDViewer = initThreeDViewer;

  } catch(err) { console.error('ThreeD module failed', err); }
})();