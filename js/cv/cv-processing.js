// cv-processing.js - Improved OpenCV processing module (ES Module)
// Exports:
//  - initCV()
//  - cvReady (boolean)
//  - loadImageToMat(imgElement)
//  - detectEdges(srcMat, method='Canny', sensitivity=50)
//  - applyColormap(srcMat, mapName='Jet')
//  - renderMatToCanvas(mat, canvas)
//  - generateHeightMap(mat, options)
//  - cleanupCV()

import { memoryManager } from '../core/memoryManager.js';
import { taskManager } from '../core/taskManager.js';

export let cvReady = false;

/**
 * initCV - waits for OpenCV runtime to be ready.
 * Resolves when cv.Mat is available or rejects after timeout.
 */
export function initCV(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      cvReady = true;
      console.log('[cv-processing] OpenCV already ready.');
      return resolve(true);
    }
    const start = Date.now();
    const check = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(check);
        cvReady = true;
        console.log('[cv-processing] OpenCV runtime initialized.');
        return resolve(true);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        console.warn('[cv-processing] OpenCV not found within timeout.');
        return reject(new Error('OpenCV not found'));
      }
    }, 200);
  });
}

/**
 * loadImageToMat - loads an HTMLImageElement or canvas into a cv.Mat (RGBA)
 */
export function loadImageToMat(imgEl) {
  if (!cvReady) throw new Error('OpenCV not ready');
  try {
    const mat = cv.imread(imgEl); // reads from <img> or <canvas>
    // ensure 4 channels (RGBA)
    let out = new cv.Mat();
    if (mat.type() !== cv.CV_8UC4) {
      cv.cvtColor(mat, out, cv.COLOR_RGBA2RGBA); // safe copy
      memoryManager.track(mat);
    } else {
      out = mat;
    }
    memoryManager.track(out);
    return out;
  } catch (e) {
    console.error('[cv-processing] loadImageToMat error', e);
    throw e;
  }
}

/**
 * detectEdges - returns a binary or gray Mat of edges using method.
 * method: 'Canny' | 'Sobel' | 'Laplace'
 * sensitivity: numeric - used as threshold / scale
 */
export function detectEdges(srcMat, method='Canny', sensitivity=50) {
  if (!cvReady) throw new Error('OpenCV not ready');
  if (!srcMat) throw new Error('srcMat is required');
  try {
    const gray = new cv.Mat();
    if (srcMat.channels && srcMat.channels() && srcMat.channels() === 4) {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    } else {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    }
    memoryManager.track(gray);

    const edges = new cv.Mat();
    const sens = Math.max(1, Math.min(500, Number(sensitivity) || 50));

    if (method === 'Sobel') {
      // Sobel produces gradient; convert to absolute
      const grad = new cv.Mat();
      const gradX = new cv.Mat();
      const gradY = new cv.Mat();
      cv.Sobel(gray, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
      cv.Sobel(gray, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
      cv.convertScaleAbs(gradX, gradX);
      cv.convertScaleAbs(gradY, gradY);
      cv.addWeighted(gradX, 0.5, gradY, 0.5, 0, grad);
      cv.threshold(grad, edges, sens, 255, cv.THRESH_BINARY);
      memoryManager.track(grad); memoryManager.track(gradX); memoryManager.track(gradY);
    } else if (method === 'Laplace') {
      cv.Laplacian(gray, edges, cv.CV_16S, 3, 1, 0, cv.BORDER_DEFAULT);
      cv.convertScaleAbs(edges, edges);
      cv.threshold(edges, edges, sens, 255, cv.THRESH_BINARY);
    } else {
      // Canny - use sens and sens*2 as thresholds
      cv.Canny(gray, edges, sens, sens * 2, 3, false);
    }
    memoryManager.track(edges);
    return edges;
  } catch (e) {
    console.error('[cv-processing] detectEdges error', e);
    throw e;
  }
}

/**
 * applyColormap - expects a single channel or gray Mat; returns colored Mat (CV_8UC3)
 * mapName: 'Jet' | 'Hot' | 'Cool' | 'Gray'
 */
export function applyColormap(srcMat, mapName='Jet') {
  if (!cvReady) throw new Error('OpenCV not ready');
  try {
    // ensure single channel 8-bit
    let gray = new cv.Mat();
    if (srcMat.type() === cv.CV_8UC4) {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    } else if (srcMat.type() === cv.CV_8UC3) {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    } else {
      gray = srcMat.clone();
    }
    memoryManager.track(gray);

    const dst = new cv.Mat();
    let mapId = cv.COLORMAP_JET;
    const name = (mapName || 'Jet').toLowerCase();
    if (name === 'hot') mapId = cv.COLORMAP_HOT;
    else if (name === 'cool') mapId = cv.COLORMAP_OCEAN || cv.COLORMAP_COOL;
    else if (name === 'gray') mapId = cv.COLORMAP_BONE;
    // applyColorMap expects CV_8UC1 gray input and outputs CV_8UC3
    cv.applyColorMap(gray, dst, mapId);
    memoryManager.track(dst);
    return dst;
  } catch (e) {
    console.error('[cv-processing] applyColormap error', e);
    throw e;
  }
}

/**
 * renderMatToCanvas - renders a Mat to an HTMLCanvasElement (by id or element)
 */
export function renderMatToCanvas(mat, canvasOrId) {
  if (!cvReady) throw new Error('OpenCV not ready');
  try {
    let canvasEl = null;
    if (typeof canvasOrId === 'string') canvasEl = document.getElementById(canvasOrId);
    else canvasEl = canvasOrId;
    if (!canvasEl) throw new Error('Canvas element not found');
    cv.imshow(canvasEl, mat);
  } catch (e) {
    console.error('[cv-processing] renderMatToCanvas error', e);
    throw e;
  }
}

/**
 * generateHeightMap - convert a gray or colored Mat to a Float32Array heightmap normalized to [0,1]
 * options: { invert: boolean, normalize: boolean }
 */
export function generateHeightMap(srcMat, options = {}) {
  if (!cvReady) throw new Error('OpenCV not ready');
  try {
    const { invert=false, normalize=true } = options;
    const gray = new cv.Mat();
    if (srcMat.type() === cv.CV_8UC4) {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    } else if (srcMat.type() === cv.CV_8UC3) {
      cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
    } else {
      gray = srcMat.clone();
    }
    memoryManager.track(gray);

    const width = gray.cols, height = gray.rows;
    const result = new Float32Array(width * height);
    for (let y=0; y<height; y++){
      for (let x=0; x<width; x++){
        const v = gray.ucharPtr(y, x)[0] / 255.0;
        result[y * width + x] = invert ? 1.0 - v : v;
      }
    }
    if (normalize) {
      // ensure min 0 max 1
      let min=1, max=0;
      for (let i=0;i<result.length;i++){ if(result[i]<min)min=result[i]; if(result[i]>max)max=result[i]; }
      const range = Math.max(1e-6, max - min);
      for (let i=0;i<result.length;i++){ result[i] = (result[i]-min)/range; }
    }
    return { data: result, width, height };
  } catch (e) {
    console.error('[cv-processing] generateHeightMap error', e);
    throw e;
  }
}

/**
 * cleanupCV - delete tracked mats
 */
export function cleanupCV() {
  try {
    memoryManager.cleanup();
    console.log('[cv-processing] cleaned up tracked Mats');
  } catch (e) {
    console.warn('[cv-processing] cleanup error', e);
  }
}
