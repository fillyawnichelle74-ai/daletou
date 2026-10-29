const https=require('node:https');
const {normalizeDraw,SOURCE}=require('./draws');
const API='https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=100&isVerify=1';
function parseOfficialResponse(body) {
  if(typeof body==='string')throw Error('Official source returned non-JSON response');
  const rows=body?.value?.list;
  if(!Array.isArray(rows)||rows.length===0)throw Error('Official source response shape is unavailable');
  return rows.map(row=>{
    const balls=typeof row.lotteryDrawResult==='string'?row.lotteryDrawResult.match(/\d+/g):null;
    if(!balls||balls.length!==7)throw Error('Invalid official result');
    return normalizeDraw({issue:String(row.lotteryDrawNum),date:String(row.lotteryDrawTime).slice(0,10),front:balls.slice(0,5).map(Number),back:balls.slice(5).map(Number),sourceUrl:SOURCE});
  });
}
function requestPage(page) {
  return new Promise((resolve,reject)=>{
    const request=https.get(`${API}&pageNo=${page}`,{timeout:15000,headers:{Accept:'application/json'}},response=>{
      if(response.statusCode!==200){response.resume();reject(Error(`Official endpoint HTTP ${response.statusCode}`));return;}
      let raw='';response.setEncoding('utf8');response.on('data',chunk=>{raw+=chunk;if(raw.length>2000000)request.destroy(Error('Official response too large'))});
      response.on('end',()=>{try{resolve(JSON.parse(raw))}catch(error){reject(error)}});
    });
    request.on('timeout',()=>request.destroy(Error('Official endpoint timeout')));
    request.on('error',reject);
  });
}
async function fetchOfficialDraws(existing,loadPage=requestPage) {
  const known=new Set(existing.map(draw=>draw.issue)),all=[];
  for(let page=1;page<=20;page++){
    const rows=parseOfficialResponse(await loadPage(page));
    all.push(...rows);
    if(rows.some(draw=>known.has(draw.issue)))return all;
  }
  throw Error('Official history did not overlap validated archive in 20 pages');
}
module.exports={API,requestPage,parseOfficialResponse,fetchOfficialDraws};

