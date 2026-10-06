import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:5178/';
const out=process.env.STORY_OUTPUT?pathToFileURL(process.env.STORY_OUTPUT+'/'):new URL('../screenshots/cmapss-story/',import.meta.url);mkdirSync(out,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const stage=id=>page.locator(`[data-stage="${id}"]`);
const chapter=n=>page.getByRole('navigation',{name:'Story chapters'}).getByRole('button',{name:new RegExp(`^Scene ${n}:`)});
const shot=async(name)=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true,animations:'disabled'});
try{
 await page.goto(new URL('cmapss/',base).href);await page.getByRole('button',{name:'Play case study',exact:true}).click();
 await stage('purpose').waitFor();assert.equal(await page.locator('.cs-play').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(18, 123, 120)');await page.getByRole('button',{name:'Pause story',exact:true}).click();
 const progress=await page.getByRole('progressbar').getAttribute('aria-valuenow');await page.waitForTimeout(350);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),progress);
 await page.getByRole('combobox',{name:'Story speed'}).selectOption('2');await page.getByRole('button',{name:'Play story',exact:true}).click();
 const ids=['purpose','observe','predict','semantics','quality','cost','margin','handoff','contributions'];
 for(const id of ids){
  await stage(id).waitFor({timeout:25000});assert.ok(!/[\u3400-\u9fff]/u.test(await page.locator('body').innerText()),'Story must be entirely English');
  if(['semantics','quality','margin','handoff'].includes(id)){await page.getByTestId('story-check').waitFor({timeout:60000});assert.match(await page.getByTestId('story-check').innerText(),id==='quality'?/^SHACL NON-CONFORMING/:/^SHACL CONFORMS/);}
  if(['cost','margin'].includes(id)){assert.equal(await page.getByTestId('story-cycle').innerText(),id==='cost'?'158':'171');assert.equal(await page.getByTestId('story-availability-assurance').innerText(),id==='cost'?'Enhanced Monitoring':'Planned Maintenance');}
  if(['observe','semantics','margin','contributions'].includes(id))await shot(id+'-desktop');
 }
 await page.getByTestId('story-position').filter({hasText:'Story complete'}).waitFor({timeout:20000});
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export story evidence',exact:true}).click();const d=await pending;const record=JSON.parse(readFileSync(await d.path(),'utf8'));
 assert.ok(!/[\u3400-\u9fff]/u.test(JSON.stringify(record.script)));assert.equal(record.playbackEnded,true);assert.equal(record.allChaptersVisited,true);assert.equal(record.semanticChecks.length,4);assert.ok(record.semanticChecks.every(r=>r.shapesSHA256.length===64&&r.datasetSHA256.length===64));assert.ok(!JSON.stringify(record).includes('finalRUL'));
 await page.getByRole('button',{name:'Restart story'}).click();await stage('purpose').waitFor();await page.getByRole('button',{name:'Pause story'}).click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:900});
  for(const n of [1,4,5,6,7,8,9]){
   await chapter(n).click();
   if([4,5,7,8].includes(n))await page.getByTestId('story-check').waitFor({timeout:60000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: scene ${n} overflows`);
   if(width===390&&[4,7,9].includes(n))await shot(`scene-${n}-mobile`);
  }
 }
 // Manual viva mode holds its scene, preserves semantic execution and exposes reproducible sensitivity.
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('combobox',{name:'Presentation mode'}).selectOption('viva');
 await chapter(1).click();await page.getByRole('button',{name:'Restart story'}).click();
 assert.equal(await page.getByRole('button',{name:'Play story',exact:true}).isDisabled(),true);
 assert.ok(await page.getByLabel('Asset and service research scope').isVisible());
 await chapter(4).click();await page.getByTestId('story-check').waitFor({timeout:60000});
 assert.equal(await page.getByLabel('Implemented evidence handoff').locator('li').count(),5);
 const manualProgress=await page.getByRole('progressbar').getAttribute('aria-valuenow');await page.waitForTimeout(350);
 assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),manualProgress);
 await page.getByText('Run an equal-requirement JSON versus RDF comparison',{exact:true}).click();
 await page.getByRole('button',{name:'Run comparison',exact:true}).click();await page.getByTestId('evidence-comparison-result').waitFor({timeout:60000});
 assert.equal(await page.getByRole('table',{name:'Representation comparison results'}).locator('tbody tr').count(),7);
 const comparePending=page.waitForEvent('download');await page.getByRole('button',{name:'Export comparison evidence'}).click();
 const compareDownload=await comparePending;const compare=JSON.parse(readFileSync(await compareDownload.path(),'utf8'));
 assert.equal(compare.results.length,7);assert.ok(compare.results.every(r=>r.matchesExpected&&r.queryParity));assert.equal(compare.shapesSHA256.length,64);assert.equal(compare.fixturesSHA256.length,64);
 await shot('viva-comparison-desktop');
 for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Comparison fits narrow screens');}
 await shot('viva-comparison-mobile');await page.setViewportSize({width:1440,height:1100});
 await chapter(7).click();await page.getByTestId('story-check').waitFor({timeout:60000});
 await page.getByText('Separate cost and margin effects · 2 × 2 comparison',{exact:true}).click();
 const factorial=await page.getByRole('table',{name:'Cost and margin factorial'}).locator('tbody tr').allTextContents();
 assert.equal(factorial.length,4);assert.ok(factorial[2].includes('Inspection'));await shot('viva-factorial-desktop');
 await page.getByText('Inspect computed sensitivity and threshold-only comparison',{exact:true}).click();
 assert.equal(await page.getByRole('table',{name:'Aggregate sensitivity'}).locator('tbody tr').count(),9);
 await page.getByRole('combobox',{name:'Sensitivity contract'}).selectOption('1');
 const sensitivityPending=page.waitForEvent('download');await page.getByRole('button',{name:'Export sensitivity evidence'}).click();
 const sensitivityDownload=await sensitivityPending;const sensitivity=JSON.parse(readFileSync(await sensitivityDownload.path(),'utf8'));
 assert.equal(sensitivity.frames,1233);assert.equal(sensitivity.referencePolicy.consequence,20);assert.equal(sensitivity.rows[0].changed,0);assert.equal(sensitivity.rows.length,9);assert.ok(sensitivity.sourceHashes);
 await page.getByText('Where do the changes occur?',{exact:true}).click();
 assert.equal(await page.getByRole('table',{name:'Per-engine sensitivity'}).locator('tbody tr').count(),8);
 assert.equal(sensitivity.rows[8].byEngine.reduce((n,e)=>n+e.changed,0),150);
 assert.equal(Object.values(sensitivity.rows[8].transitions).reduce((a,b)=>a+b,0),1233);
 await shot('viva-sensitivity-desktop');
 for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Expanded sensitivity must fit narrow screens');}
 await shot('viva-sensitivity-mobile');
 await chapter(9).click();await page.getByText('Still needed to support the research claim',{exact:true}).first().click();
 assert.ok(await page.getByLabel('Complementary case studies').isVisible());
 await page.getByRole('button',{name:'Exit story'}).click();assert.equal(await page.getByTestId('cycle').innerText(),'80');
 // Deep link, semantic failure/retry, and reduced-motion behavior.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(new URL('cmapss/?story=1',base).href);await page.getByRole('button',{name:'Pause story'}).click();
 assert.equal(await page.locator('.cs-fan').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.route('**/cmapss/cmapss-shapes.ttl',r=>r.fulfill({status:503,body:'unavailable'}));
 await chapter(4).click();await page.getByRole('alert').waitFor();assert.ok((await page.getByTestId('story-position').innerText()).includes('Waiting for semantic execution'));
 await page.unroute('**/cmapss/cmapss-shapes.ttl');await page.getByRole('button',{name:'Retry validation'}).click();await page.getByTestId('story-check').waitFor({timeout:60000});assert.match(await page.getByTestId('story-check').innerText(),/^SHACL CONFORMS/);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Play case study',exact:true}).waitFor();assert.ok(!new URL(page.url()).searchParams.has('story'));
 assert.deepEqual(errors,[]);
 const report={base,status:'passed',checks:['complete nine-scene autoplay, pause/resume/restart and chapter selection','observed cycles 158/171 and actual contract decisions','four actual semantic checks including invalid-unit rejection','downloaded run evidence with hashes and actual completed checks','deep-link entry and Escape exit preserves explorer snapshot','HTTP failure pauses, retry executes successfully','reduced motion and 390/320px layouts','manual viva mode, responsibility handoff, contribution boundaries and actual sensitivity export','2x2 contract factors, per-engine transitions and first advice cycles','actual JSON/RDF parity experiment, export and expanded mobile layouts'],browserErrors:errors};writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
