// ui-helpers.js - helper utilities for UI
export function qs(id){ return document.getElementById(id); }
export function show(id){ const e = qs(id); if(e) e.style.display='block'; }
export function hide(id){ const e = qs(id); if(e) e.style.display='none'; }
export function hideAll(ids){ ids.forEach(id=>{ const e = qs(id); if(e) e.style.display='none'; }); }
export function setText(id, txt){ const e=qs(id); if(e) e.textContent = txt; }
export function downloadFile(filename, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text], {type:'text/plain'})); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
