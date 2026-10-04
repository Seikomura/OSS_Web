import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';

const sourceRoot=process.env.OSS_SITE_SOURCE || resolve(import.meta.dirname,'..');
const data=await import(pathToFileURL(resolve(sourceRoot,'dist/data.js')));
const source=await readFile(resolve(sourceRoot,'dist/app.js'),'utf8');
const seed=await data.createSeed();

async function waitFor(check,message){const end=Date.now()+3000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,15));}assert.fail(message);}
function boot(initial=seed,session={id:'admin',role:'admin'}){
  const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://demo.example',runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  Object.assign(window,data,{structuredClone,TextEncoder});
  Object.defineProperty(window,'crypto',{value:webcrypto});
  window.scrollTo=()=>{};
  window.HTMLElement.prototype.scrollIntoView=()=>{};
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  // Chromium exposes a control named "id" before HTMLFormElement.id. The live
  // demo reproduces this collision; jsdom does not implement that masking.
  Object.defineProperty(window.HTMLFormElement.prototype,'id',{
    get(){return this.elements.namedItem('id') || this.getAttribute('id');},
    set(value){this.setAttribute('id',value);},configurable:true
  });
  window.localStorage.setItem(data.STORAGE_KEY,JSON.stringify(initial));
  window.sessionStorage.setItem('oss-demo-session',JSON.stringify(session));
  window.eval(source.replace(/^import[^\n]+\n/,''));
  return {dom,window,document:window.document,stored:()=>JSON.parse(window.localStorage.getItem(data.STORAGE_KEY))};
}
function field(document,name,value){const input=document.querySelector(`dialog [name="${name}"]`);assert.ok(input,`Missing field ${name}`);input.value=value;}
function submit(window,document){const form=document.querySelector('dialog form');assert.ok(form);form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));}

test('adding a customer persists the account and its usable password',async()=>{
  const app=boot();try{
    app.document.querySelector('[data-route="customers"]').click();
    app.document.querySelector('[data-action="new-customer"]').click();
    field(app.document,'company','Demo regression customer');field(app.document,'username','regression_customer');field(app.document,'password','TestPass1234');
    submit(app.window,app.document);
    await waitFor(()=>app.stored().customers.some(c=>c.username==='regression_customer'),'Save did not create the customer account');
    const customer=app.stored().customers.find(c=>c.username==='regression_customer');
    assert.equal(await data.verifyPassword('TestPass1234',customer.password),true);
    assert.equal(customer.demoPassword,'TestPass1234');
    assert.equal(app.document.querySelector('dialog'),null);
  }finally{app.window.close();}
});

test('editing a password persists it, rejects the old password, and retains jobs',async()=>{
  const app=boot();try{
    app.document.querySelector('[data-route="customers"]').click();
    app.document.querySelector('[data-action="edit-customer"][data-id="c1"]').click();
    field(app.document,'password','ChangedPass1234');submit(app.window,app.document);
    await waitFor(()=>app.stored().customers.find(c=>c.id==='c1').password.hash!==seed.customers.find(c=>c.id==='c1').password.hash,'Save did not persist the changed password');
    const saved=app.stored();const customer=saved.customers.find(c=>c.id==='c1');
    assert.equal(await data.verifyPassword('ChangedPass1234',customer.password),true);
    assert.equal(await data.verifyPassword('Demo1234',customer.password),false);
    assert.equal(customer.demoPassword,'ChangedPass1234');
    assert.deepEqual(saved.jobs,seed.jobs);
    const reopened=boot(saved);try{
      reopened.document.querySelector('[data-route="customers"]').click();
      reopened.document.querySelector('[data-action="edit-customer"][data-id="c1"]').click();
      const current=reopened.document.querySelector('#customer-latest-password');
      assert.equal(current.value,'ChangedPass1234');assert.equal(current.readOnly,true);
      assert.equal(current.type,'password');assert.equal(current.hasAttribute('name'),false);
      assert.equal(reopened.document.querySelector('[name="password"]').value,'');
      const toggle=reopened.document.querySelector('[data-target="customer-latest-password"]');
      toggle.click();assert.equal(current.type,'text');assert.equal(toggle.textContent,'ซ่อน');
      toggle.click();assert.equal(current.type,'password');
    }finally{reopened.window.close();}
  }finally{app.window.close();}
});

