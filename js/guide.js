// The right-hand panel: selected-cell bar, candidates, 逆算, and the two step-by-step guides.
// ---------- backward (逆算) helpers ----------
const MOTION = {0:"同じ音",1:"半音上行",2:"全音上行",3:"短3度上行",4:"長3度上行",5:"5度下行（強進行）",6:"増4度",7:"5度上行",8:"長3度下行",9:"短3度下行",10:"全音下行",11:"半音下行"};
const motion = (a,b) => MOTION[mod(bassPc(b)-bassPc(a))];
const pcsOf = c => Object.keys(Q[c.q].ct).map(iv=>mod(rootPc(c.root)+ +iv));
const commonTones = (a,b) => { const s=new Set(pcsOf(a)); return pcsOf(b).filter(p=>s.has(p)).length; };
function approachOptions(X, toTarget){
  const out=[], minorX=isMinorish(X.q), up=(steps,semis,q)=>({root:upIv(X.root,steps,semis), q});
  if(isDomQ(X.q)){
    out.push({c:up(4,7, X.q==="7b9"?"m7b5":"m7"), short:"IIm7", name:"リレイテッド II", why:`${sym(X)} と組んで II–V を作る。`});
    out.push({c:up(4,7,"7"), short:"V7/V", name:"ドミナントの連鎖", why:`${sym(X)} をさらにドミナントで引き寄せる（5度圏をさかのぼる）。`});
    out.push({c:up(1,1,"7"), short:"♭II7", name:"裏コード", why:`ベースが半音下行で ${sym(X)} へ。`});
  } else {
    out.push({c:up(4,7, minorX?"7b9":"7"), short:"V7", name:"ドミナント", why:`${sym(X)} の5度上の 7th。5度下行で解決する。`});
    out.push({c:up(1,1,"7"), short:"♭II7", name:"裏コード", why:`V7 の代わり。ベースが半音下行で ${sym(X)} へ。`});
    out.push({c:up(4,7,"7sus4"), short:"V7sus4", name:"サスフォー", why:"3度を4度に替えて、解決を少し引き延ばす。"});
    if(minorX) out.push({c:up(1,2,"m7b5"), short:"IIm7(♭5)", name:"II（短調）", why:"V を挟まず、II から直接向かう。"});
    else out.push({c:up(1,2,"m7"), short:"IIm7", name:"II", why:"V を挟まず、II から直接向かう（後で間に V を入れてもよい）。"});
    if(toTarget){
      out.push({c:up(6,11,"dim7"), short:"VII°7", name:"導音の減七", why:"ベースが半音上行で解決する。"});
      out.push({c:up(3,5,"m6"), short:"IVm6", name:"サブドミナント・マイナー", why:"同主短調の IV。柔らかく、少し切ない解決。"});
      out.push({c:up(6,10,"7"), short:"♭VII7", name:"バックドア", why:"IVm 系の 7th。全音上行でやわらかく解決する。"});
    }
  }
  return out;
}
function phraseEnds(){   // the cell that holds each phrase's last melody note
  const out=[]; phrases().forEach(p=>{ if(p.end>=0 && !out.includes(p.end)) out.push(p.end); });
  return out;
}

