const SOURCE = 'https://www.lottery.gov.cn/kj/kjlb.html?dlt';
const HISTORY_SOURCE = 'https://www.9011.com.cn/lottery/dlt';
const OFFICIAL_LATEST = 'https://www.shsportslottery.com/dlt/kjgg.html';
function sameDraw(a,b) {return a.issue===b.issue && a.date===b.date && JSON.stringify(a.front)===JSON.stringify(b.front) && JSON.stringify(a.back)===JSON.stringify(b.back);}
function normalizeDraw(draw) {
  if (!draw || !/^\d{5}$/.test(draw.issue) || !/^\d{4}-\d{2}-\d{2}$/.test(draw.date)) throw Error('Invalid issue or date');
  const parsed = new Date(`${draw.date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== draw.date) throw Error('Invalid date');
  for (const [area, count, max] of [['front',5,35],['back',2,12]]) {
    const balls = draw[area];
    if (!Array.isArray(balls) || balls.length !== count || balls.some(x => !Number.isInteger(x) || x < 1 || x > max) || new Set(balls).size !== count || balls.some((x,i)=>i && x <= balls[i-1])) throw Error(`Invalid ${area}`);
  }
  if (![SOURCE,HISTORY_SOURCE,OFFICIAL_LATEST].includes(draw.sourceUrl)) throw Error('Unrecognized source');
  return {issue:draw.issue,date:draw.date,front:[...draw.front],back:[...draw.back],sourceUrl:draw.sourceUrl};
}
function mergeDraws(existing, incoming) {
  const byIssue = new Map();
  for (const item of [...existing,...incoming]) {
    const draw = normalizeDraw(item), old = byIssue.get(draw.issue);
    if (old && !sameDraw(old,draw)) throw Error(`Conflicting issue ${draw.issue}`);
    if (!old) byIssue.set(draw.issue,draw);
  }
  const merged=[...byIssue.values()].sort((a,b)=>a.issue.localeCompare(b.issue));
  for(let i=1;i<merged.length;i++)if(merged[i].date<=merged[i-1].date)throw Error(`Date order conflict at ${merged[i].issue}`);
  return merged;
}
module.exports = {SOURCE,HISTORY_SOURCE,OFFICIAL_LATEST,sameDraw,normalizeDraw,mergeDraws};
