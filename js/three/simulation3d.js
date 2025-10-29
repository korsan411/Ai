/* CncAi — simulation3d.js
   محاكاة G-code في بيئة ثلاثية الأبعاد
*/

(function() {
  window.CncAi = window.CncAi || {};
  const dbg = window.CncAi.debug;
  let scene, camera, renderer, pathLine;

  function init3D(containerId = "threeContainer") {
    const container = document.getElementById(containerId);
    const w = container.clientWidth;
    const h = container.clientHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    camera.position.set(0, -150, 150);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 0, 200);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x101214);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    animate();
    dbg.info("🎥 تم تهيئة محاكاة 3D");
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function drawGcodePath(gcodeText) {
    if (!gcodeText) return;
    const lines = gcodeText.split("\n");
    const points = [];
    let x = 0, y = 0, z = 0;
    lines.forEach(line => {
      if (line.startsWith("G1")) {
        const xMatch = line.match(/X([\d.-]+)/);
        const yMatch = line.match(/Y([\d.-]+)/);
        const zMatch = line.match(/Z([\d.-]+)/);
        if (xMatch) x = parseFloat(xMatch[1]);
        if (yMatch) y = parseFloat(yMatch[1]);
        if (zMatch) z = parseFloat(zMatch[1]);
        points.push(new THREE.Vector3(x, y, z));
      }
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    const line = new THREE.Line(geometry, material);
    if (pathLine) scene.remove(pathLine);
    pathLine = line;
    scene.add(line);
    dbg.info("🧭 تم رسم مسار G-code في 3D");
  }

  function rotateScene(angle = 0.02) {
    if (scene) scene.rotation.z += angle;
  }

  // ✅ واجهة عامة
  window.CncAi.sim3D = {
    init3D,
    drawGcodePath,
    rotateScene
  };
})();