// One line about the selected chord against the melody; the per-note detail is on the score itself.
function verdictMsg(roles,v){
  const names = list => [...new Map(list.map(r=>[r.name, `${esc(r.name)}（${esc(r.label)}・${KIND_TEXT[r.kind]}）`])).values()].join("、");
  const clash = r => r.kind==="av"||r.kind==="nc";
  if(v==="none") return "コードを置くと、音符の色と下の数字で、各音がそのコードの何度になるかがわかります。";
  if(v==="bad") return `骨格の音 ${names(roles.filter(r=>clash(r)&&r.strong&&!r.passing))} がぶつかっています。狙った緊張か、聴いて確かめましょう。`;
  if(v==="ok") return `短い音 ${names(roles.filter(r=>clash(r)&&!r.strong&&!r.passing))} は、通り過ぎる音として聞こえれば問題ありません。`;
  return "メロディはこのコードによく収まっています。";
}
function selbarHtml(i){
  const c=state.chords[i], o=origAt(i), next=state.chords[i+1];
  const roles=rolesFor(c,i), v=verdict(roles);
  const K=keyOfCell(i), fc = c.root ? c : (state.harm ? null : o), A=analyze(fc,K,next), away=K.tonic!=="C";
  return `<div class="selrow">
    <span class="ilabel">${slotName(i)}</span>
    <span class="selchord">${esc(sym(c))}</span>
    <div class="imeta">${state.harm&&!state.reveal?"":`<span>原曲 <b>${esc(sym(o))}</b></span>`}<span>${termBtn("fn","機能")} ${fnText(A)}</span>${A.roman?`<span>${termBtn("deg","度数")} <b>${esc(A.roman)}</b>${A.alt?`（${esc(A.alt)}）`:""}</span>`:""}${away?`<span>ここは <b>${esc(droot(K.tonic))}${K.minor?"m":""}</b> に転調中</span>`:""}<span>次 <b>${next?esc(sym(next)):"（終わり）"}</b></span></div>
    <span class="selbtns">
      <button class="btn" id="hearPrev">${play&&play.mode==="prevbar"?"■ 停止":"▶ 前小節から"}</button>
      <button class="btn primary" id="hearHere">${play&&play.mode==="here"?"■ 停止":"▶ ここから"}</button>
      <button class="btn" id="splitBtn" ${c.l<2?"disabled":""} title="この枠を2つに分けて、別々のコードを置けるようにする">枠を分割</button>
      <button class="btn" id="mergeBtn" ${canMerge(i)?"":"disabled"} title="次の枠とまとめて1つにする">次と結合</button>
      ${state.harm?`<button class="btn" id="revert" ${c.root?"":"disabled"}>コードを消す</button>`:`<button class="btn" id="revert" ${isChanged(i)?"":"disabled"}>原曲に戻す</button>`}
    </span>
  </div>
  <div class="rolerow"><span class="pill ${v}">${VERDICT_TEXT[v]}</span><span class="vmsg">${verdictMsg(roles,v)}</span>
    ${state.harm&&!state.reveal?"":`<span class="cmpset" title="選んだ枠のまわり4小節を聴き比べます">聴き比べ <button class="btn small" id="selCmpO">▶ 原曲</button><button class="btn small" id="selCmpN">▶ いま</button></span>`}</div>`;
}
function candButton(cd, i, attrs, extra){
  const rs=rolesFor(cd,i), vv=verdict(rs);
  return `<button class="cand${same(cd,state.chords[i])?" cur":""}" ${attrs} title="${VERDICT_TEXT[vv]}">
    <span class="cn">${esc(sym(cd))}<i class="dot ${vv}"></i></span>${extra||""}
    <span class="degs">${degsHtml(rs)}</span></button>`;
}
// the cell's melody notes as degree labels only, in order of appearance (one per note name)
function degsHtml(rs){
  const seen=new Set();
  return rs.filter(r=>!seen.has(r.name) && seen.add(r.name)).map(r=>`<b class="c-${r.kind}${r.strong?"":" weak"}">${esc(r.label)}</b>`).join("");
}
function candItem(it, i, attrs){
  if(it.cells){ const vv=itemVerdict(it,i);
    return `<button class="cand" ${attrs} title="${VERDICT_TEXT[vv]}">
      <span class="cn">${it.cells.map(x=>esc(sym(x.c))).join('<span class="arr">→</span>')}<i class="dot ${vv}"></i></span>
      <span class="oname">${esc(it.name)}</span><span class="owhy">${slotName(it.cells[0].i)}から ${it.cells.length} 枠にまとめて入ります</span></button>`; }
  if(!it.split) return candButton(it.c, i, attrs, it.name?`<span class="oname">${esc(it.name)}</span>`:"");
  const [c1,c2]=splitPair(it,i), vv=itemVerdict(it,i);
  return `<button class="cand" ${attrs} title="${VERDICT_TEXT[vv]}">
    <span class="cn">${esc(sym(c1))}<span class="arr">→</span>${esc(sym(c2))}<i class="dot ${vv}"></i></span>
    <span class="oname">${esc(it.name)}</span><span class="owhy">枠を2つに分けます</span></button>`;
}
function candHtml(i){
  const c=state.chords[i], o=origAt(i);
  let h = `<div><h2>${state.harm?"コード候補":"置き換え候補"}<span>${slotName(i)}${!state.harm||state.reveal?`（原曲 ${esc(sym(o))}）`:""}</span></h2><div class="groups">`;
  suggest(i).forEach((g,gi)=>{
    h+=`<div class="grp"><details data-tech="${esc(g.tech)}"${openTech.has(g.tech)?" open":""}><summary>${esc(g.title)}</summary><p>${glossed(esc(g.desc))}</p></details><div class="cands">`;
    g.items.forEach((it,ci)=>{ h+=candItem(it,i,`data-g="${gi}" data-c="${ci}"`); });
    h+=`</div></div>`;
  });
  h+=`</div></div>
  <div><h2>自分で入力</h2><div class="manual">
    <select id="mRoot" aria-label="根音">${MANUAL_ROOTS.map(r=>`<option value="${r}"${c.root&&rootPc(r)===rootPc(c.root)?" selected":""}>${droot(r)}</option>`).join("")}</select>
    <select id="mQual" aria-label="種類">${Object.keys(Q).map(k=>`<option value="${k}"${k===c.q?" selected":""}>${k===""?"（メジャー）":esc(Q[k].show)}</option>`).join("")}</select>
    <select id="mBass" aria-label="ベース"><option value="">ベース指定なし</option>${MANUAL_ROOTS.map(r=>`<option value="${r}"${c.bass&&rootPc(r)===rootPc(c.bass)?" selected":""}>/${droot(r)}</option>`).join("")}</select>
    <button class="btn" id="mApply">置く</button>
  </div><p class="hint" style="margin-top:6px">候補を押すとその枠に置き、次の枠までを再生します。</p></div>`;
  return h;
}
function revHtml(){
  const i=state.sel;
  if(rev.target==null){
    const ends=phraseEnds();
    return `<div class="revbox">
      <h2>逆算<span>着地点を決めて、そこへ向かうコードを手前に積んでいく</span></h2>
      <ol class="steps"><li class="on">着地点（一時的な I）を決める</li><li>直前に、着地点へ向かうコードを置く</li><li>さらに手前へさかのぼる</li></ol>
      <p class="hint">着地点のコードが、そのまま「I」になります。IIm や IV を選べば、そのコードへのセカンダリードミナントを作る練習になります。</p>
      <p class="hint">4和音化・代理・借用など、着地点へ向かう以外の色づけは「置き換え候補」タブで行います。</p>
      <div class="revsel"><span>選んでいる枠：<b>${slotName(i)}</b> の <b class="cn">${esc(sym(state.chords[i]))}</b></span>
        <button class="btn primary" id="setTarget" ${i===0||!state.chords[i].root?"disabled":""}>この枠を着地点にする</button></div>
      ${i===0?`<p class="hint">最初の枠は、手前に枠がないので着地点にできません。</p>`:""}
      ${state.chords[i].root?"":`<p class="hint">この枠にはまだコードがありません。先に「置き換え候補」タブでコードを置いてから着地点にしてください。</p>`}
      <h3 class="sub">おすすめの着地点（フレーズの終わり）</h3>
      <div class="cands">${ends.filter(e=>state.chords[e].root).map(e=>`<button class="cand tgtpick" data-t="${e}"><span class="cn">${esc(sym(state.chords[e]))}</span><span class="small">${slotName(e)}</span></button>`).join("")}</div>
    </div>`;
  }
  const t=rev.target, last = rev.chain.length? rev.chain[rev.chain.length-1].i : t, p=last-1, X=state.chords[last];
  const order=[...rev.chain].reverse().map(e=>e.i).concat([t]);
  let h=`<div class="revbox">
    <h2>逆算<span>着地点 ${slotName(t)} の ${esc(sym(state.chords[t]))} を I とみなす</span></h2>
    <div class="chainrow">${order.map((k,j)=>`<span class="clink${k===t?" t":""}">${esc(sym(state.chords[k]))}${k===t?"<small>I</small>":""}</span>${j<order.length-1?'<span class="arr">→</span>':""}`).join("")}</div>
    <div class="irow">
      <button class="btn" id="revPlay">▶ 流れを聴く</button>
      <button class="btn" id="revUndo" ${rev.chain.length?"":"disabled"}>一つ戻す</button>
      <button class="btn" id="revReset">着地点を選び直す</button>
    </div>`;
  if(p<0){ h+=`<p class="hint">曲の頭まで来ました。これ以上さかのぼれません。</p></div>`; return h; }
  const P=state.chords[p];
  h+=`<h3 class="sub">ステップ ${rev.chain.length+1}：${slotName(p)} に、${esc(sym(X))} へ向かうコードを置く</h3>
    <p class="hint">いまの入口：${P.root?`${esc(sym(P))} → ${esc(sym(X))}（ベース ${motion(P,X)}・共通音 ${commonTones(P,X)} 個）`:`まだコードのない枠 → ${esc(sym(X))}`}</p>
    ${P.l>=2?`<button class="btn small" id="revSplit">この枠を分割して、後半に置く</button>`:""}
    <div class="cands revopts">`;
  approachOptions(X, last===t).forEach((o,k)=>{
    h+=candButton(o.c, p, `data-o="${k}"`, `<span class="oname">${esc(o.short)}・${esc(o.name)}</span><span class="owhy">${esc(o.why)}<br>ベース ${motion(o.c,X)}</span>`);
  });
  h+=`</div><p class="hint">置いたあとは、同じ要領でさらに手前へ進めます。元の流れに戻したいところで止めて、「いまの入口」のつながりを確かめてください。</p></div>`;
  return h;
}

