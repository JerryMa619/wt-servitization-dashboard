import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:5178/';
const out=new URL('../screenshots/cmapss-semantic/',import.meta.url);mkdirSync(out,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const capture=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});
const work=()=>page.getByRole('region',{name:'Executable semantic workflow'});
const run=async()=>{
  await work().getByRole('button',{name:'Run RDF / SHACL / SPARQL',exact:true}).click();
  await work().getByTestId('shacl-result').waitFor({timeout:60000});
};
try{
  await page.goto(new URL('cmapss/',base).href);
  const tour=page.getByRole('region',{name:'Engine 034 guided demonstration'});
  for(const [state,cycle] of [['Nominal',30],['Watch',94],['Alert',158],['Hold',181]]){
    await tour.getByRole('button',{name:new RegExp(state)}).click();
    assert.equal(await page.getByTestId('cycle').innerText(),String(cycle));
    assert.ok((await page.locator('.cm-summary').innerText()).includes(state));
  }
  assert.equal(await page.getByTestId('recommendation').innerText(),'Planned Maintenance');
  await capture('guided-maintenance');
  await page.getByRole('button',{name:'Validate this snapshot'}).click();
  await run();assert.match(await work().getByTestId('shacl-result').innerText(),/^CONFORMS/);
  assert.ok((await work().getByRole('table',{name:'SPARQL results'}).innerText()).includes('Planned Maintenance'));
  assert.ok((await work().innerText()).includes('136 triples'));
  await capture('semantic-pass-desktop');
  for(const [name,extension] of [['RDF snapshot','ttl'],['SHACL report','ttl'],['SPARQL query','rq'],['Results + hashes','json']]){
    const pending=page.waitForEvent('download');await work().getByRole('button',{name,exact:true}).click();
    const dl=await pending;assert.ok(dl.suggestedFilename().endsWith('.'+extension));
    const text=readFileSync(await dl.path(),'utf8');assert.ok(text.length>20);
    if(extension==='json'){const obj=JSON.parse(text);assert.equal(obj.conforms,true);assert.equal(obj.cycle,181);assert.match(obj.datasetSHA256,/^[a-f0-9]{64}$/);}
  }
  await work().getByRole('combobox',{name:'Validation example'}).selectOption('missing-unit');
  assert.equal(await work().getByTestId('shacl-result').count(),0,'Old pass must disappear immediately');
  await run();assert.match(await work().getByTestId('shacl-result').innerText(),/^NON-CONFORMING/);
  assert.ok((await work().innerText()).includes('cm:unit'));assert.ok((await work().innerText()).includes('0 query rows'));
  await capture('missing-unit-desktop');
  await work().getByRole('combobox',{name:'Validation example'}).selectOption('missing-evidence');await run();
  assert.match(await work().getByTestId('shacl-result').innerText(),/^NON-CONFORMING/);
  assert.ok((await work().innerText()).includes('cm:basedOnEstimate'));
  await work().getByRole('combobox',{name:'Validation example'}).selectOption('none');
  await work().getByRole('combobox',{name:'Semantic query'}).selectOption('candidates');await run();
  assert.equal(await work().getByRole('table').locator('tbody tr').count(),5);
  await work().getByRole('combobox',{name:'Semantic query'}).selectOption('observations');await run();
  assert.equal(await work().getByRole('table').locator('tbody tr').count(),7);
  await page.getByRole('slider',{name:'Replay cycle',exact:true}).fill('150');
  assert.equal(await work().getByTestId('shacl-result').count(),0,'Cycle change invalidates result');
  await run();assert.ok((await work().innerText()).includes('cycle 180'));
  await page.getByRole('navigation',{name:'Demonstration views'}).getByRole('button',{name:'Service decisions'}).click();
  await page.getByRole('slider',{name:'Planned maintenance cost',exact:true}).fill('2');
  await tour.getByRole('button',{name:/Hold/}).click();
  assert.equal(await page.getByRole('slider',{name:'Planned maintenance cost',exact:true}).inputValue(),'1','Tour restores default scenario');
  await page.getByRole('button',{name:'Validate this snapshot'}).click();await run();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px page overflow`);
    if(width===390)await capture('semantic-pass-mobile');
    await work().getByRole('combobox',{name:'Validation example'}).selectOption('missing-unit');await run();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px error overflow`);
    if(width===390)await capture('missing-unit-mobile');
    await work().getByRole('combobox',{name:'Validation example'}).selectOption('none');await run();
  }
  assert.deepEqual(errors,[]);
  const result={base,status:'passed',browserErrors:errors,checks:['four guide milestones and contextual views','real browser RDF / SHACL / SPARQL','four evidence downloads and SHA-256','missing unit and missing recommendation link fail','three SPARQL query result sets','stale cycle/test/query results invalidated','guide resets scenario','390/320px pass and violation layouts']};
  writeFileSync(new URL('verification.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Browser errors:',errors);console.error((await page.locator('body').innerText()).slice(0,3000));await capture('failure');throw e;}finally{await browser.close();}
