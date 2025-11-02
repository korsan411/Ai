
// ================= متغيرات عامة =================
let cvReady = false;
let grayMat = null;
let contour = null;
let previewCanvas = null;
let additionalContours = []; // {contour, area}
let lastScanDir = 'x';
let lastGeneratedGcode = '';
let isProcessing = false;

// colormap current
let currentColormap = 'jet';
let edgeSensitivityTimer = null;

// Simulation / Three
let scene, camera, renderer, controls;
let simulation = { 
  isPlaying: false, 
  animationFrame: null, 
  tool: null, 
  toolPath: null, 
  pathPoints: [], 
  index: 0, 
  speed: 1,
  elapsedTime: 0
};

// ================= متغيرات إضافية للثلاثي الأبعاد =================
let threeDModel = null;
let threeDScene = null;
let threeDRenderer = null;
let threeDCamera = null;
let threeDControls = null;