// ---------- guide (harmonize step by step) ----------
const GSTEPS = ["区切りと終わり方","コードを変える間隔","I・IV・V で埋める","流れを確かめる","ダイアトニック・コードを広げる","向かうコードと色づけ"];
const PRIM = K => { const m=K.minor?"m":""; return {I:KC(K,"C",m), IV:KC(K,"F",m), V:KC(K,"G",""), V7:KC(K,"G","7")}; };
const PRIM_NAME = K => K.minor ? {I:"Im",IV:"IVm",V:"V",V7:"V7"} : {I:"I",IV:"IV",V:"V",V7:"V7"};
const gstepKey = () => (state.harm?"rehamo:gstep:":"rehamo:rgstep:")+state.songId;
const gmem={};
const getGStep = () => Math.min(state.harm?GSTEPS.length:RFLOW.length, Math.max(1, gmem[gstepKey()] || store.get(gstepKey()) || 1));
const rowBreak = (u,k,U) => (k<U.length-1 && Math.abs(((u.s+u.l)/(4*song.bpb)) - Math.round((u.s+u.l)/(4*song.bpb)))<1e-6) ? '<span class="fbreak"></span>' : "";
// chord strip grouped by bar (one box per bar, 4 bars per row); cells inside a bar share its box
function barStrip(U, cellHtml){
  let h="";
  for(let b=0;b<song.nbars;b++){
    const cells=U.map((u,k)=>[u,k]).filter(([u])=>u.s>=b*song.bpb-1e-6 && u.s<(b+1)*song.bpb-1e-6);
    h+=`<div class="fbar"><span class="fbn">${b+1}</span><div class="fcells">${cells.map(([u,k])=>cellHtml(u,k)).join("")}</div></div>`;
  }
  return h;
}
function phrases(){
  const bpb=song.bpb, nb=song.nbars, out=[];
  for(let b=0;b<nb;b+=4){ const e=Math.min(b+3,nb-1);
    const ns=song.notes.filter(n=>n.start>=e*bpb-1e-6 && n.start<(e+1)*bpb-1e-6 && !n.tiedFrom);
    const lastN=ns.length? ns[ns.length-1] : null;
    out.push({from:b, to:e, end:unitAt(lastN?lastN.start:e*bpb), last:lastN}); }
  return out;
}
// skeleton notes: weighted by how long they sound inside the cell, plus a bonus for the strong beat
function skeletonNotes(i){
  // weight per pitch: the longest single note counts fully, repeats count half, plus strong-beat / downbeat bonuses
  const u=state.chords[i], e=u.s+u.l, by={};
  notesIn(i).forEach(n=>{ const pc=mod(n.midi), len=Math.min(n.start+n.dur,e)-Math.max(n.start,u.s);
    const g=by[pc] || (by[pc]={midi:n.midi, total:0, maxLen:0, strong:false, down:false, idxs:[]});
    g.total+=len; g.maxLen=Math.max(g.maxLen,len); g.idxs.push(n.idx); if(n.strong) g.strong=true;
    if(Math.abs(n.start-u.s)<1e-6 && u.s%song.bpb===0) g.down=true; });
  const gs=Object.values(by); if(!gs.length) return [];
  gs.forEach(g=>{ g.w = g.maxLen + 0.5*g.total + (g.strong?1:0) + (g.down?0.5:0); });
  const maxW=Math.max(...gs.map(g=>g.w)), longMin=Math.max(1.5, u.l/2);
  return gs.filter(g=>g.w>=maxW*0.6).sort((a,b)=>b.w-a.w).slice(0,2).map(g=>{
    const long = g.maxLen>=longMin-1e-6;
    return {...g, why: long&&g.strong?"長い・強拍": long?"長い":"強拍"}; });
}
const skelIdx = i => new Set(skeletonNotes(i).flatMap(g=>g.idxs));
const solfOf = (midi, tonicPc=0) => SOLF[mod(midi-tonicPc)];
const contains = (c, pcs) => { const set=new Set(pcsOf(c)); return pcs.every(p=>set.has(p)); };
const isHalfMeter = () => song.bpb===4;
const rhythmNow = () => state.chords.every(u=>u.l===song.bpb) ? "bar" : "half";
function setRhythm(mode){
  if(!isHalfMeter()) return;
  const bpb=song.bpb, nb=song.nbars, out=[];
  for(let b=0;b<nb;b++){
    const us=state.chords.filter(u=>u.s>=b*bpb-1e-6 && u.s<(b+1)*bpb-1e-6);
    const first=us.find(u=>u.root)||us[0];
    if(mode==="bar") out.push({s:b*bpb, l:bpb, root:first.root, q:first.q, tech:first.tech});
    else us.forEach(u=>{ if(u.l===bpb) out.push({...u, l:2}, {...u, s:u.s+2, l:2}); else out.push(u); });
  }
  state.chords=out; rev={target:null, chain:[]}; state.sel=Math.min(state.sel,out.length-1); save();
}
function flowIssues(){
  const out=[], U=state.chords;
  const fn = c => c.root ? fnOfCell(c) : null;
  const empties=U.map((u,i)=>i).filter(i=>!U[i].root);
  if(empties.length) out.push({kind:"warn", i:empties[0], text:`まだコードのない枠が ${empties.length} か所あります。`});
  U.forEach((u,i)=>{ if(u.root && verdict(rolesFor(u,i))==="bad") out.push({kind:"bad", i, text:`${slotName(i)}：骨格の音が ${sym(u)} とぶつかっています。`}); });
  for(let i=1;i<U.length;i++){
    const a=U[i-1], b=U[i];
    if(a.root && b.root && fn(a)==="D" && fn(b)==="S")
      out.push({kind:"info", i, text:`${slotName(i)}：${sym(a)} → ${sym(b)} は D → S の流れです。クラシックでは避けますが、ポップスではよく使われます。聴いて判断してください。`});
  }
  let run=1;
  for(let i=1;i<=U.length;i++){
    if(i<U.length && U[i].root && same(U[i],U[i-1])) { run++; continue; }
    if(run>=4) out.push({kind:"info", i:i-run+1, text:`${slotName(i-run)}から ${sym(U[i-1])} が ${run} 枠続いています。途中を代理コードに替えると動きが出ます。`});
    run=1;
  }
  const last=U[U.length-1];
  if(last.root && fn(last)!=="T") out.push({kind:"warn", i:U.length-1, text:`最後が ${sym(last)} です。曲の終わりは I にすると落ち着きます。`});
  return out;
}
// order for filling: cells just before cadences, then phrase starts, then the rest
function fillOrder(){
  const U=state.chords, out=[], add=k=>{ if(k>=0 && k<U.length && !out.includes(k)) out.push(k); };
  const ph=phrases();
  ph.forEach(p=>{ const start=unitAt(p.from*song.bpb); for(let k=p.end-1;k>=Math.max(start,p.end-2);k--) add(k); });
  ph.forEach(p=>add(unitAt(p.from*song.bpb)));
  U.forEach((u,k)=>add(k));
  return out;
}
function neighborTip(i){
  const U=state.chords, nx=U[i+1], PN=PRIM_NAME(keyOfCell(i));
  const ph=phrases(), isStart=ph.some(p=>unitAt(p.from*song.bpb)===i);
  if(nx && nx.root){ const A=analyze(nx,keyAt(nx.s)), d=A.kind==="dia"?A.d:null;
    if(d===0) return `次が ${PN.I} なので、${PN.V}（${PN.V7}）が合いやすい所です。`;
    if(d===4) return `次が ${PN.V} なので、${PN.IV}（または ${PN.I}）が合いやすい所です。`;
    if(d===3) return `次が ${PN.IV} なので、${PN.I} から進むのが自然です。`;
  }
  if(isStart) return `フレーズの頭は ${PN.I} で始まることが多い所です。`;
  return "";
}
function widenOptions(c, K){
  const C=(r,q)=>KC(K,r,q), A=analyze(c,K), d=A.kind==="dia"?A.d:null;
  if(!K.minor){
    if(d===0) return [[C("A","m"),"VIm（I の代わり）"],[C("E","m"),"IIIm（I の代わり）"]];
    if(d===3) return [[C("D","m"),"IIm（IV の代わり）"]];
    if(d===4) return [[C("E","m"),"IIIm（V の代わり・弱め）"]];
  } else {
    if(d===0) return [[C("E♭",""),"♭III（Im の代わり）"],[C("A♭",""),"♭VI（Im の代わり）"]];
    if(d===3) return [[C("D","m7b5"),"IIm7(♭5)（IVm の代わり）"],[C("A♭",""),"♭VI（IVm の代わり）"]];
  }
  return [];
}
function colorOptions(c, K){
  const C=(r,q)=>KC(K,r,q), A=analyze(c,K), d=A.kind==="dia"?A.d:null, mi=K.minor, R=q=>({root:c.root,q});
  if(d===0) return mi ? [[R("m7"),"Im7"],[R("m6"),"Im6"],[R("mM7"),"Im(maj7)"]] : [[R("maj7"),"Imaj7"],[R("6"),"I6"]];
  if(d===3) return mi ? [[R("m7"),"IVm7"],[R("m6"),"IVm6"]] : [[R("maj7"),"IVmaj7"],[R("6"),"IV6"],[R("m6"),"IVm6（借用）"]];
  if(d===4) return [[R("7"),"V7"],[R("7sus4"),"V7sus4"],[R("7b9"),"V7(♭9)"],[C("D♭","7"),"♭II7（裏コード）"]];
  if(!mi && (d===1||d===2||d===5)) return [[R("m7"),"m7 にする"]];
  if(mi && (d===2||d===5)) return [[R("maj7"),"maj7 にする"]];
  return [];
}
// step-6 proposals of the harmonize guide: the dominant of the next chord first, then colours for this one
function colorList(i){
  const c=state.chords[i], nx=state.chords[i+1], opts=colorOptions(c, keyOfCell(i));
  if(nx && nx.root && relPc(nx,keyAt(nx.s))!==0) opts.unshift([domOf(nx), `次の ${sym(nx)} への V7（セカンダリードミナント）`, "向かう"]);
  return opts;
}
function guideHtml(){
  if(!state.harm) return rGuideHtml();
  const step=getGStep(), i=state.sel, K=keyOfCell(i), P=PRIM(K), PN=PRIM_NAME(K);
  let h=`<div class="revbox">
    <ol class="steps gsteps">${GSTEPS.map((t,k)=>`<li class="${k+1===step?"on":""}${k+1<step?" done":""}"><button data-gs="${k+1}" title="${t}" aria-label="ステップ${k+1}：${t}"${k+1===step?' aria-current="step"':""}></button></li>`).join("")}</ol>
    <h3 class="gtitle"><small>ステップ ${step} / ${GSTEPS.length}</small>${GSTEPS[step-1]}</h3>`;
  if(step===1){
    const H=HOME(), PH=PRIM(H), HN=PRIM_NAME(H), sf=c=>pcsOf(c).map(p=>SOLF[p]).join("・");
    h+=`<p class="hint">${glossed(`まず骨組みです。フレーズ（4小節ずつ）の最後で、曲が<b>終わる（${HN.I}）</b>のか、<b>まだ続く（${HN.V}）</b>のかを決めます。最後の音が「${sf(PH.I)}」なら ${HN.I}、「${sf(PH.V)}」なら ${HN.V} が合います。曲の最後のフレーズは ${HN.I} で終えます。`)}</p><div class="glist">`;
    phrases().forEach((ph,k,arr)=>{
      const Kp=keyOfCell(ph.end), P=PRIM(Kp), PN=PRIM_NAME(Kp);
      const u=state.chords[ph.end], sol=ph.last?SOLF[mod(ph.last.midi-Kp.pc)]:"（休符）";
      const pcs=ph.last?[mod(ph.last.midi)]:[], okI=contains(P.I,pcs), okV=contains(P.V,pcs);
      const lastPh=k===arr.length-1;
      h+=`<div class="gitem"><div><b>フレーズ ${k+1}</b>（${ph.from+1}〜${ph.to+1}小節）<br><small>フレーズの最後の音：${sol}${lastPh?"・曲の終わり":""}</small></div>
        <div class="gbtns"><button class="btn${same(u,P.I)?" primary":""}" data-cad="${ph.end}" data-c="I">終わる（${PN.I}）${okI?"":" ⚠"}</button>
        <button class="btn${same(u,P.V)?" primary":""}" data-cad="${ph.end}" data-c="V">続く（${PN.V}）${okV?"":" ⚠"}</button></div></div>`;
    });
    h+=`</div><p class="hint">⚠ は、その音がコードに含まれないことを表します。</p>`;
  }
  if(step===2){
    h+=`<p class="hint">${glossed(`次に、コードを変える間隔を決めます。初めは<b>1小節に1つ</b>がおすすめです。楽譜の音符の下に出ている「ド・レ・ミ」のうち、<b>濃い字が骨格の音</b>（長い音や強拍の音）です。この音がコードの音になるように選びます。強拍でも短い音は、飾りの音のことがあります。`)}</p>`;
    if(isHalfMeter()){
      const r=rhythmNow();
      h+=`<div class="gbtns"><button class="btn${r==="bar"?" primary":""}" data-rh="bar">1小節に1つ</button><button class="btn${r==="half"?" primary":""}" data-rh="half">2拍に1つ</button></div>
        <p class="hint">切り替えると、置いたコードは各小節の最初のものに揃います。</p>`;
    } else h+=`<p class="hint">この曲は ${song.bpb}/4 拍子なので、1小節に1つで進めます。必要な所だけ、後で「枠を分割」で細かくできます。</p>`;
  }
  if(step===3){
    const empt=state.chords.map((u,k)=>k).filter(k=>!state.chords[k].root);
    const sk=skeletonNotes(i), pcs=sk.map(n=>mod(n.midi));
    const skTxt=sk.map(n=>`${solfOf(n.midi,K.pc)}（${n.why}）`).join("・");
    const fits=["I","IV","V"].filter(k=>contains(P[k],pcs)).map(k=>PN[k]);
    const nx=state.chords[i+1], tip=neighborTip(i);
    const each = sk.length>1 && !fits.length ? sk.map(n=>`${solfOf(n.midi,K.pc)}を含む：${["I","IV","V"].filter(k=>contains(P[k],[mod(n.midi)])).map(k=>PN[k]).join("・")||"なし"}`).join("／") : "";
    h+=`<p class="hint">${glossed(`使うのは ${PN.I}・${PN.IV}・${PN.V}（と ${PN.V7}）だけです。<b>骨格の音</b>（長い音や強拍の音）を含むコードを選びます。`)}</p>
      <p class="hint">終止の手前から決めると楽です。「次に決める枠へ」は、①終止の直前 → ②フレーズの頭 → ③残り の順に進みます。</p>
      <div class="chainrow"><span>${slotName(i)}：骨格の音 <b>${skTxt||"なし"}</b> → ${fits.length?`含むのは <b>${fits.join("・")}</b>`:sk.length>1?`両方を含むコードはありません。<br><small>${each}。どちらを優先するか決めるか、「枠を分割」して2つのコードにします。</small>`:"含むコードはありません（いちばん近いものを）"}${tip?`<br><small class="tip">${tip}</small>`:""}</span></div>
      <div class="cands">${["I","IV","V","V7"].map(k=>candButton(P[k], i, `data-prim="${k}"`, `<span class="oname">${PN[k]}</span>`)).join("")}</div>
      <div class="gbtns"><span class="hint">空いている枠：${empt.length}</span>${empt.length?`<button class="btn small" id="nextEmpty">次に決める枠へ</button>`:""}</div>`;
  }
  if(step===4){
    const iss=flowIssues();
    const strip=barStrip(state.chords, (u,k)=>{ const A=analyze(u,keyAt(u.s));
      return `<button class="fn f-${A.fn||"x"}${k===i?" cur":""}" data-go="${k}" title="${slotName(k)}${A.note?"："+A.note:""}"><b>${esc(sym(u))}</b><small>${fnMark(A)}</small></button>`; });
    h+=`<p class="hint">${glossed(`T（トニック）→ S（サブドミナント）→ D（ドミナント）→ T の流れになっているかを見ます。押すとその枠を選びます。`)}</p>
      <div class="fstrip">${strip}</div>
      ${iss.length?`<ul class="issues">${iss.map(x=>`<li class="${x.kind}"><button data-go="${x.i}">${esc(x.text)}</button></li>`).join("")}</ul>`:`<p class="hint good">気になる点はありません。「原曲のコードを見る」で答え合わせもできます。</p>`}`;
  }
  if(step===5){
    const c=state.chords[i];
    h+=`<p class="hint">${glossed(`I・IV・V の骨組みに、同じ働きをもつ別のコードを混ぜて動きを付けます。${isMinor()?"♭III や ♭VI は Im の、IIm7(♭5) は IVm の仲間です。":"VIm・IIIm は I の、IIm は IV の仲間です。"}骨格の音が乗るものを選びます。`)}</p>`;
    if(!c.root) h+=`<p class="hint">この枠にはまだコードがありません。</p>`;
    else { const opts=widenOptions(c,K);
      h+= opts.length ? `<div class="cands">${opts.map(([cc,nm],k)=>candButton(cc,i,`data-wid="${k}"`,`<span class="oname">${esc(nm)}</span>`)).join("")}</div>`
                      : `<p class="hint">このコードには、ここでの候補はありません。I・IV・V の枠を選んでください。</p>`; }
    h+=`<p class="hint">同じコードが続く所や、フレーズの途中に使うと効果的です。終止のコードはそのままにしておきます。</p>`;
  }
  if(step===6){
    const c=state.chords[i], nx=state.chords[i+1];
    h+=`<p class="hint">${glossed(`仕上げに、次のコードへ引き寄せるコード（セカンダリードミナント）や、7th・6th で色を足します。`)}</p>`;
    if(!c.root) h+=`<p class="hint">この枠にはまだコードがありません。</p>`;
    else {
      const opts=colorList(i);
      h+= opts.length ? `<div class="cands">${opts.map(([cc,nm],k)=>candButton(cc,i,`data-col="${k}"`,`<span class="oname">${esc(nm)}</span>`)).join("")}</div>`
                      : `<p class="hint">このコードには、ここでの候補はありません。「コード候補」タブを見てください。</p>`;
    }
    h+=`<p class="hint">さらに進むなら：</p><div class="gbtns">
      <button class="btn small" id="toRev" ${c.root&&i>0?"":"disabled"}>この枠を着地点に逆算する</button>
      <button class="btn small" id="toCand">コード候補タブを開く</button></div>`;
  }
  h+=`<div class="gnav"><button class="btn" id="gPrev" ${step===1?"disabled":""}>← 前へ</button><span class="sp"></span><button class="btn primary" id="gNext" ${step===GSTEPS.length?"disabled":""}>次へ →</button></div></div>`;
  return h;
}
function bindGuide(el){
  if(!state.harm) return bindRGuide(el);
  const i=state.sel, K=keyOfCell(i), P=PRIM(K), PN=PRIM_NAME(K);
  const go = s => { gmem[gstepKey()]=s; store.set(gstepKey(), s); el.scrollTop=0; renderInsp(); };
  el.querySelectorAll("[data-gs]").forEach(b=>b.onclick=()=>go(+b.dataset.gs));
  const gp=$("#gPrev"), gn=$("#gNext");
  if(gp) gp.onclick=()=>go(getGStep()-1);
  if(gn) gn.onclick=()=>go(getGStep()+1);
  el.querySelectorAll("[data-cad]").forEach(b=>b.onclick=()=>{ const k=+b.dataset.cad; state.sel=k;
    setChord(k, PRIM(keyOfCell(k))[b.dataset.c], b.dataset.c==="I"?"終止":"半終止"); previewSel(); });
  el.querySelectorAll("[data-rh]").forEach(b=>b.onclick=()=>{ setRhythm(b.dataset.rh); render(); });
  el.querySelectorAll("[data-prim]").forEach(b=>b.onclick=()=>{ const k=b.dataset.prim;
    setChord(i, P[k], PN[k]); previewSel(); });
  const ne=$("#nextEmpty"); if(ne) ne.onclick=()=>{ const k=fillOrder().find(j=>j!==i && !state.chords[j].root); if(k!=null){ state.sel=k; render(); } };
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ state.sel=+b.dataset.go; render(); });
  el.querySelectorAll("[data-wid]").forEach(b=>b.onclick=()=>{ const [cc,nm]=widenOptions(state.chords[i],K)[+b.dataset.wid];
    setChord(i, cc, "代理"); previewSel(); });
  el.querySelectorAll("[data-col]").forEach(b=>b.onclick=()=>{
    const [cc,nm,lab]=colorList(i)[+b.dataset.col]; setChord(i, cc, lab || nm.replace(/（.*）/,"")); previewSel(); });
  const tr=$("#toRev"); if(tr) tr.onclick=()=>{ rev={target:i, chain:[]}; state.tab="rev"; store.set(tabKey(),"rev"); render(); };
  const tc=$("#toCand"); if(tc) tc.onclick=()=>{ state.tab="cand"; store.set(tabKey(),"cand"); render(); };
}

