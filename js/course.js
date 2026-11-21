// ---------- beginner course (入門コース, docs/PLAN.md section 5) ----------
// The guide's steps, but each step shows hand-picked tasks (お題) from COURSES: one cell, two or three
// candidates taken from that step's own candidate list, and one line on why. Only the songs in COURSES.
const CFLOW = { reharm:["read","seventh","func","bass","cliche","toward","review"],
                harm:["cad","rhythm","prim","flow","widen","color"] };
const CSTEP_NAME = { read:"原曲を読む", review:"見直す", cad:GSTEPS[0], rhythm:GSTEPS[1], prim:GSTEPS[2], flow:GSTEPS[3], widen:GSTEPS[4], color:GSTEPS[5] };
const cStepName = id => CSTEP_NAME[id] || TECH[id].name;
const cMode = () => state.harm ? "harm" : "reharm";
const courseData = () => { const c=COURSES[state.songId]; return c && c[cMode()] || null; };
const courseOn = () => !!courseData() && store.get("rehamo:course")===true;
const cstepKey = () => (state.harm?"rehamo:hcstep:":"rehamo:cstep:")+state.songId;
const ctaskKey = () => (state.harm?"rehamo:htask:":"rehamo:task:")+state.songId;
const cmem = {}, cpick = {};   // open step and open task, kept for the session even when storage is off
let cmsg = null;               // the line shown after a choice: {kind, text}
const getCStep = () => Math.min(CFLOW[cMode()].length, Math.max(1, cmem[cstepKey()] || store.get(cstepKey()) || 1));
const cStepId = () => CFLOW[cMode()][getCStep()-1];
const doneSet = () => { const d=cmem[ctaskKey()] || store.get(ctaskKey()); return new Set(Array.isArray(d)?d:[]); };
function markDone(id){
  const d=doneSet(); if(d.has(id)) return false;
  d.add(id); cmem[ctaskKey()]=[...d]; store.set(ctaskKey(), [...d]); return true;
}
const stepTasks = id => (courseData()||[]).filter(t=>t.step===id);
const stepDone = id => { const ts=stepTasks(id), d=doneSet(); return ts.length>0 && ts.every(t=>d.has(t.id)); };
// the open task of the open step: the one last chosen, else the first not done, else the first
function curTask(){
  const id=cStepId(), ts=stepTasks(id), d=doneSet(), k=cpick[cstepKey()+":"+id];
  return ts.find(t=>t.id===k) || ts.find(t=>!d.has(t.id)) || ts[0] || null;
}
const beatOf = (bar, beat) => (bar-1)*song.bpb + (beat-1);
const cellAtBeat = b => state.chords.findIndex(u=>Math.abs(u.s-b)<1e-6);
const taskCell = t => t.bar ? cellAtBeat(beatOf(t.bar, t.beat)) : -1;
// a pick written as "Cmaj7", "Am7>D7" (a split cell) or "C,C7" (a run of cells) → a key comparable with a list entry
const pickKey = s => s.split(/([,>])/).map(x=>x===","||x===">" ? x : ckey(parseChord(x))).join("");
const pickLen = s => s.split(",").length;
function entryKey(it, i){
  if(it.cells) return it.cells.map(x=>ckey(x.c)).join(",");
  if(it.split) return splitPair(it,i).map(ckey).join(">");
  return ckey(it.c);
}
// the candidates the ordinary guide shows for this step at cell i, as items
function stepList(step, i){
  if(i<0) return [];
  if(TECH[step]) return rStepCands(step, i);
  const K=keyOfCell(i), P=PRIM(K), PN=PRIM_NAME(K), u=state.chords[i];
  if(step==="cad") return ["I","V"].map(k=>({c:P[k], name:PN[k], label:k==="I"?"終止":"半終止"}));
  if(step==="prim" || step==="flow") return ["I","IV","V","V7"].map(k=>({c:P[k], name:PN[k], label:PN[k]}));
  if(step==="widen") return u.root ? widenOptions(u,K).map(([c,n])=>({c, name:n, label:"代理"})) : [];
  if(step==="color") return u.root ? colorList(i).map(([c,n,l])=>({c, name:n, label:l||n.replace(/（.*）/,"")})) : [];
  return [];
}
const entryVerdict = (it, i) => TECH[it.tech] ? itemVerdict(it, i) : verdict(rolesFor(it.c, i));
// the task's picks matched against the list: {p, it (null when the list no longer has it), v}
function resolvePicks(t, i){
  const list=stepList(t.step, i);
  return (t.picks||[]).map(p=>{ const k=pickKey(p.c), it=list.find(x=>entryKey(x,i)===k)||null;
    return {p, it, v: it ? entryVerdict(it, i) : null}; });
}
// cells to light up on the score for the open task
function courseMarks(){
  const t=curTask(); if(!t) return new Set();
  if(t.spots) return new Set(t.spots.map(s=>cellAtBeat(beatOf(s.bar,s.beat))).filter(k=>k>=0));
  const i=taskCell(t); if(i<0) return new Set();
  const n=Math.max(...(t.picks||[{c:"C"}]).map(p=>pickLen(p.c)));
  return new Set(Array.from({length:n},(x,k)=>i+k).filter(k=>k<state.chords.length));
}
// the harmonize course starts from the original's cells, so each task has its cell
const gridIsOrig = () => state.chords.length===song.orig.length && state.chords.every((u,k)=>Math.abs(u.s-song.orig[k].s)<1e-6 && Math.abs(u.l-song.orig[k].l)<1e-6);
const emptyOrigGrid = () => song.orig.map(u=>({s:u.s, l:u.l, root:null, q:null}));
function openTask(t){
  cmsg=null; if(!t) return;
  cpick[cstepKey()+":"+t.step]=t.id;
  const i = t.spots ? cellAtBeat(beatOf(t.spots[0].bar, t.spots[0].beat)) : taskCell(t);
  if(i>=0) state.sel=i;
}
function goCStep(s){
  cmem[cstepKey()]=s; store.set(cstepKey(), s); cmsg=null;
  openTask(curTask()); const el=$("#insp"); if(el) el.scrollTop=0; render();
}
// play the four bars around the selected cell once, with the given cells (the score marks where it is)
function playCourse(cells){
  const {b0,b1}=cmpRange(), from=cells.findIndex(x=>x.s+x.l>b0+1e-6), to=cells.findIndex(x=>x.s>=b1-1e-6);
  playRange(Math.max(0,from), to<0?cells.length:to, cells, "ccmp");
}
// {n:E} → a note name and {c:G7} → a chord symbol in the chosen key (the data is written in the C frame)
const sayText = s => String(s||"").replace(/\{n:([^}]+)\}/g, (m,x)=>droot(x)).replace(/\{c:([^}]+)\}/g, (m,x)=>sym(parseChord(x)));
const COURSE_PLAY = new Set(["ccmp","corig","orig","all"]);
// apply a pick to a copy of the cells (to sound a clashing example without placing it)
function applyToCopy(it, i){
  const U=JSON.parse(JSON.stringify(state.chords));
  const put=(k,c)=>{ const u=U[k]; U[k]={s:u.s, l:u.l, root:c.root, q:c.q, ...(c.bass?{bass:c.bass}:{})}; };
  if(it.cells) it.cells.forEach(x=>put(x.i, x.c)); else if(!it.split) put(i, it.c);
  return U;
}
function placeEntry(t, it, i){
  if(TECH[t.step]) applyItem(i, it); else setChord(i, it.c, it.label||"");
}

