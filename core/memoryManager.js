// memoryManager.js - skeleton for managing OpenCV mats and similar resources
export const memoryManager = {
  allocated: [],
  track(m){ this.allocated.push(m); },
  safeDelete(m){
    try{
      if(m && typeof m.delete === 'function') m.delete();
    }catch(e){}
  },
  cleanup(){
    this.allocated.forEach(m=>{ try{ if(m && m.delete) m.delete(); }catch(e){} });
    this.allocated = [];
  }
};
export default memoryManager;
