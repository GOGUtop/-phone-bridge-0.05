import {ensureWorld,hash,logWorld} from './world.mjs';

export const ROUND_SECTIONS = {offscreen:'幕后人物',world:'世界事件',voices:'心灵声音'};
export function roundPrompt() {
  return `每一轮都必须检查幕后人物、世界事件、心灵声音，不能因正文只写现场就省略。
backstage.offscreen 必须是具名镜头外人物的当前活动列表，字段 name/location/activity/goal；排除在场人物。开启自主活动时，按已知人物的人设、目标及剧情时间推进相关幕后人物的小规模日常，不得瞬移或强加重大剧情。
backstage.world 必须返回本轮外部事件变化，字段 title/detail；检查天气、社会环境、已存在事件的进展。没有变化可以 []，不要为填表制造灾难。
voices 必须返回本轮活跃 NPC 的人物心声，字段 name/content/knownBy；这是虚构人物心理，不是模型推理。心声符合人设与各自知情范围，不能代写用户心理；knownBy 默认只有本人。不得省略字段。
另返回 roundReview:{offscreen:{checked:true,reason:"本轮检查结果"},world:{checked:true,reason:"本轮检查结果"},voices:{checked:true,reason:"本轮检查结果"}}。数组为空时 reason 必须具体解释，例如无具名镜头外人物、外部事件暂无进展或没有可依据的人物心理。不能用缺字段表示无变化。`;
}
export function validateRound(payload,scene,userName) {
  const raw=payload.backstage??payload.幕后状态;
  const aliases={offscreen:'幕后人物',world:'世界事件'};
  const reviews={};
  for(const [key,title] of Object.entries(ROUND_SECTIONS)) {
    const rows=key==='voices'?(payload.voices??payload.心灵声音):(raw?.[key]??raw?.[aliases[key]]);
    if(!Array.isArray(rows))throw new Error(`${title}未返回数组，不能标记本轮同步成功`);
    const review=payload.roundReview?.[key];
    if(review?.checked!==true||!String(review.reason||'').trim())throw new Error(`${title}缺少本轮检查结果`);
    reviews[key]={checked:true,reason:String(review.reason).trim().slice(0,800)};
  }
  scene.offscreen=scene.offscreen.filter(r=>r.name&&r.name!==userName&&!scene.present.some(p=>p.name===r.name));
  if(scene.offscreen.some(r=>!r.activity&&!r.goal&&!r.location))throw new Error('幕后人物缺少活动或位置');
  if(scene.world.some(r=>!r.title||!r.detail))throw new Error('世界事件缺少标题或进展');
  const voices=(payload.voices??payload.心灵声音).map(r=>({
    name:r?.name??r?.姓名??r?.人物,content:r?.content??r?.内容??r?.心声,
  }));
  if(voices.some(r=>!r.name||!r.content||r.name===userName))throw new Error('心灵声音缺少姓名或内容，或代写了用户心理');
  return {reviews,voices:voices.map(r=>({...r,knownBy:[r.name]}))};
}
export function applyRound(phone,round,{floor,signature}) {
  const w=ensureWorld(phone).world;
  w.roundReview={floor,signature,sections:round.reviews,updatedAt:Date.now()};
  w.voices=round.voices.map(r=>({...r,id:`${signature}-voice-${hash(r.name)}`,floor,time:Date.now()}));
  for(const row of w.voices)logWorld(phone,'voices',`${row.name}的心声：${row.content}`,[row.name],`${row.id}-${hash(row.content)}`);
  for(const key of ['offscreen','world'])for(const row of phone.backstage[key]) {
    const summary=key==='offscreen'?`${row.name}：${row.location||''} ${row.activity||''} ${row.goal||''}`:`${row.title}：${row.detail}`;
    logWorld(phone,key,summary,key==='offscreen'?[row.name]:(row.knownBy||[]),`${signature}-${key}-${hash(summary)}`);
  }
  return phone;
}