// ---- panel ----
function courseSwitchHtml(){
  const ok=!!courseData(), on=courseOn();
  return `<div class="cswitch" role="group" aria-label="ガイドの種類">
    <button class="btn small${on?" primary":""}" data-course="1" aria-pressed="${on}" ${ok?"":"disabled"}>入門</button>
    <button class="btn small${on?"":" primary"}" data-course="0" aria-pressed="${!on}">ふつう</button>
    ${ok?"":`<span class="hint">入門コースは、入門の4曲で使えます。</span>`}</div>`;
}
function courseHtml(){
  const flow=CFLOW[cMode()], step=getCStep(), id=flow[step-1], n=flow.length, i=state.sel, d=doneSet();
  let h=`<div class="revbox course">
    <ol class="steps gsteps">${flow.map((s,k)=>`<li class="${k+1===step?"on":""}${stepDone(s)?" done":""}"><button data-cs="${k+1}" title="${cStepName(s)}" aria-label="ステップ${k+1}：${cStepName(s)}${stepDone(s)?"（済み）":""}"${k+1===step?' aria-current="step"':""}></button></li>`).join("")}</ol>
    <h3 class="gtitle"><small>入門・ステップ ${step} / ${n}</small>${cStepName(id)}</h3>`;
  if(state.harm && !gridIsOrig()){
    h+=`<p class="hint">入門コースは、原曲と同じ枠（コードは空）から始めます。いまの案にはコードが入っているので、新しい案で始めます。</p>
      <div class="gbtns"><button class="btn primary" id="cGrid" ${plans.list.length<PLAN_MAX?"":"disabled"}>新しい案で始める</button></div>
      ${plans.list.length<PLAN_MAX?"":`<p class="hint">案がいっぱいです。使わない案を消してください。</p>`}</div>`;
    return h;
  }
  const ts=stepTasks(id), t=curTask();
  if(ts.length>1 || (ts.length===1 && ts[0].bar)) h+=`<div class="ctasks">${ts.map((x,k)=>`<button class="chip${x===t?" on":""}${d.has(x.id)?" done":""}" data-ct="${x.id}">お題 ${k+1}${d.has(x.id)?" ✓":""}</button>`).join("")}</div>`;
  if(t) h+=courseTaskHtml(t, i);
  if(id==="prim") h+=fillBtnHtml();   // shown whatever the task's state, so the later steps can start from full cells
  const pv=cMove(-1), nx=cMove(1);
  h+=`<div class="gbtns"><button class="btn small" id="cStop" ${play&&COURSE_PLAY.has(play.mode)?"":"hidden"}>■ 再生を止める</button></div>`;
  h+=`<div class="gnav"><button class="btn" id="cPrev" ${pv?"":"disabled"}>← 前へ${pv?`<small>（${esc(pv.label)}）</small>`:""}</button><span class="sp"></span>
    <button class="btn primary" id="cNext" ${nx?"":"disabled"}>次へ →${nx?`<small>（${esc(nx.label)}）</small>`:""}</button></div>
    <div class="creset"><button class="linkbtn" id="cReset">入門の記録を消す</button>
      <span class="confirm" id="cResetConfirm" hidden>この曲の入門の記録（済んだお題と、開いていたステップ）を消しますか？楽譜のコードはそのままです。
        <button class="btn small warn" id="cResetYes">消す</button><button class="btn small" id="cResetNo">やめる</button></span></div></div>`;
  return h;
}
// where "次へ" / "前へ" go: the next task of this step, else the next step (its first task, or its last going back)
function cMove(dir){
  const flow=CFLOW[cMode()], step=getCStep(), ts=stepTasks(cStepId()), t=curTask(), k=ts.indexOf(t);
  if(k+dir>=0 && k+dir<ts.length) return {task:ts[k+dir], step, label:`お題 ${k+dir+1}`};
  const s=step+dir; if(s<1 || s>flow.length) return null;
  const ns=stepTasks(flow[s-1]), nt=dir>0 ? ns[0] : ns[ns.length-1];
  return {task:nt, step:s, label:`ステップ ${s}`};
}
function cmsgHtml(){ return cmsg ? `<p class="cmsg ${cmsg.kind}">${esc(cmsg.text)}</p>` : ""; }
function courseTaskHtml(t, i){
  const d=doneSet(), done=d.has(t.id);
  if(t.step==="read"){
    return `<p class="hint">${glossed("フレーズの終わり方を聴き比べます。楽譜で光っている2か所です。")}</p>
      <div class="cspots">${t.spots.map((s,k)=>`<div class="gitem"><b>${s.bar}小節目</b>
        <div class="gbtns"><button class="btn small" data-hear="${k}">▶ 聴く</button><button class="btn small" data-end="${k}">こちらが終わった感じ</button></div></div>`).join("")}</div>
      ${done?`<p class="cmsg good">✓ ${glossed(sayText(t.say))}</p>`:cmsgHtml()}`;
  }
  if(t.step==="rhythm") return `<p class="hint">${glossed(sayText(t.say))}</p><p class="hint">入門では、はじめから原曲と同じ枠にしてあります。</p>`;
  if(t.step==="review") return reviewHtml();
  if(t.step==="flow") return flowTaskHtml(i);
  const ti=taskCell(t);
  if(ti<0) return `<p class="hint">この枠の区切りが原曲と違うので、このお題はできません。「次へ」で先へ進んでください。</p>`;
  const marks=courseMarks();
  if(!marks.has(i)) return offTaskHtml(t, i);
  let h=`<p class="hint"><b>${slotName(ti)}</b>：${glossed(sayText(t.say))}</p>`;
  if(done){
    h+=`<p class="cmsg good">✓ このお題は済みました。いまのコード：${esc(sym(state.chords[ti]))}</p>${cmsgHtml()}
      <div class="gbtns"><button class="btn small" id="cRedo">このお題をもう一度</button></div>
      <p class="hint">「次へ」で、次のお題に進みます。</p>`;
    return h;
  }
  if(t.need && !same(state.chords[ti], parseChord(t.need))){
    const nc=parseChord(t.need);
    return h+`<p class="hint">このお題は、この枠が ${esc(sym(nc))} のときにできます。</p>
      <div class="gbtns"><button class="btn small primary" id="cNeed">この枠を ${esc(sym(nc))} にする</button></div>`;
  }
  const rp=resolvePicks(t, ti);
  if(rp.some(r=>!r.it)){
    return h+`<p class="hint">この枠のコードが変わっているので、お題の候補が出せません。原曲のコードに戻すと、このお題ができます。</p>
      <div class="gbtns"><button class="btn small primary" id="cBack">原曲のコードに戻す</button></div>`;
  }
  h+=`<div class="cands revopts">${rp.map((r,k)=>courseCand(r, ti, k)).join("")}</div>${cmsgHtml()}
    <p class="hint">済ませなくても「次へ」で先へ進めます。</p>`;
  return h;
}
function courseCand(r, i, k){
  const mark = r.p.best ? `<span class="cbest">★ おすすめ</span>` : r.p.bad ? `<span class="cbad">合わない例</span>` : "";
  const it=r.it, attrs=`data-cp="${k}"`;
  return TECH[it.tech] ? candItem(it, i, attrs).replace(/<\/button>$/, mark+"</button>")
                       : candButton(it.c, i, attrs, `<span class="oname">${esc(it.name)}</span>${mark}`);
}
function fillBtnHtml(){
  const empt=state.chords.filter(u=>!u.root).length;
  return empt ? `<p class="hint">お題が済んだら、残りの枠は自分で埋めるか、原曲のコードを入れて先へ進めます。</p>
    <div class="gbtns"><button class="btn small" id="cEmpty">次に決める枠へ</button><button class="btn small" id="cFill">残りの枠（${empt}）に原曲のコードを入れる</button></div>` : "";
}
// a cell that is not the task's: this step's ordinary candidates for it, and a way back
function offTaskHtml(t, i){
  const list=stepList(t.step, i);
  return `<p class="hint">この枠はお題ではありません。${list.length?"このステップの候補を、ここでも試せます。":""}</p>
    ${list.length?`<div class="cands revopts">${list.map((it,k)=>TECH[it.tech]?candItem(it,i,`data-oc="${k}"`):candButton(it.c,i,`data-oc="${k}"`,`<span class="oname">${esc(it.name)}</span>`)).join("")}</div>`:""}
    <div class="gbtns"><button class="btn small primary" id="cBackTask">お題に戻る</button></div>`;
}
function flowTaskHtml(i){
  const iss=flowIssues();
  if(!iss.length) return `<p class="cmsg good">✓ 気になる点はありません。コードの機能が T → S → D → T の流れになっています。</p>`;
  const x=iss[0], list=stepList("flow", i);
  return `<p class="hint">${glossed("コードの機能（T・S・D）の流れで、気になる所を1つずつ直します。")}</p>
    <ul class="issues"><li class="${x.kind}"><button data-go="${x.i}">${esc(x.text)}</button></li></ul>
    ${i===x.i?`<div class="cands">${list.map((it,k)=>candButton(it.c,i,`data-oc="${k}"`,`<span class="oname">${esc(it.name)}</span>`)).join("")}</div>`:`<div class="gbtns"><button class="btn small primary" data-go="${x.i}">その枠を選ぶ</button></div>`}
    ${iss.length>1?`<p class="hint">ほかに ${iss.length-1} か所あります。</p>`:""}`;
}
function reviewHtml(){
  const n=state.chords.length, changed=state.chords.filter((u,k)=>isChanged(k)).length;
  const bads=state.chords.map((u,k)=>k).filter(k=>state.chords[k].root && verdict(rolesFor(state.chords[k],k))==="bad");
  return `<p class="hint">変えたのは ${n} 枠のうち ${changed} 枠です。原曲と、いまの案を通して聴き比べましょう。</p>
    ${bads.length?`<ul class="issues">${bads.map(k=>`<li class="bad"><button data-go="${k}">${esc(slotName(k))}：骨格の音が ${esc(sym(state.chords[k]))} とぶつかっています。</button></li>`).join("")}</ul>`:""}
    <div class="gbtns"><button class="btn small" id="cHearO">${play&&play.mode==="orig"?"■ 停止":"▶ 原曲を聴く"}</button><button class="btn small" id="cHearN">${play&&play.mode==="all"?"■ 停止":"▶ いまの案を聴く"}</button></div>`;
}

