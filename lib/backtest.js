const {fitWeights,setLogProbability}=require('./model');
const GRID=[1,.995,.98].flatMap(lambda=>[25,100,400].map(priorDraws=>({lambda,priorDraws})));
const UNIFORM=-Math.log(324632)-Math.log(66);
function score(draws,end,params,draw) {
  const past=draws.slice(0,end);
  return setLogProbability(fitWeights(past,'front',params.lambda,params.priorDraws),draw.front)+setLogProbability(fitWeights(past,'back',params.lambda,params.priorDraws),draw.back)-UNIFORM;
}
function trainAndEvaluate(draws) {
  if(draws.length<300)throw Error('At least 300 validated draws required');
  const split=draws.length-100;
  const candidates=GRID.map(params=>{
    let sum=0,count=0;
    for(let t=100;t<split;t++){sum+=score(draws,t,params,draws[t]);count++;}
    return {...params,validationMean:sum/count};
  });
  candidates.sort((a,b)=>b.validationMean-a.validationMean);
  const chosen=candidates[0],diffs=[],testCutoffs=[];
  for(let t=split;t<draws.length;t++){diffs.push(score(draws,t,chosen,draws[t]));testCutoffs.push(draws[t-1].issue);}
  const mean=diffs.reduce((a,b)=>a+b,0)/diffs.length;
  const variance=diffs.reduce((a,b)=>a+(b-mean)**2,0)/(diffs.length-1);
  const margin=1.96*Math.sqrt(variance/diffs.length);
  const model={lambda:chosen.lambda,priorDraws:chosen.priorDraws,frontWeights:fitWeights(draws,'front',chosen.lambda,chosen.priorDraws),backWeights:fitWeights(draws,'back',chosen.lambda,chosen.priorDraws),cutoffIssue:draws.at(-1).issue,trainDrawCount:draws.length};
  const report={validationCount:split-100,holdoutCount:100,meanLogScoreDifference:mean,interval95:[mean-margin,mean+margin],uniformLogScore:UNIFORM,testCutoffs};
  return {model,report};
}
module.exports={trainAndEvaluate,GRID};