test('saving details without a new password preserves the old password',async()=>{
  const app=boot();try{
    app.document.querySelector('[data-route="customers"]').click();app.document.querySelector('[data-action="edit-customer"][data-id="c1"]').click();
    field(app.document,'contact','Updated contact');submit(app.window,app.document);
    await waitFor(()=>app.stored().customers.find(c=>c.id==='c1').contact==='Updated contact','Save did not persist customer details');
    assert.deepEqual(app.stored().customers.find(c=>c.id==='c1').password,seed.customers.find(c=>c.id==='c1').password);
    assert.equal(app.stored().customers.find(c=>c.id==='c1').demoPassword,'Demo1234');
  }finally{app.window.close();}
});

test('legacy hashes are preserved and only verified default demo passwords are displayed',async()=>{
  const legacy=structuredClone(seed);for(const c of legacy.customers)delete c.demoPassword;
  legacy.customers[0].password=await data.passwordRecord('LegacyPass1234');
  const app=boot(legacy);try{
    app.document.querySelector('[data-route="customers"]').click();
    app.document.querySelector('[data-action="edit-customer"][data-id="c1"]').click();
    await waitFor(()=>app.document.querySelector('dialog'),'Legacy editor did not open');
    assert.equal(app.document.querySelector('#customer-latest-password'),null);
    assert.match(app.document.querySelector('dialog').textContent,/ย้อนกลับไม่ได้/);
    assert.deepEqual(app.stored(),legacy);
    app.document.querySelector('[data-action="close-modal"]').click();
    app.document.querySelector('[data-action="edit-customer"][data-id="c2"]').click();
    await waitFor(()=>app.document.querySelector('#customer-latest-password'),'Default legacy password was not resolved');
    assert.equal(app.document.querySelector('#customer-latest-password').value,'Demo1234');
    assert.deepEqual(app.stored(),legacy);
  }finally{app.window.close();}
});

test('customer view cannot open the admin password editor',()=>{
  const app=boot(seed,{id:'c1',role:'customer'});try{
    assert.equal(app.document.querySelector('[data-route="customers"]'),null);
    assert.equal(app.document.querySelector('#customer-latest-password'),null);
    assert.equal(app.document.body.textContent.includes('Demo1234'),false);
  }finally{app.window.close();}
});

test('duplicate usernames are rejected with a visible error and no mutation',async()=>{
  const app=boot();try{
    app.document.querySelector('[data-route="customers"]').click();app.document.querySelector('[data-action="new-customer"]').click();
    field(app.document,'company','Duplicate');field(app.document,'username','SIAM');field(app.document,'password','TestPass1234');submit(app.window,app.document);
    await waitFor(()=>app.document.querySelector('#form-error').textContent.includes('ถูกใช้แล้ว'),'Duplicate username error was not displayed');
    assert.deepEqual(app.stored(),seed);
  }finally{app.window.close();}
});

test('adding and editing a job also dispatch the correct form handler',async()=>{
  const app=boot();try{
    app.document.querySelector('[data-action="new-job"]').click();field(app.document,'name','Regression job');field(app.document,'standard','Demo standard');submit(app.window,app.document);
    await waitFor(()=>app.stored().jobs.length===seed.jobs.length+1,'Save did not create a job');
    const job=app.stored().jobs.find(j=>j.name==='Regression job');
    assert.equal(Object.keys(job.steps).length,15);
    app.document.querySelector('[data-route="jobs"]').click();app.document.querySelector(`[data-action="edit-job"][data-id="${job.id}"]`).click();field(app.document,'name','Updated regression job');submit(app.window,app.document);
    await waitFor(()=>app.stored().jobs.find(j=>j.id===job.id).name==='Updated regression job','Save did not edit the job');
    assert.deepEqual(app.stored().jobs.find(j=>j.id===job.id).steps,job.steps);
  }finally{app.window.close();}
});
