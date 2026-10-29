const {sampleSet}=require('./model');
function chinaDate(now) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function makeDaily(model,rng,date) {
  const ticket=()=>({front:sampleSet(model.frontWeights,5,rng),back:sampleSet(model.backWeights,2,rng)});
  const first=ticket();let second;
  for(let attempt=0;attempt<100;attempt++){second=ticket();if(JSON.stringify(first)!==JSON.stringify(second))break;}
  if(JSON.stringify(first)===JSON.stringify(second))throw Error('Could not generate two distinct tickets');
  return {date,tickets:[first,second],modelVersion:model.version,cutoffIssue:model.cutoffIssue,updatedAt:model.updatedAt,report:model.report};
}
module.exports={chinaDate,makeDaily};
