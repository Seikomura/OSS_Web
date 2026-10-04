export const STORAGE_KEY = 'oss-portal-demo-v1';
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
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');}
export async function passwordRecord(password){const salt=crypto.randomUUID();return {salt,hash:await passwordHash(password,salt)};}
export async function verifyPassword(password,record){return (await passwordHash(password,record.salt))===record.hash;}
function seedJob(id,customerId,name,permit,standard,doneIds,activeIds,waitingIds){const steps=blankSteps();doneIds.forEach((sid,i)=>{steps[sid]={status:'done',date:`2026-09-${String(Math.min(29,3+i*2)).padStart(2,'0')}`,note:'ดำเนินการเรียบร้อยแล้ว'};});activeIds.forEach(sid=>{steps[sid]={status:'active',date:'2026-10-02',note:sid==='A2'?'นัดตรวจประเมินโรงงานวันที่ 8 ต.ค. 2569':sid==='B3'?'Lab รับตัวอย่างแล้ว อยู่ระหว่างทดสอบตามมาตรฐาน':'เจ้าหน้าที่กำลังดำเนินการ'};});waitingIds.forEach(sid=>{steps[sid]={status:'waiting',date:'',note:'รอผลจากขั้นตอนก่อนหน้า'};});return {id,customerId,name,permit,standard,createdAt:'2026-09-03',updatedAt:'2026-10-02T09:30:00+07:00',steps};}
export async function createSeed(){const customers=[];for(const c of [
  {id:'c1',company:'บริษัท สยาม อิเล็คทริค จำกัด',contact:'คุณกานต์',email:'contact@siam-electric.example',phone:'02-000-0101',username:'siam'},
  {id:'c2',company:'บริษัท นอร์ทสตาร์ อินดัสทรี จำกัด',contact:'คุณนภา',email:'contact@northstar.example',phone:'02-000-0202',username:'northstar'},
  {id:'c3',company:'บริษัท เอเชีย โปรดักส์ จำกัด',contact:'คุณเมธา',email:'contact@asia-products.example',phone:'02-000-0303',username:'asia'}
]){customers.push({...c,active:true,password:await passwordRecord('Demo1234'),demoPassword:'Demo1234'});}
return {version:1,admin:{password:await passwordRecord('Admin1234')},customers,jobs:[
  seedJob('j1','c1','สายไฟฟ้าหุ้มฉนวน PVC','มอ.3','มอก.11 เล่ม 3',['S1','S2','S3','S4','A1','B1','B2'],['A2','B3'],['A3','B4']),
  seedJob('j2','c1','สายไฟฟ้าสำหรับเครื่องใช้ไฟฟ้า','มอ.1','มอก.11 เล่ม 5',['S1'],['S2'],[]),
  seedJob('j3','c2','ผลิตภัณฑ์เหล็กเส้นเสริมคอนกรีต','มอ.3','มอก.24',['S1','S2','S3','S4','A1','A2','A3','B1','B2','B3','B4','F1'],['F2'],['F3']),
  seedJob('j4','c3','ผลิตภัณฑ์นำเข้าสำหรับการทดสอบ','มอ.5','มอก.2217',['S1','S2','S3','S4','A1','B1'],['B2'],['A2'])
]};}