function bindCourseSwitch(el){
  el.querySelectorAll("[data-course]").forEach(b=>b.onclick=()=>{
    const on=b.dataset.course==="1"; store.set("rehamo:course", on); cmsg=null;
    if(on){ openTask(curTask()); } render(); });
}
function bindCourse(el){
  const step=getCStep(), id=cStepId(), t=curTask(), i=state.sel;
  // an empty harmonize plan is simply given the original's cells (recorded for Undo)
  if(state.harm && !gridIsOrig() && state.chords.every(u=>!u.root)){ state.chords=emptyOrigGrid(); save(); openTask(t); render(); return; }
  const cg=$("#cGrid"); if(cg) cg.onclick=()=>{ newPlan(); state.chords=emptyOrigGrid(); save(); openTask(curTask()); render(); };
  el.querySelectorAll("[data-cs]").forEach(b=>b.onclick=()=>goCStep(+b.dataset.cs));
  const move = m => { if(!m) return; if(m.step!==step){ cmem[cstepKey()]=m.step; store.set(cstepKey(), m.step); }
    openTask(m.task); const pe=$("#insp"); if(pe) pe.scrollTop=0; render(); };
  const cp=$("#cPrev"), cn=$("#cNext");
  if(cp) cp.onclick=()=>move(cMove(-1));
  if(cn) cn.onclick=()=>move(cMove(1));
  const crs=$("#cReset"), crc=$("#cResetConfirm");
  if(crs) crs.onclick=()=>{ crc.hidden=false; crs.hidden=true; };
  const cry=$("#cResetYes"), crn=$("#cResetNo");
  if(crn) crn.onclick=()=>{ crc.hidden=true; crs.hidden=false; };
  if(cry) cry.onclick=()=>{ resetCourse(); };
  el.querySelectorAll("[data-ct]").forEach(b=>b.onclick=()=>{ openTask(stepTasks(id).find(x=>x.id===b.dataset.ct)); render(); });
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>selectCell(+b.dataset.go));
  if(!t) return;
  // steps that are done by being seen, or by their state
  if(t.step==="rhythm" || t.step==="review") markDone(t.id);
  if(t.step==="flow" && !flowIssues().length) markDone(t.id);
  if(t.step==="read"){
    el.querySelectorAll("[data-hear]").forEach(b=>b.onclick=()=>{ const s=t.spots[+b.dataset.hear], ou=origUnits(), e=beatOf(s.bar,s.beat);
      const ph=phrases().find(p=>e>=p.from*song.bpb-1e-6 && e<(p.to+1)*song.bpb-1e-6), a=ph?ph.from*song.bpb:0;
      const from=Math.max(0, ou.findIndex(x=>x.s+x.l>a+1e-6)), to=ou.findIndex(x=>x.s>e+1e-6);
      playRange(from, to<0?ou.length:to, ou, "corig"); });
    el.querySelectorAll("[data-end]").forEach(b=>b.onclick=()=>{ const s=t.spots[+b.dataset.end];
      if(s.end){ markDone(t.id); cmsg=null; } else cmsg={kind:"warn", text:"もう一度、2つを聴き比べてみましょう。終わった感じがするのは、どちらでしょう。"};
      renderInsp(); render(); });
    return;
  }
  const ti=taskCell(t);
  el.querySelectorAll("[data-oc]").forEach(b=>b.onclick=()=>{ const it=stepList(t.step==="flow"?"flow":t.step, i)[+b.dataset.oc];
    placeEntry(t.step==="flow"?{step:"prim"}:t, it, i); previewSel(); });
  const bt=$("#cBackTask"); if(bt) bt.onclick=()=>{ openTask(t); render(); };
  const ho=$("#cHearO"), hn=$("#cHearN");
  if(ho) ho.onclick=()=>{ if(play&&play.mode==="orig") stop(); else { const ou=origUnits(); playRange(0,ou.length,ou,"orig"); } };
  if(hn) hn.onclick=()=>{ if(play&&play.mode==="all") stop(); else playRange(0,state.chords.length,state.chords,"all"); };
  const cst=$("#cStop"); if(cst) cst.onclick=()=>stop();
  if(ti<0) return;
  const cneed=$("#cNeed"); if(cneed) cneed.onclick=()=>{ setChord(ti, parseChord(t.need), ""); };
  const cb=$("#cBack"); if(cb) cb.onclick=()=>{ if(state.harm) setChord(ti, origAt(ti), "");
    else { const n=Math.max(...t.picks.map(p=>pickLen(p.c))); for(let k=ti+n-1;k>=ti;k--) if(state.chords[k]) restoreOrig(k); render(); } };
  const cr=$("#cRedo"); if(cr) cr.onclick=()=>{
    const d=doneSet(); d.delete(t.id); cmem[ctaskKey()]=[...d]; store.set(ctaskKey(), [...d]); cmsg=null;
    if(state.harm && t.need) setChord(ti, parseChord(t.need), "");
    else if(state.harm){ const u=state.chords[ti]; state.chords[ti]={s:u.s,l:u.l,root:null,q:null}; save(); render(); }
    else { const n=Math.max(...t.picks.map(p=>pickLen(p.c))); for(let k=ti+n-1;k>=ti;k--) if(state.chords[k]) restoreOrig(k); render(); } };
  const rp = ti===i ? resolvePicks(t, ti) : [];
  el.querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>{ const r=rp[+b.dataset.cp]; if(!r||!r.it) return;
    if(r.p.bad){
      // sound the clash without placing it: the score keeps the chord it had
      const U=applyToCopy(r.it, ti); const {b0,b1}=cmpRange();
      const from=Math.max(0,U.findIndex(x=>x.s+x.l>b0+1e-6)), to=U.findIndex(x=>x.s>=b1-1e-6);
      playRange(from, to<0?U.length:to, U, "ccmp");
      cmsg={kind:"bad", text:`✕ ${entryLabel(r.it, ti)}：${sayText(r.p.why)||"骨格の音とぶつかります。"}（楽譜のコードは変えていません。いま鳴らしています）`};
      renderInsp(); return;
    }
    const label=entryLabel(r.it, ti);
    placeEntry(t, r.it, ti); markDone(t.id);
    cmsg={kind:"good", text:`${label} を置きました。前後の小節を鳴らします。原曲と比べるときは、上の「聴き比べ」の「▶ 原曲」を押します。`};
    state.sel=ti; render(); playCourse(state.chords); });
  const ce=$("#cEmpty"); if(ce) ce.onclick=()=>{ const k=fillOrder().find(j=>j!==i && !state.chords[j].root); if(k!=null) selectCell(k); };
  const cf=$("#cFill"); if(cf) cf.onclick=()=>{
    state.chords.forEach((u,k)=>{ if(u.root) return; const o=origAt(k); state.chords[k]={s:u.s, l:u.l, root:o.root, q:o.q, ...(o.bass?{bass:o.bass}:{}), tech:"原曲"}; });
    save(); render(); };
}
// forget this song's course progress in the open mode (the chords are left alone: Undo and the plans cover those)
function resetCourse(){
  try{ localStorage.removeItem(ctaskKey()); localStorage.removeItem(cstepKey()); }catch(e){}
  delete cmem[ctaskKey()]; delete cmem[cstepKey()];
  CFLOW[cMode()].forEach(id=>delete cpick[cstepKey()+":"+id]);
  cmsg=null; openTask(curTask()); render();
}
function entryLabel(it, i){
  if(it.cells) return it.cells.map(x=>sym(x.c)).join(" → ");
  if(it.split) return splitPair(it,i).map(sym).join(" → ");
  return sym(it.c);
}
