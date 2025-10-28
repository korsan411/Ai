// gcode-generator.js - Advanced G-code generation module (ES Module)
// Exports:
//  - generateRasterGcode(input, settings)    // input: ImageData-like {width, height, data} or {data: Float32Array, width, height}
//  - generateContourGcode(contours, settings) // contours: array of arrays [{x,y},...]
//  - generateLaserGcode(input, settings)     // similar input to raster, outputs laser S values
//  - parseGcodeLines(gcodeText)
//  - analyzeGcode(gcodeText) -> basic stats

import { taskManager } from '../core/taskManager.js';
import { memoryManager } from '../core/memoryManager.js';
import { clamp } from '../helpers/validators.js';

/**
 * Helper: map intensity (0..1) to Z between minZ and maxZ
 */
function mapIntensityToZFloat(v, minZ, maxZ, invert=false){
  let vv = Math.max(0, Math.min(1, Number(v) || 0));
  if(invert) vv = 1 - vv;
  return minZ + vv * (maxZ - minZ);
}

/**
 * Normalize input to an object with width,height and getIntensity(x,y) function
 * Accepts:
 *  - ImageData-like {width,height,data Uint8ClampedArray RGBA}
 *  - Heightmap-like {data: Float32Array, width, height} values in [0,1]
 */
function makeIntensityAccessor(input){
  if(!input) throw new Error('No input provided to G-code generator');
  if(input.data && input.data.constructor && input.data.constructor.name === 'Float32Array'){
    const {data, width, height} = input;
    return {
      width, height,
      getIntensity: (x,y)=> data[y*width + x]
    };
  }
  // assume ImageData-like RGBA
  if(input.data && input.width && input.height){
    const {data, width, height} = input;
    return {
      width, height,
      getIntensity: (x,y) => {
        const idx = (y*width + x)*4;
        // use luminance from RGB (or R if grayscale)
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        // convert to luminance
        return (0.299*r + 0.587*g + 0.114*b) / 255.0;
      }
    };
  }
  throw new Error('Unsupported input type for G-code generation');
}

/**
 * generateRasterGcode - generates raster-style G-code from image or heightmap
 * settings:
 *  - pixelSize (mm per pixel)
 *  - feedRate
 *  - safeZ
 *  - minZ, maxZ
 *  - invertZ
 *  - serpentine (true/false) default true
 *  - decimalPlaces
 */
export function generateRasterGcode(input, settings = {}){
  const cfg = Object.assign({
    pixelSize: 0.5,
    feedRate: 800,
    safeZ: 5,
    minZ: 0,
    maxZ: -2,
    invertZ: false,
    serpentine: true,
    decimalPlaces: 3,
    header: ['G21','G90'],
    footer: ['G0 Z{safeZ}','G0 X0 Y0','M30']
  }, settings);

  const accessor = makeIntensityAccessor(input);
  const w = accessor.width, h = accessor.height;
  const fmt = (n)=> Number(n).toFixed(cfg.decimalPlaces);

  const lines = [];
  lines.push(...cfg.header);
  lines.push(`F${cfg.feedRate}`);
  lines.push(`G0 Z${fmt(cfg.safeZ)}`);

  for(let y=0;y<h;y++){
    const leftToRight = (!cfg.serpentine) ? true : (y%2===0);
    const xs = leftToRight ? [0, w, 1] : [w-1, -1, -1];
    // move to line start
    const startX = xs[0], endX = xs[1];
    const startY = y;
    const startPosX = startX * cfg.pixelSize;
    const startPosY = startY * cfg.pixelSize;
    lines.push(`G0 X${fmt(startPosX)} Y${fmt(startPosY)} Z${fmt(cfg.safeZ)}`);
    for(let x = startX; x !== endX; x += xs[2]){
      const intensity = accessor.getIntensity(x,y); // 0..1
      const z = mapIntensityToZFloat(intensity, cfg.minZ, cfg.maxZ, cfg.invertZ);
      const posX = x * cfg.pixelSize;
      const posY = y * cfg.pixelSize;
      lines.push(`G1 X${fmt(posX)} Y${fmt(posY)} Z${fmt(z)}`);
    }
    lines.push(`G0 Z${fmt(cfg.safeZ)}`);
  }

  // footer resolution
  for(const f of cfg.footer){
    lines.push(f.replace('{safeZ}', fmt(cfg.safeZ)));
  }
  return lines.join('\n');
}

/**
 * generateContourGcode - receives contours array (array of arrays of points {x,y})
 * settings:
 *  - feedRate, safeZ, cutZ, passes, scale, offsetX, offsetY, closePath
 */
