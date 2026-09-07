import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRound,applyRound,roundPrompt} from '../round.mjs';
import {validateScene} from '../scene.mjs';
import {defaultPhoneState} from '../core.mjs';
import {extractPeople,applyWorldDelta,mergePeople} from '../world.mjs';
import {quarantineLegacyCandidates} from '../roster.mjs';
const payload=()=>({backstage:{present:[{name:'林澈'}],offscreen:[{name:'周宁',activity:'准备下班'}],world:[]},voices:[{name:'林澈',content:'快到约好的时间了',knownBy:['everyone']}],roundReview:{offscreen:{checked:true,reason:'周宁在公司'},world:{checked:true,reason:'本轮外部环境未变'},voices:{checked:true,reason:'林澈等候赴约'}}});
test('each backstage section must return explicit per-round result; omitted fields cannot mean success',()=>{
  for(const key of ['world','offscreen']){const p=payload();delete p.backstage[key];assert.throws(()=>validateRound(p,validateScene(p),'阿遥'),/未返回数组/);}
  const p=payload();delete p.voices;assert.throws(()=>validateRound(p,validateScene(p),'阿遥'),/心灵声音/);
  delete p.roundReview;assert.throws(()=>validateRound(p,validateScene(p),'阿遥'),/检查结果/);
  assert.match(roundPrompt(),/每一轮/);
});
test('round repair updates voices without repeating balances and keeps private knowledge private',()=>{
  const p=payload(),scene=validateScene(p),round=validateRound(p,scene,'阿遥');
  const phone=defaultPhoneState('林澈');phone.backstage=scene;
  applyRound(phone,round,{floor:14,signature:'fourteen'});
  assert.equal(phone.world.roundReview.floor,14);assert.deepEqual(phone.world.voices[0].knownBy,['林澈']);
  const length=phone.world.journal.length;applyRound(phone,round,{floor:14,signature:'fourteen'});
  assert.equal(phone.world.journal.length,length);assert.equal(phone.wallet.wechat,520);
  applyRound(phone,round,{floor:15,signature:'fifteen'});assert.equal(phone.world.roundReview.floor,15);
});
test('omitted voices no longer erase existing thoughts',()=>{
  let phone=defaultPhoneState();phone=applyWorldDelta(phone,{voices:[{name:'林澈',content:'旧心声'}]},{signature:'a'});
  phone=applyWorldDelta(phone,{backstage:{present:[]}},{signature:'b'});assert.equal(phone.world.voices[0].content,'旧心声');
});
test('relationship verbs are not names; explicit names still work',()=>{
  const rows=extractPeople([{name:'人物',content:'父亲携款失踪。哥哥跑货。母亲做裁缝。朋友一起堕落。朋友关系。父亲名叫林青。姓名：陈芸'}]);
  assert.deepEqual(rows.map(p=>p.name).sort(),['林青','陈芸'].sort());
});
test('legacy bogus contacts are archived without deleting their messages or balances',()=>{
  let phone=defaultPhoneState('林澈');phone=mergePeople(phone,[{name:'跑货',known:true,evidence:'哥哥跑货',source:'世界书证据'}],'阿遥');
  const c=Object.values(phone.contacts).find(r=>r.name==='跑货');phone.threads[c.id].messages.push({id:'old',text:'保留'});
  quarantineLegacyCandidates(phone);assert.equal(c.archived,true);assert.equal(phone.threads[c.id].messages.length,1);assert.equal(phone.wallet.wechat,520);
});