// ---------- reharm guide ----------
const RFLOW = ["read", ...TECH_ORDER, "review"];
const RSTEPS = RFLOW.map(id=>id==="read"?"原曲を読む":id==="review"?"見直す":TECH[id].name);
const rflow = () => RFLOW[getGStep()-1];   // the open step of the reharm guide
const RDESC = {
  read:"まず原曲の骨組みを知ります。T（安定）・S（広がり）・D（緊張）の流れと、フレーズの終わり（着地点の候補）を確かめましょう。原曲を一度聴いてから次へ進みます。",
  seventh:"コードに7度や6度を足して、響きを厚くします。いちばん安全なリハモです。さらに9度などのテンションを足すこともできます。メロディ音がテンション（青）になる所は、しゃれた響きになります。",
  func:"同じ働きをもつ別のコードに替えます。I ↔ VIm・IIIm、IV ↔ IIm のように、メロディがよく乗るものを選びます。V のあとの I を VIm にすると、終わったと思わせて続ける「偽終止」になります。",
  bass:"コードはそのままに、ベースの音だけを変えます。分数コード C/E は「C のコードで、ベースは E」という意味です。転回形でベースをなめらかにつなぐ、ベースを1音ずつ下げる（上げる）、同じベースを保つ（ペダル）、V の代わりに IV/V の形を使う、が代表です。楽譜の下にベースラインが出ます。",
  cliche:"同じコードが2枠以上続く所で使います。コードの中の1音だけを半音ずつ動かすと、止まっていた響きに線が生まれます（クリシェ）。提案を選ぶと、続いている枠にまとめて入ります。",
  toward:"次のコードを着地点とみなして、そこへ向かうコードを置きます。次のコードの V7（セカンダリードミナント）や II が代表です。「II–V にする」「II–V に分ける」を選ぶと、枠が2つに分かれて両方入ります。逆算タブで、着地点から手前へ組み立てることもできます。",
  chrom:"V7 を裏コード（♭II7）に替えたり、ディミニッシュをはさんだりして、ベースを半音で動かします。",
  borrow:"同じ主音の短調（短調の曲なら長調）からコードを借りて、陰りや明るさを足します。IVm や ♭VII7 が定番です。",
  review:"最後に見直します。変えすぎていないか、骨格の音のぶつかりが増えていないかを確かめ、原曲と聴き比べます。全部の枠を変える必要はありません。"
};
const rStepCands = (id,i) => techniques(i).filter(x=>x.tech===id);
const rStepUsable = (id,i) => rStepCands(id,i).some(x=>itemVerdict(x,i)==="good");
const rStepCount = id => state.chords.filter(u=>techId(u.tech)===id).length;
function cmpRange(){
  const u=state.chords[state.sel], bpb=song.bpb, nb=song.nbars;
  const bar=Math.floor(u.s/bpb), b0=Math.max(0,bar-1)*bpb, b1=Math.min(nb,bar+3)*bpb;
  return {b0,b1};
}
function playCompare(orig){
  const {b0,b1}=cmpRange(), U=orig?origUnits():state.chords;
  const from=U.findIndex(x=>x.s+x.l>b0+1e-6), to=U.findIndex(x=>x.s>=b1-1e-6);
  playRange(Math.max(0,from), to<0?U.length:to, U, orig?"orig":"cmp");
}
function rGuideHtml(){
  const step=getGStep(), id=RFLOW[step-1], i=state.sel, n=RSTEPS.length;
  let h=`<div class="revbox">
    <ol class="steps gsteps">${RSTEPS.map((t,k)=>`<li class="${k+1===step?"on":""}${k+1<step?" done":""}"><button data-gs="${k+1}" title="${t}" aria-label="ステップ${k+1}：${t}"${k+1===step?' aria-current="step"':""}></button></li>`).join("")}</ol>
    <h3 class="gtitle"><small>ステップ ${step} / ${n}</small>${RSTEPS[step-1]}</h3>
    <p class="hint">${glossed(RDESC[id])}</p>`;
  if(id==="read"){
    const ends=new Set(phraseEnds());
    const ou=origUnits();
    const strip=barStrip(ou, (u,k)=>{ const A=analyze(u,keyAt(u.s)), ui=unitAt(u.s);
      return `<button class="fn f-${A.fn||"x"}${ui===i?" cur":""}${ends.has(ui)?" end":""}" data-go="${ui}" title="${slotName(ui)}${A.note?"："+A.note:""}"><b>${esc(sym(u))}</b><small>${fnMark(A)}</small></button>`; });
    h+=`<div class="fstrip">${strip}</div><p class="hint" style="font-size:12.5px">下線のある枠がフレーズの終わりです。「→」は次のコードへ向かうコード（セカンダリードミナントなど）です。押すとその枠を選びます。</p>
      <div class="gbtns"><button class="btn small" id="cmpO">▶ 原曲を聴く</button></div>`;
  } else if(id==="review"){
    const n=state.chords.length, changed=state.chords.filter((u,k)=>isChanged(k)).length;
    const bads=state.chords.map((u,k)=>k).filter(k=>verdict(rolesFor(state.chords[k],k))==="bad");
    const iss=[];
    if(changed===0) iss.push({kind:"warn", i:0, text:"まだ何も置き換えていません。ステップ2から試してみましょう。"});
    if(changed/n>0.75) iss.push({kind:"info", i:0, text:`${n} 枠のうち ${changed} 枠を変えています。原曲の響きを残す所があると、変えた所が引き立ちます。`});
    bads.forEach(k=>iss.push({kind:"bad", i:k, text:`${slotName(k)}：骨格の音が ${sym(state.chords[k])} とぶつかっています。狙った緊張か、聴いて確かめましょう。`}));
    TECH_ORDER.forEach(t=>{ const c=rStepCount(t); if(c) iss.push({kind:"good", i:null, text:`${TECH[t].name}：${c} か所`}); });
    h+=`<ul class="issues">${iss.map(x=>`<li class="${x.kind}"><button ${x.i!=null?`data-go="${x.i}"`:"disabled"}>${esc(x.text)}</button></li>`).join("")}</ul>
      <p class="hint">選んだ枠のバーの「聴き比べ」で、原曲といまのコードを聴き比べられます。気に入らない所は「原曲に戻す」か、Ctrl+Z で戻せます。</p>`;
  } else {
    const opts=rStepCands(id,i), usable=state.chords.map((u,k)=>k).filter(k=>rStepUsable(id,k));
    const cnt=rStepCount(id), goal=["toward","chrom","cliche"].includes(id)?1:2;
    h+=`<div class="chainrow"><span>課題：この段階の手法を ${goal} か所で使ってみよう（いま ${cnt}）${cnt>=goal?" <b class='okmark'>✓ 達成</b>":""}</span></div>
      <h3 class="sub">${slotName(i)}（いま ${esc(sym(state.chords[i]))}・原曲 ${esc(sym(origAt(i)))}）の候補</h3>`;
    h+= opts.length ? `<div class="cands revopts">${opts.map((o,k)=>candItem(o,i,`data-rc="${k}"`)).join("")}</div>`
                    : `<p class="hint">この枠では、この段階の候補はありません。コード名が点線で囲まれた枠を選んでください。</p>`;
    h+=`<div class="gbtns"><span class="hint" style="font-size:12.5px">メロディに合う候補がある枠：${usable.length}（コード名を点線で囲んであります）</span>${usable.length?`<button class="btn small" id="nextUsable">次の枠へ</button>`:""}</div>`;
    if(id==="toward") h+=`<div class="gbtns"><button class="btn small" id="toRev2" ${i<state.chords.length-1&&state.chords[i+1]?.root?"":"disabled"}>次の枠を着地点にして逆算タブで作る</button></div>`;
  }
  h+=`<div class="gnav"><button class="btn" id="gPrev" ${step===1?"disabled":""}>← 前へ</button><span class="sp"></span><button class="btn primary" id="gNext" ${step===n?"disabled":""}>次へ →</button></div></div>`;
  return h;
}
function bindRGuide(el){
  const i=state.sel, step=getGStep(), id=RFLOW[step-1];
  const go = s => { gmem[gstepKey()]=s; store.set(gstepKey(), s); el.scrollTop=0; render(); };
  el.querySelectorAll("[data-gs]").forEach(b=>b.onclick=()=>go(+b.dataset.gs));
  const gp=$("#gPrev"), gn=$("#gNext");
  if(gp) gp.onclick=()=>go(step-1);
  if(gn) gn.onclick=()=>go(step+1);
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ state.sel=+b.dataset.go; render(); });
  const co=$("#cmpO");
  if(co) co.onclick=()=>{ if(play&&play.mode==="orig") stop(); else { const ou=origUnits(); playRange(0,ou.length,ou,"orig"); } };
  const opts=rStepCands(id,i);
  el.querySelectorAll("[data-rc]").forEach(b=>b.onclick=()=>{ applyItem(i, opts[+b.dataset.rc]); previewSel(); });
  const nu=$("#nextUsable"); if(nu) nu.onclick=()=>{ const U=state.chords;
    let k=U.findIndex((u,j)=>j>i && rStepUsable(id,j)); if(k<0) k=U.findIndex((u,j)=>rStepUsable(id,j)); if(k>=0){ state.sel=k; render(); } };
  const tr=$("#toRev2"); if(tr) tr.onclick=()=>{ rev={target:i+1, chain:[]}; state.sel=i+1; state.tab="rev"; store.set(tabKey(),"rev"); render(); };
}

