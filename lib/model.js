function fitWeights(draws,area,lambda,priorDraws) {
  if (!['front','back'].includes(area) || !(lambda>0&&lambda<=1) || !(priorDraws>0)) throw Error('Invalid model parameters');
  const n=area==='front'?35:12,k=area==='front'?5:2;
  const weights=Array(n).fill(priorDraws*k/n);
  for(const draw of draws) {
    for(let i=0;i<n;i++)weights[i]=priorDraws*k/n+(weights[i]-priorDraws*k/n)*lambda;
    for(const ball of draw[area])weights[ball-1]++;
  }
  return weights;
}
function suffixTable(weights,k) {
  const n=weights.length,dp=Array.from({length:n+1},()=>Array(k+1).fill(0));dp[n][0]=1;
  for(let i=n-1;i>=0;i--){dp[i][0]=1;for(let j=1;j<=k;j++)dp[i][j]=dp[i+1][j]+weights[i]*dp[i+1][j-1];}
  return dp;
}
function setLogProbability(weights,chosen) {
  if(!Array.isArray(weights)||weights.some(x=>!(x>0))||!Array.isArray(chosen)||new Set(chosen).size!==chosen.length||chosen.some(x=>!Number.isInteger(x)||x<1||x>weights.length))throw Error('Invalid subset');
  return chosen.reduce((sum,x)=>sum+Math.log(weights[x-1]),0)-Math.log(suffixTable(weights,chosen.length)[0][chosen.length]);
}
function sampleSet(weights,k,rng=Math.random) {
  if(!Array.isArray(weights)||weights.some(x=>!(x>0))||!Number.isInteger(k)||k<1||k>weights.length)throw Error('Invalid sampling weights');
  const dp=suffixTable(weights,k),chosen=[];let need=k;
  for(let i=0;i<weights.length&&need;i++){
    const p=weights[i]*dp[i+1][need-1]/dp[i][need],u=rng();
    if(!(u>=0&&u<1))throw Error('Invalid random value');
    if(u<p){chosen.push(i+1);need--;}
  }
  if(need)throw Error('Sampling failed');
  return chosen;
}
module.exports={fitWeights,setLogProbability,sampleSet};
