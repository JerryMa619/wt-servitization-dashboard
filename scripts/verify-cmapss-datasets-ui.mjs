import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:5178/';
const out=new URL('../screenshots/cmapss-datasets/',import.meta.url);mkdirSync(out,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const nav=()=>page.getByRole('navigation',{name:'Demonstration views'});
const work=()=>page.getByRole('region',{name:'Executable semantic workflow'});
const switchTo=async(ds)=>{await page.getByRole('combobox',{name:'Dataset',exact:true}).selectOption(ds);await page.locator('.cm-summary').getByText(new RegExp('^'+ds+' /')).waitFor();};
const download=async(button)=>{const waiting=page.waitForEvent('download');await button.click();const d=await waiting;return {name:d.suggestedFilename(),text:readFileSync(await d.path(),'utf8')};};
try{
 await page.goto(new URL('cmapss/',base).href);
 // In-flight cancellation cannot replace the selected FD001 with a late FD002 result.
 await page.route('**/cmapss/data/FD002.json',async route=>{await new Promise(r=>setTimeout(r,600));await route.continue();});
 await page.getByRole('combobox',{name:'Dataset',exact:true}).selectOption('FD002');
 await page.getByRole('button',{name:'Return to FD001',exact:true}).click();
 await page.locator('.cm-summary').getByText('FD001 / 034').waitFor();
 await page.waitForTimeout(800); // Allow the deliberately delayed handler to finish before removing it.
 await page.unroute('**/cmapss/data/FD002.json');
 // Failure and retry, with no stale FD001 evidence left active.
 await page.route('**/cmapss/data/FD003.json',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.getByRole('combobox',{name:'Dataset',exact:true}).selectOption('FD003');
 await page.getByRole('heading',{name:'Unable to load FD003'}).waitFor();assert.equal(await page.locator('.cm-summary').count(),0);
 await page.unroute('**/cmapss/data/FD003.json');await page.getByRole('button',{name:'Retry dataset'}).click();
 await page.locator('.cm-summary').getByText('FD003 / 001').waitFor();
 for(const ds of ['FD002','FD003','FD004']){
  await switchTo(ds);
  const data=JSON.parse(readFileSync(new URL(`../public/cmapss/data/${ds}.json`,import.meta.url)));
  const e=data.engines[0],p=e.points[0];
  assert.equal(await page.getByTestId('cycle').innerText(),String(p.cycle));
  assert.equal(await page.getByRole('checkbox',{name:'Evaluation truth'}).isChecked(),false);
  assert.equal(await page.getByRole('region',{name:'Engine 034 guided demonstration'}).count(),0);
  // Clicking the current subset in the table is a no-op, not a perpetual loader.
  await page.getByRole('button',{name:`Explore ${ds}`,exact:true}).click();await page.getByTestId('cycle').waitFor();
  await page.getByRole('region',{name:'Dataset comparison'}).screenshot({path:fileURLToPath(new URL(`${ds}-comparison.png`,out))});
  const dl=await download(page.getByRole('button',{name:'Export evidence',exact:true}));const json=JSON.parse(dl.text);
  assert.ok(dl.name.includes(ds));assert.equal(json.dataset,ds);assert.equal(json.provenance.model,data.model);assert.equal(json.prediction.point,p.point);
  assert.ok(!dl.text.includes('finalRUL'));
  await nav().getByRole('button',{name:'Service decisions'}).click();
  assert.equal(await page.getByRole('button',{name:'Show cost-driven example'}).count(),0);
  await page.getByRole('button',{name:'Apply Availability assurance',exact:true}).click();
  const comparison=JSON.parse((await download(page.getByRole('button',{name:'Export contract comparison',exact:true}))).text);assert.equal(comparison.dataset,ds);
  await page.getByRole('button',{name:'Query and validate the applied contract'}).click();
  await work().getByRole('combobox',{name:'Semantic query'}).selectOption('observations');
  await work().getByRole('button',{name:'Run RDF / SHACL / SPARQL'}).click();await page.getByTestId('shacl-result').waitFor({timeout:60000});
  assert.match(await page.getByTestId('shacl-result').innerText(),/^CONFORMS/);
  assert.ok((await work().getByRole('table',{name:'SPARQL results'}).innerText()).includes(`test_${ds}.txt`));
  const rdf=await download(work().getByRole('button',{name:'RDF snapshot',exact:true}));
  assert.ok(rdf.name.includes(ds));assert.ok(rdf.text.includes(`urn:cmapss:${ds}:engine:1`));assert.ok(!rdf.text.includes('urn:cmapss:FD001:'));
  const result=JSON.parse((await download(work().getByRole('button',{name:'Results + hashes',exact:true}))).text);assert.equal(result.dataset,ds);
  if(ds==='FD004')await work().screenshot({path:fileURLToPath(new URL('FD004-semantic-desktop.png',out))});
  await nav().getByRole('button',{name:'Twin overview'}).click();
  await page.getByRole('checkbox',{name:'Evaluation truth'}).check();
  await page.getByRole('button',{name:'Play replay',exact:true}).click();
 }
 await switchTo('FD001');assert.equal(await page.getByTestId('cycle').innerText(),'80');
 assert.equal(await page.getByRole('checkbox',{name:'Evaluation truth'}).isChecked(),false);
 await nav().getByRole('button',{name:'Service decisions'}).click();assert.ok((await page.locator('.cm-active-contract').innerText()).includes('Baseline / custom'));
 await page.getByRole('button',{name:'Show cost-driven example'}).click();assert.equal(await page.getByTestId('cycle').innerText(),'158');
 // Integrity mismatch is handled separately from a network failure.
 await page.route('**/cmapss/data/FD004.json',route=>route.fulfill({status:200,body:'{"dataset":"FD004"}'}));
 await page.getByRole('combobox',{name:'Dataset',exact:true}).selectOption('FD004');await page.getByText('Dataset integrity check failed',{exact:true}).waitFor();
 await page.unroute('**/cmapss/data/FD004.json');await page.getByRole('button',{name:'Retry dataset'}).click();await page.locator('.cm-summary').getByText('FD004 / 001').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:900});
  for(const tab of ['Twin overview','DT framework','Ontology explorer','Service decisions']){
   await nav().getByRole('button',{name:tab}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${tab}: overflow`);
   if(width===390&&tab==='Twin overview')await page.screenshot({path:fileURLToPath(new URL('FD004-mobile.png',out)),fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 const record={base,status:'passed',browserErrors:errors,checks:['four dataset identities; same-number engines distinct','switch resets replay, evaluation and contract','in-flight cancellation, HTTP failure/retry, integrity failure/retry','same-subset click remains usable','dataset-specific JSON and RDF/result downloads','real SHACL/SPARQL for every new subset','FD001 guided contract example preserved','390/320px four-view layouts']};
 writeFileSync(new URL('verification.json',out),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));
}catch(e){console.error(await page.locator('body').innerText());console.error(errors);throw e;}finally{await browser.close();}
