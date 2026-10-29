'use strict';
function chinaDate(now) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');
}
function selectDaily(data,now){return data.records?.[chinaDate(now)]??null;}
function formatBall(value){return String(value).padStart(2,'0');}
function formatTime(value){return value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short',hour12:false}).format(new Date(value))+'（北京时间）':'暂无成功同步记录';}
function validateTickets(record){
  if(!Array.isArray(record.tickets)||record.tickets.length!==2)throw Error('今日号码数据不完整');
  for(const ticket of record.tickets)for(const [area,count,max] of [['front',5,35],['back',2,12]]){
    const balls=ticket?.[area];if(!Array.isArray(balls)||balls.length!==count||balls.some((n,i)=>!Number.isInteger(n)||n<1||n>max||i>0&&n<=balls[i-1]))throw Error('今日号码格式异常');
  }
  if(JSON.stringify(record.tickets[0])===JSON.stringify(record.tickets[1]))throw Error('今日号码重复');
}
function viewData(daily,history,now){
  if(!daily||typeof daily.records!=='object'||!Array.isArray(history?.draws))throw Error('发布数据格式异常');
  const record=selectDaily(daily,now);if(record)validateTickets(record);
  const current=daily.sourceStatus;
  return {date:chinaDate(now),record,
    recordSummary:record?`生成依据：截止 ${record.cutoffIssue} 期 · 训练 ${record.trainDrawCount} 期`:'',
    recordStatus:record?.sourceStatus?.state==='stale'?'生成时来源未完成核对，使用最近已校验的旧数据；之后同步不会改写今日两注。':'今日两注已保存，同日刷新或更新数据后保持不变。',
    syncStatus:current?`${current.state==='fresh'?'已核对（fresh）':'同步暂不可用（stale）'} · 当前历史截止 ${current.cutoffIssue} 期${current.state==='stale'?'；保留最近已校验历史':''}`:'同步状态未知',
    syncTime:formatTime(daily.lastSuccessfulSync),
    backtest:record?`留出回测 ${record.report.holdoutCount} 期，相对等概率基准的平均对数评分差 ${record.report.meanLogScoreDifference.toFixed(4)}。未显示可靠预测优势。`:'未显示可靠预测优势。'};
}
async function fetchData(fetcher){
  const [daily,history]=await Promise.all(['daily','draws'].map(async name=>{
    const response=await fetcher(`./data/${name}.json`,{cache:'no-store'});
    if(!response.ok)throw Error(`${name} HTTP ${response.status}`);return response.json();
  }));return {daily,history};
}
function render(view,doc){
  const set=(id,text)=>{doc.getElementById(id).textContent=text;};
  set('date',view.date+' · 北京时间');set('status',view.record?'今日两注已就绪':'今日号码尚未生成，请稍后查看。');
  set('record-summary',view.recordSummary);set('record-status',view.record?view.recordStatus:'自动任务可能延迟，页面不会临时生成号码。');
  set('sync-status',view.syncStatus);set('sync-time',view.syncTime);set('backtest',view.backtest);
  const tickets=doc.getElementById('tickets');tickets.replaceChildren();
  if(!view.record)return;
  view.record.tickets.forEach((ticket,index)=>{
    const card=doc.createElement('article');card.className='ticket';
    const heading=doc.createElement('h2');heading.textContent=`第 ${index+1} 注`;card.append(heading);
    for(const [area,label] of [['front','前区'],['back','后区']]){
      const group=doc.createElement('div');group.className=`ball-group ${area}`;
      const caption=doc.createElement('p');caption.className='area-label';caption.textContent=label;group.append(caption);
      const list=doc.createElement('ul');list.className='balls';list.setAttribute('aria-label',label+'号码');
      for(const value of ticket[area]){const ball=doc.createElement('li');ball.className='ball';ball.textContent=formatBall(value);ball.setAttribute('aria-label',`${label} ${formatBall(value)}`);list.append(ball);}
      group.append(list);card.append(group);
    }tickets.append(card);
  });
}
async function load(doc,fetcher,now){
  try{const {daily,history}=await fetchData(fetcher);render(viewData(daily,history,now),doc);}
  catch(error){doc.getElementById('tickets').replaceChildren();doc.getElementById('status').textContent=`读取数据失败：${error.message}。请稍后刷新重试。`;}
}
if(typeof module!=='undefined')module.exports={chinaDate,selectDaily,formatBall,viewData,fetchData,render,load};
if(typeof document!=='undefined'){
  const refresh=()=>load(document,window.fetch.bind(window),new Date());
  refresh();document.getElementById('refresh').addEventListener('click',refresh);
  // A page left open across midnight must select the new Beijing-day record.
  let day=chinaDate(new Date());setInterval(()=>{const next=chinaDate(new Date());if(next!==day){day=next;refresh();}},60000);
}
