const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const moduleState={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/app-updates/update-policy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleState,exports:moduleState.exports,URL});
const {parseRelease,newerRelease,downloadCompatibleUpdate}=moduleState.exports;
test('native releases compare version before build and never downgrade',()=>{
 assert.equal(newerRelease({version:'1.0.1',build:'2'},'1.0.0','99'),true);
 assert.equal(newerRelease({version:'1.0.0',build:'2'},'1.0.1','1'),false);
 assert.equal(newerRelease({version:'1.0.1',build:'2'},'1.0.1','1'),true);
 assert.equal(newerRelease({version:'1.0.1',build:'2'},'1.0.1','2'),false);
});
test('release destinations reject unsafe and deceptive URLs',()=>{
 const base={version:'1.0.1',build:'2',kind:'download'};
 for(const url of ['http://expo.dev/a.apk','https://expo.dev.evil.com/a','javascript:alert(1)','https://user:pass@expo.dev/a'])assert.throws(()=>parseRelease({...base,url}));
 assert.equal(parseRelease({...base,url:'https://expo.dev/artifacts/eas/a.apk'}).version,'1.0.1');
});
test('unsupported development clients make no update requests',async()=>{
 assert.equal(await downloadCompatibleUpdate({enabled:false,check:()=>assert.fail(),fetch:()=>assert.fail()}),'unavailable');
});
test('current clients do not download and available updates are downloaded once',async()=>{
 let downloads=0;
 const driver={enabled:true,check:async()=>({isAvailable:false}),fetch:async()=>{downloads++;return {isNew:true};}};
 assert.equal(await downloadCompatibleUpdate(driver),'current');assert.equal(downloads,0);
 driver.check=async()=>({isAvailable:true});
 assert.equal(await downloadCompatibleUpdate(driver),'ready');assert.equal(downloads,1);
});
test('rollback is ready only after preparation and network errors propagate',async()=>{
 assert.equal(await downloadCompatibleUpdate({enabled:true,check:async()=>({isAvailable:false,isRollBackToEmbedded:true}),fetch:async()=>({isNew:false,isRollBackToEmbedded:true})}),'ready');
 await assert.rejects(downloadCompatibleUpdate({enabled:true,check:async()=>{throw Error('offline');},fetch:()=>assert.fail()}),/offline/);
});