function renderInsp(){ renderInspBody(); restoreTerm(); }
function renderInspBody(){
  const i=state.sel;
  $("#selbar").innerHTML = selbarHtml(i);
  const tabs = `<div class="tabs" role="tablist">
    <button role="tab" data-tab="guide" aria-selected="${state.tab==="guide"}">ガイド</button>
    <button role="tab" data-tab="cand" aria-selected="${state.tab==="cand"}">${state.harm?"コード候補":"置き換え候補"}</button>
    <button role="tab" data-tab="rev" aria-selected="${state.tab==="rev"}">逆算</button></div>`;
  const el=$("#insp"); el.innerHTML = tabs + (state.tab==="rev" ? revHtml() : state.tab==="guide" ? guideHtml() : candHtml(i));
  el.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{ state.tab=b.dataset.tab; store.set(tabKey(),state.tab); el.scrollTop=0; renderInsp(); });
  if(el.dataset.sel!==String(i)){ el.scrollTop=0; el.dataset.sel=i; }
  $("#hearHere").onclick=()=>{ if(play&&play.mode==="here") stop(); else playRange(i, state.chords.length, state.chords, "here"); };
  $("#hearPrev").onclick=()=>{ if(play&&play.mode==="prevbar") stop(); else {
    const bar=Math.floor(state.chords[i].s/song.bpb), from=unitAt(Math.max(0,bar-1)*song.bpb);
    playRange(Math.max(0,from), state.chords.length, state.chords, "prevbar"); } };
  $("#revert").onclick=()=>{ if(state.harm){ const u=state.chords[i]; state.chords[i]={s:u.s,l:u.l,root:null,q:null}; save(); render(); } else { restoreOrig(i); render(); previewSel(); } };
  const sco=$("#selCmpO"), scn=$("#selCmpN");
  if(sco) sco.onclick=()=>{ if(play&&play.mode==="orig") stop(); else playCompare(true); };
  if(scn) scn.onclick=()=>{ if(play&&play.mode==="cmp") stop(); else playCompare(false); };
  $("#splitBtn").onclick=()=>{ splitUnit(i); render(); };
  $("#mergeBtn").onclick=()=>{ mergeNext(i); render(); };
  if(state.tab==="guide"){ bindGuide(el); return; }
  if(state.tab==="cand"){
    el.querySelectorAll("details").forEach(d=>d.addEventListener("toggle",()=>{ d.open?openTech.add(d.dataset.tech):openTech.delete(d.dataset.tech); }));
    const groups=suggest(i);
    el.querySelectorAll(".cand").forEach(b=>b.onclick=()=>{
      applyItem(i, groups[+b.dataset.g].items[+b.dataset.c]); previewSel(); });
    $("#mApply").onclick=()=>{ const c={root:$("#mRoot").value, q:$("#mQual").value}; if($("#mBass").value) c.bass=$("#mBass").value; setChord(i, c, "手入力"); previewSel(); };
    return;
  }
  if(rev.target==null){
    const st=$("#setTarget"); if(st) st.onclick=()=>{ rev={target:i, chain:[]}; render(); };
    el.querySelectorAll(".tgtpick").forEach(b=>b.onclick=()=>{ const t=+b.dataset.t; state.sel=t; rev={target:t, chain:[]}; render(); });
    return;
  }
  const t=rev.target, last=rev.chain.length? rev.chain[rev.chain.length-1].i : t, p=last-1;
  $("#revReset").onclick=()=>{ clearRev(true); render(); };
  $("#revUndo").onclick=()=>{ const e=rev.chain.pop(); if(e){ state.chords[e.i]=e.prev; state.sel=e.i; } save(); render(); };
  $("#revPlay").onclick=()=>{ const from=Math.max(0,(rev.chain.length?last:t)-1); playRange(from, t+1, state.chords, "slot"); };
  const sp=$("#revSplit"); if(sp) sp.onclick=()=>{ splitUnit(p); state.sel=p+1; render(); };
  if(p<0) return;
  const opts=approachOptions(state.chords[last], last===t);
  el.querySelectorAll(".revopts .cand").forEach(b=>b.onclick=()=>{
    const o=opts[+b.dataset.o], u=state.chords[p];
    rev.chain.push({i:p, prev:{...u}});
    state.chords[p]={s:u.s, l:u.l, root:o.c.root, q:o.c.q, tech:"逆算 "+o.short};
    state.sel=p; save(); render();
    playRange(p, t+1, state.chords, "slot");
  });
}
