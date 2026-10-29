const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {mergeDraws}=require('../lib/draws');
const {parseHistoryPage}=require('../lib/source');
test('full suite and build tolerate production archive advancing beyond the initial fixture',{skip:process.env.DLT_FIXTURE_REGRESSION_CHILD==='1'},async()=>{
 const root=path.join(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'dlt-advanced-archive-'));
 try {
  for(const name of ['lib','scripts','test','site','.github','package.json','data'])await fs.cp(path.join(root,name),path.join(temp,name),{recursive:true});
  const snapshot=JSON.parse(await fs.readFile(path.join(__dirname,'fixtures/initial-draws.json'),'utf8'));
  snapshot.draws=mergeDraws(snapshot.draws,parseHistoryPage(await fs.readFile(path.join(__dirname,'fixtures/history.html'),'utf8')));
  assert.equal(snapshot.draws.length,331);assert.equal(snapshot.draws.at(-1).issue,'26123');
  const advanced=JSON.stringify(snapshot,null,2)+'\n';await fs.writeFile(path.join(temp,'data/draws.json'),advanced);
  const names=(await fs.readdir(path.join(temp,'test'))).filter(name=>name.endsWith('.test.js')).map(name=>path.join('test',name));
  const childEnv={...process.env,DLT_FIXTURE_REGRESSION_CHILD:'1'};delete childEnv.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test',...names],{cwd:temp,env:childEnv,encoding:'utf8',timeout:30000});
  assert.match(result.stdout,/verified sync adds one draw/);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  const build=spawnSync(process.execPath,['scripts/build.js'],{cwd:temp,encoding:'utf8',timeout:10000});assert.equal(build.status,0,build.stderr);
  assert.equal(await fs.readFile(path.join(temp,'site/data/draws.json'),'utf8'),advanced);
 } finally {await fs.rm(temp,{recursive:true,force:true});}
});
