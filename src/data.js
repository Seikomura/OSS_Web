export const STATUS = {
  pending: {label:'ยังไม่เริ่ม', short:'ยังไม่เริ่ม', icon:'○'},
  waiting: {label:'รอดำเนินการ', short:'รอ', icon:'◷'},
  active: {label:'กำลังดำเนินการ', short:'กำลังดำเนินการ', icon:'●'},
  done: {label:'เสร็จแล้ว', short:'เสร็จแล้ว', icon:'✓'}
};
export const STEPS = [
  {id:'S1',line:'prepare',title:'เริ่มระบบงานขออนุญาต'},
  {id:'S2',line:'prepare',title:'เตรียมเอกสารการขออนุญาต'},
  {id:'S3',line:'prepare',title:'เอกสารครบถ้วนสมบูรณ์'},
  {id:'S4',line:'prepare',title:'ยื่นเข้าระบบ SSO (E-License)'},
  {id:'A1',line:'factory',title:'ยื่นคำขอตรวจระบบคุณภาพโรงงาน'},
  {id:'A2',line:'factory',title:'อยู่ระหว่างตรวจประเมินโรงงาน'},
  {id:'A3',line:'factory',title:'จบการตรวจโรงงาน (ออกรายงาน)'},
  {id:'B1',line:'lab',title:'ขอทดสอบตัวอย่าง'},
  {id:'B2',line:'lab',title:'ทำตัวอย่าง'},
  {id:'B3',line:'lab',title:'อยู่ระหว่างทดสอบตัวอย่าง'},
  {id:'B4',line:'lab',title:'จบการทดสอบ'},
  {id:'F1',line:'permit',title:'ยื่นแบบคำขออนุญาต'},
  {id:'F2',line:'permit',title:'กระบวนการทบทวน'},
  {id:'F3',line:'permit',title:'ชำระค่าธรรมเนียม'},
  {id:'F4',line:'permit',title:'รับใบอนุญาต'}
];
export const LINES = {prepare:{label:'เตรียมคำขอ',color:'#149da9'},factory:{label:'โรงงาน · Process',color:'#159673'},lab:{label:'Lab · Product',color:'#3d68d9'},permit:{label:'ออกใบอนุญาต',color:'#b77b18'}};
export function stepTitle(step,job){return step.id==='B2'&&job.permit==='มอ.5'?'อยู่ระหว่างนำเข้า':step.id==='F1'?`ยื่นแบบ ${job.permit}`:step.title;}
export function progress(job){const done=STEPS.filter(s=>job.steps[s.id]?.status==='done').length;return {done,total:STEPS.length,percent:Math.round(done/STEPS.length*100)};}
export function blankSteps(){return Object.fromEntries(STEPS.map(s=>[s.id,{status:'pending',date:'',note:''}]));}
export function visibleJobs(state,user){return user.role==='admin'?state.jobs:state.jobs.filter(j=>j.customerId===user.id);}
export function removeCustomer(state,id){state.customers=state.customers.filter(c=>c.id!==id);state.jobs=state.jobs.filter(j=>j.customerId!==id);}
export function validateUsername(state,username,exceptId){return !state.customers.some(c=>c.id!==exceptId&&c.username.toLowerCase()===username.toLowerCase())&&username.toLowerCase()!=='admin';}
