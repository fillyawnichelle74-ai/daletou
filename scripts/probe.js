const fs=require('node:fs/promises');
const path=require('node:path');
const {requestPage,fetchHistoryDraws,requestOfficialLatest,parseOfficialLatest,verifyLatest}=require('../lib/source');
async function probe() {
  const snapshot=JSON.parse(await fs.readFile(path.join(__dirname,'../data/draws.json'),'utf8'));
  const rows=await fetchHistoryDraws(snapshot.draws,async page=>{
    const html=await requestPage(page);
    console.error(`History page ${page} HTTP 200`);
    return html;
  });
  console.error(`Validated archive overlap (${snapshot.draws.length} saved draws)`);
  const official=parseOfficialLatest(await requestOfficialLatest());
  console.error('Official announcement HTTP 200 and parsed');
  const latest=verifyLatest(rows,official);
  console.error('Latest issue, date and seven balls match official announcement');
  process.stdout.write(JSON.stringify(latest)+'\n');
}
if(require.main===module)probe().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={probe};
