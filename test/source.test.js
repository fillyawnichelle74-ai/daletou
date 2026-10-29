const test=require('node:test'),assert=require('node:assert/strict');
const {parseOfficialResponse,fetchOfficialDraws}=require('../lib/source');
test('parses only complete official API draw rows',()=>{
  const rows=parseOfficialResponse({value:{list:[{lotteryDrawNum:'26122',lotteryDrawTime:'2026-10-26',lotteryDrawResult:'02 14 21 22 24 02 12'}]}});
  assert.equal(rows[0].issue,'26122');assert.deepEqual(rows[0].back,[2,12]);
  assert.throws(()=>parseOfficialResponse({value:{list:[]}}));
  assert.throws(()=>parseOfficialResponse('<html>blocked</html>'));
});
test('fetches pages until a known issue overlaps',async()=>{
  const row=(issue)=>({lotteryDrawNum:issue,lotteryDrawTime:'2026-10-26',lotteryDrawResult:'02 14 21 22 24 02 12'});
  const pages=[];
  const result=await fetchOfficialDraws([{issue:'26122'}],async page=>{pages.push(page);return {value:{list:[row(page===1?'26123':'26122')]}}});
  assert.deepEqual(pages,[1,2]);assert.equal(result.length,2);
});

test('rejects result lengths other than seven balls',()=>{
  for(const result of ['02 14 21 22 24 02','02 14 21 22 24 02 12 09']) {
    assert.throws(()=>parseOfficialResponse({value:{list:[{lotteryDrawNum:'26122',lotteryDrawTime:'2026-10-26',lotteryDrawResult:result}]}}));
  }
});
test('rejects illegal front and back numbers',()=>{
  for(const result of ['00 14 21 22 24 02 12','02 14 21 22 36 02 12','02 14 21 22 24 00 12','02 14 21 22 24 02 13','02 02 21 22 24 02 12','14 02 21 22 24 02 12','02 14 21 22 24 02 02']) {
    assert.throws(()=>parseOfficialResponse({value:{list:[{lotteryDrawNum:'26122',lotteryDrawTime:'2026-10-26',lotteryDrawResult:result}]}}));
  }
});