export function generateContourGcode(contours, settings = {}){
  const cfg = Object.assign({
    feedRate: 400,
    safeZ: 5,
    cutZ: -2,
    passes: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    closePath: true,
    decimalPlaces: 3,
    header: ['G21','G90'],
    footer: ['G0 Z{safeZ}','G0 X0 Y0','M30']
  }, settings);

  const fmt = (n)=> Number(n).toFixed(cfg.decimalPlaces);
  const lines = [];
  lines.push(...cfg.header);
  lines.push(`F${cfg.feedRate}`);
  lines.push(`G0 Z${fmt(cfg.safeZ)}`);

  contours.forEach((cont, idx) => {
    if(!cont || cont.length===0) return;
    // Move to first point
    const p0 = cont[0];
    lines.push(`G0 X${fmt(p0.x*cfg.scale + cfg.offsetX)} Y${fmt(p0.y*cfg.scale + cfg.offsetY)} Z${fmt(cfg.safeZ)}`);
    for(let pass=0; pass<cfg.passes; pass++){
      lines.push(`G1 Z${fmt(cfg.cutZ)}`);
      for(let i=1;i<cont.length;i++){
        const p = cont[i];
        lines.push(`G1 X${fmt(p.x*cfg.scale + cfg.offsetX)} Y${fmt(p.y*cfg.scale + cfg.offsetY)}`);
      }
      if(cfg.closePath){
        // close to first
        lines.push(`G1 X${fmt(p0.x*cfg.scale + cfg.offsetX)} Y${fmt(p0.y*cfg.scale + cfg.offsetY)}`);
      }
      lines.push(`G1 Z${fmt(cfg.safeZ)}`);
    }
  });

  for(const f of cfg.footer){
    lines.push(f.replace('{safeZ}', fmt(cfg.safeZ)));
  }
  return lines.join('\n');
}

/**
 * generateLaserGcode - similar to raster but emits S (power) values
 * settings:
 *  - pixelSize, feedRate, powerMin, powerMax, invert, serpentine, decimalPlaces
 */
export function generateLaserGcode(input, settings = {}){
  const cfg = Object.assign({
    pixelSize: 0.5,
    feedRate: 1500,
    powerMin: 0,
    powerMax: 255,
    invert: false,
    serpentine: true,
    decimalPlaces: 0,
    header: ['G21','G90','M3'],
    footer: ['M5','G0 X0 Y0','M30']
  }, settings);

  const accessor = makeIntensityAccessor(input);
  const w = accessor.width, h = accessor.height;
  const fmt = (n)=> Number(n).toFixed(cfg.decimalPlaces);
  const lines = [];
  lines.push(...cfg.header);
  lines.push(`F${cfg.feedRate}`);

  for(let y=0;y<h;y++){
    const leftToRight = (!cfg.serpentine) ? true : (y%2===0);
    const xs = leftToRight ? [0, w, 1] : [w-1, -1, -1];
    const startX = xs[0], endX = xs[1];
    const startY = y;
    const startPosX = startX * cfg.pixelSize;
    const startPosY = startY * cfg.pixelSize;
    lines.push(`G0 X${fmt(startPosX)} Y${fmt(startPosY)} Z0`);
    for(let x = startX; x !== endX; x += xs[2]){
      const intensity = accessor.getIntensity(x,y); // 0..1
      let power = Math.round((intensity) * (cfg.powerMax - cfg.powerMin) + cfg.powerMin);
      if(cfg.invert) power = cfg.powerMax - power;
      const posX = x * cfg.pixelSize;
      const posY = y * cfg.pixelSize;
      lines.push(`G1 X${fmt(posX)} Y${fmt(posY)} S${power}`);
    }
  }

  for(const f of cfg.footer) lines.push(f);
  return lines.join('\n');
}

/**
 * parseGcodeLines - returns array of motion commands [{cmd:'G1', x,y,z,s,...}]
 */
export function parseGcodeLines(gcodeText){
  const lines = String(gcodeText||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const out = [];
  for(const l of lines){
    if(/^\s*;/i.test(l) || /^\s*\(/.test(l)) continue;
    const m = l.match(/^(G\d+)\s*(.*)/i);
    if(!m) continue;
    const cmd = m[1].toUpperCase();
    const params = {};
    const parts = m[2].split(/\s+/).filter(Boolean);
    for(const p of parts){
      const key = p[0].toLowerCase();
      const val = parseFloat(p.substring(1));
      params[key] = isNaN(val) ? p.substring(1) : val;
    }
    out.push({cmd, params, raw: l});
  }
  return out;
}

/**
 * analyzeGcode - returns simple stats: lines, moves, travelDistance, minZ,maxZ
 */
export function analyzeGcode(gcodeText){
  const lines = String(gcodeText||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let moves = 0, travel = 0;
  let minZ = Infinity, maxZ = -Infinity;
  let last = {x:0,y:0,z:0};
  for(const l of lines){
    const parsed = parseGcodeLines(l);
    if(parsed.length===0) continue;
    for(const p of parsed){
      if(p.cmd === 'G0' || p.cmd === 'G1'){
        moves++;
        const x = ('x' in p.params) ? Number(p.params.x) : last.x;
        const y = ('y' in p.params) ? Number(p.params.y) : last.y;
        const z = ('z' in p.params) ? Number(p.params.z) : last.z;
        const dx = x - last.x, dy = y - last.y, dz = z - last.z;
        travel += Math.sqrt(dx*dx + dy*dy + dz*dz);
        last = {x,y,z};
        if(!isNaN(z)){ minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      }
    }
  }
  if(minZ===Infinity) minZ = 0;
  if(maxZ===-Infinity) maxZ = 0;
  return { lines: lines.length, moves, travel, minZ, maxZ };
}
