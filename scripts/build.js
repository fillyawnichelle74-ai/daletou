const fs=require('node:fs/promises');
const path=require('node:path');
async function build(root=path.join(__dirname,'..'),site=path.join(root,'site')){
  const payloads=await Promise.all(['daily.json','draws.json'].map(async name=>{const text=await fs.readFile(path.join(root,'data',name),'utf8');JSON.parse(text);return {name,text};}));
  await fs.mkdir(path.join(site,'data'),{recursive:true});
  for(const {name,text} of payloads)await fs.writeFile(path.join(site,'data',name),text);
}
if(require.main===module)build().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={build};
