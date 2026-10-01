import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const output=new URL('../screenshots/cmapss/',import.meta.url);mkdirSync(output,{recursive:true});
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:5178/';
const errors=[],checks=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));
const screenshot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:true});
const cycle=()=>page.getByTestId('cycle').innerText();
const nav=name=>page.getByRole('navigation',{name:'Demonstration views'}).getByRole('button',{name,exact:false});
async function range(label,value){await page.getByRole('slider',{name:label,exact:true}).fill(String(value));}
try{
  await page.goto(new URL('cmapss/',base).href);
  await page.getByRole('heading',{name:'One engine. One traceable decision.'}).waitFor();
  assert.equal(await cycle(),'80');
  await page.getByRole('button',{name:'Play replay',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid=cycle]').textContent)>80);
  await page.getByRole('button',{name:'Pause replay',exact:true}).click();
  const paused=await cycle();await page.waitForTimeout(850);assert.equal(await cycle(),paused);
  await range('Replay cycle',100);assert.equal(await cycle(),'130');
  const before=await page.getByTestId('recommendation').innerText();
  await page.getByRole('checkbox',{name:'Evaluation truth'}).check();
  assert.equal(await page.getByTestId('recommendation').innerText(),before);
  await page.getByRole('checkbox',{name:'Evaluation truth'}).uncheck();
  await screenshot('twin-desktop');checks.push('play, pause, seek, evaluation isolation');
  await nav('DT framework').click();await page.getByRole('button',{name:/01 \/ OE/}).click();
  assert.ok((await page.locator('.cm-framework-detail').innerText()).includes('FD001 engine identifier'));
  await page.getByRole('checkbox',{name:'Show servitization extensions'}).uncheck();assert.equal(await page.locator('.cm-framework em').count(),0);
  await page.getByRole('checkbox',{name:'Show servitization extensions'}).check();
  await screenshot('framework-desktop');checks.push('framework module selection and extension toggle');
  await nav('Ontology explorer').click();assert.equal(await page.locator('.react-flow__node').count(),6);
  await page.locator('.react-flow__node').filter({hasText:'sdt:RULEstimate'}).click();
  assert.ok((await page.locator('.cm-node-detail').innerText()).includes('not asserted into hours properties'));
  await screenshot('ontology-desktop');
  await page.getByRole('button',{name:'Schema',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search ontology classes'}).fill('Contract');
  await page.getByRole('button',{name:'Contract',exact:true}).click();
  assert.ok((await page.locator('.cm-schema article').innerText()).includes('sdt:hasKPI'));
  const ttl=await page.request.get(new URL('ontology/sdt_tbox.ttl',base).href);assert.equal(ttl.status(),200);
  await screenshot('schema-desktop');
  await page.getByRole('button',{name:'Evidence',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export this decision'}).click();
  const download=await downloadPromise;const payload=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(payload.cycle,130);assert.equal(payload.units,'cycles');assert.equal(payload.execution,'not performed');assert.ok(!('truth' in payload));
  checks.push('instance selection, schema search/properties, TTL and evidence download');
  await nav('Service decisions').click();
  await range('Replay cycle',173);assert.equal(await page.getByTestId('recommendation').innerText(),'Planned Maintenance');
  assert.equal(await page.getByRole('cell',{name:'Excluded',exact:true}).count(),3);
  await range('Planned maintenance cost',2);assert.equal(await page.getByTestId('recommendation').innerText(),'Derate/Hold');
  await page.getByRole('button',{name:'Reset assumptions'}).click();assert.equal(await page.getByTestId('recommendation').innerText(),'Planned Maintenance');
  await screenshot('decisions-desktop');checks.push('guardrail exclusions and cost-driven recommendation change');
  await page.getByRole('combobox',{name:'Engine',exact:true}).selectOption('1');assert.equal(await cycle(),'30');
  await page.getByRole('button',{name:'Play replay',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid=cycle]').textContent==='31');
  await page.waitForTimeout(800);assert.ok(await page.getByRole('button',{name:'Play replay',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Restart replay'}).click();assert.equal(await cycle(),'30');
  checks.push('engine reset, short trajectory and automatic end stop');
  await page.getByRole('combobox',{name:'Engine',exact:true}).selectOption('34');
  await range('Replay cycle',100);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:900});
    for(const tab of ['Twin overview','DT framework','Ontology explorer','Service decisions']){
      await nav(tab).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: ${tab} overflows`);
      if(width===390)await screenshot(tab.toLowerCase().replaceAll(' ','-')+'-mobile');
    }
  }
  checks.push('390px and 320px: all four views without document overflow');
  await page.setViewportSize({width:1440,height:1000});
  for(const route of ['', 'enhanced/']){
    await page.goto(new URL(route,base).href);await page.locator('.dashboard').waitFor();
    assert.equal(await page.locator('.cm-app').count(),0);
  }
  checks.push('original standard and enhanced route smoke checks');
  assert.deepEqual(errors,[]);
  writeFileSync(new URL('verification.json',output),JSON.stringify({base,checks,browserErrors:errors,status:'passed'},null,2)+'\n');
  console.log(JSON.stringify({status:'passed',checks,browserErrors:errors},null,2));
}finally{await browser.close();}
