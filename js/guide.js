// The right-hand panel: selected-cell bar, candidates, 「着地点から」 (building backwards from a goal chord), and the two guides.
// ---------- 「着地点から」 helpers (formerly 逆算) ----------
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
// 伴奏付け, with the original shown: one line on how the chord placed in cell i compares with the original.
// A different chord is often a fine answer, so the comparison is by function in the key of that place.
function answerNote(i){
  const c=state.chords[i];
  if(!state.harm || !state.reveal || !c || !c.root) return "";
  const o=origAt(i), K=keyOfCell(i), A=analyze(c,K), O=analyze(o,K), v=verdict(rolesFor(c,i)), os=sym(o);
  const head = sameCell(c,o) ? "" : "原曲とはコードを変える位置が違います。";
  let t;
  if(same(c,o)) t="原曲と同じコードです。";
  else if(v==="bad") t=`骨格の音がぶつかっています。原曲は ${os} です。`;
  else if(rootPc(c.root)===rootPc(o.root))   // same root: only the same diatonic function is "just thicker"
    t = A.kind==="dia" && O.kind==="dia" && A.fn===O.fn ? `原曲（${os}）と根音が同じで、響きの厚さが違うだけです。`
      : `原曲（${os}）と根音は同じですが、働きが違います（${A.note||"調の外のコード"}）。`;
  else if(A.fn && A.fn===O.fn) t=`原曲（${os}）と同じ機能（${A.fn}）です。別の答えとして成り立ちます。`;
  else if(A.fn && O.fn) t=`原曲（${os}）とは機能が違います（あなた：${A.fn}、原曲：${O.fn}）。メロディには合っているので、流れを聴き比べてみましょう。`;
  else t=`原曲は ${os} です。メロディには合っています。聴き比べてみましょう。`;
  return head+t;
}
function selbarHtml(i){
  const c=state.chords[i], o=origAt(i), next=state.chords[i+1];
  const roles=rolesFor(c,i), v=verdict(roles);
  const K=keyOfCell(i), fc = c.root ? c : (state.harm ? null : o), A=analyze(fc,K,next), away=K.tonic!=="C";
  return `<div class="selrow">
    <span class="ilabel">${slotName(i)}</span>
    <span class="selchord">${esc(sym(c))}</span>
    <div class="imeta">${state.harm&&!state.reveal?"":`<span class="m-orig">原曲 <b>${esc(sym(o))}</b></span>`}<span class="m-fn">${termBtn("fn","機能")} ${fnText(A)}</span>${A.roman?`<span class="m-deg">${termBtn("deg","度数")} <b>${esc(A.roman)}</b>${A.alt?`（${esc(A.alt)}）`:""}</span>`:""}${away?`<span class="m-key">ここは <b>${esc(droot(K.tonic))}${K.minor?"m":""}</b> に転調中</span>`:""}<span class="m-next">次 <b>${next?esc(sym(next)):"（終わり）"}</b></span></div>
    <span class="selbtns">
      <button class="btn" id="hearPrev">${play&&play.mode==="prevbar"?"■ 停止":"▶ 前小節から"}</button>
      <button class="btn primary" id="hearHere">${play&&play.mode==="here"?"■ 停止":"▶ ここから"}</button>
      <button class="btn" id="splitBtn" ${c.l<2?"disabled":""} title="この枠を2つに分けて、別々のコードを置けるようにする">枠を分割</button>
      <button class="btn" id="mergeBtn" ${canMerge(i)?"":"disabled"} title="次の枠とまとめて1つにする">次と結合</button>
      ${state.harm?`<button class="btn" id="revert" ${c.root?"":"disabled"}>コードを消す</button>`:`<button class="btn" id="revert" ${isChanged(i)?"":"disabled"}>原曲に戻す</button>`}
    </span>
  </div>
  <div class="rolerow"><span class="pill ${v}">${VERDICT_TEXT[v]}</span><span class="vmsg">${verdictMsg(roles,v)}</span>${answerNote(i)?`<span class="ansnote">${esc(answerNote(i))}</span>`:""}
    ${state.harm&&!state.reveal&&cmpPlan==null?"":`<span class="cmpset" title="選んだ枠のまわり4小節を聴き比べます">聴き比べ ${state.harm&&!state.reveal?"":`<button class="btn small" id="selCmpO">▶ 原曲</button>`}<button class="btn small" id="selCmpN">▶ ${plans.list.length>1?esc(plans.list[plans.cur].name):"いま"}</button>${cmpPlan!=null?`<button class="btn small" id="selCmpP">▶ ${esc(plans.list[cmpPlan].name)}</button>`:""}</span>`}</div>`;
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
// ---- the candidate list as a compact grid ----
// Each proposal is a tile: chord name, its degree in the key, a clash mark, and the melody's degrees against it.
// The proposal's full name is shown in the group's note line when the tile is hovered or focused (and for the
// chord now in the cell), so the grid stays small enough to take in at a glance.
const VMARK = {good:"○", ok:"△", bad:"✕", none:""};
const shortName = it => (it.name||"").replace(/（.*?）/g,"").trim();
function tileHtml(it, i, attrs){
  const K=keyOfCell(i), next=state.chords[i+1];
  const chords = it.cells ? it.cells.map(x=>x.c) : it.split ? splitPair(it,i) : [it.c];
  const vv=itemVerdict(it,i), multi=chords.length>1;
  const cur = !multi && same(it.c, state.chords[i]);
  const rom = chords.map(c=>analyze(c,K,next).roman).join(" → ");
  const degs = !multi ? degsHtml(rolesFor(it.c,i)) : "";
  const badge = it.cells ? `${it.cells.length}枠` : it.split ? "2つに分ける" : "";
  return `<button class="tile v-${vv}${multi?" wide":""}${cur?" cur":""}" ${attrs} data-name="${esc(it.name||"")}" title="${esc(it.name||"")}：${VERDICT_TEXT[vv]}">
    <span class="tn${!multi&&sym(chords[0]).length>4?" long":""}">${chords.map(c=>esc(sym(c))).join('<i class="arr">→</i>')}</span>
    <span class="vm" aria-label="${VERDICT_TEXT[vv]}">${VMARK[vv]}</span>
    <span class="tmeta"><span class="tr">${esc(rom)}</span>${multi?`<em>${badge}</em><span class="tsub">${esc(shortName(it))}</span>`:`<span class="degs">${degs}</span>`}</span>
  </button>`;
}
let candFilter = { tech:null, fitOnly:false };
const LONG_PRESS_MS = 450;
const NOTE_HINT = "候補にマウスを乗せる（タッチ画面では長押しする）と、ここに説明が出ます。";
const collapsedTech = new Set();
function candHtml(i){
  const c=state.chords[i], o=origAt(i), groups=suggest(i);
  const fits = it => itemVerdict(it,i)!=="bad";
  const total = groups.reduce((a,g)=>a+g.items.length,0);
  const tf = candFilter.tech && groups.some(g=>g.tech===candFilter.tech) ? candFilter.tech : null;
  // one note line for the whole list: the hovered/focused tile's full name, else what the chord now in the cell is
  const curIt = groups.flatMap(g=>g.items).find(it=>it.c && same(it.c,c));
  const curNote = c.root ? `いまの ${sym(c)}${curIt?`：${curIt.name}`:""}` : "";
  let h = `<div><h2>${state.harm?"コード候補":"置き換え候補"}<span>${slotName(i)}${!state.harm||state.reveal?`（原曲 ${esc(sym(o))}）`:""}</span></h2>
    <div class="cfilter" role="group" aria-label="手法で絞る">
      <button class="chip${tf?"":" on"}" data-ft="">すべて <b>${total}</b></button>
      ${groups.map(g=>`<button class="chip t-${esc(g.tech)}${tf===g.tech?" on":""}" data-ft="${esc(g.tech)}">${esc(TECH[g.tech]?TECH[g.tech].short:g.label||g.title)} <b>${g.items.length}</b></button>`).join("")}
      <label class="chk fit"><input type="checkbox" id="fitOnly"${candFilter.fitOnly?" checked":""}>ぶつかる候補を隠す</label>
    </div>
    <p class="tnote" id="tnote" data-default="${esc(curNote||NOTE_HINT)}">${esc(curNote||NOTE_HINT)}</p>
    <div class="groups">`;
  groups.forEach((g,gi)=>{
    if(tf && g.tech!==tf) return;
    const shown = g.items.map((it,ci)=>[it,ci]).filter(([it])=>!candFilter.fitOnly || fits(it));
    if(!shown.length) return;
    const closed = collapsedTech.has(g.tech) && !tf;
    h+=`<section class="tgrp t-${esc(g.tech)}${closed?" closed":""}">
      <div class="ghead"><button class="gtoggle" data-tg="${esc(g.tech)}" aria-expanded="${!closed}"><span class="chev">▾</span>${esc(g.title)}<span class="cnt">${shown.length}</span></button>
        ${closed?`<span class="peek">${shown.slice(0,4).map(([it])=>esc(it.c?sym(it.c):"…")).join(" · ")}${shown.length>4?" …":""}</span>`:""}
        <button class="ginfo" data-gi="${esc(g.tech)}" aria-expanded="${openTech.has(g.tech)}" title="この手法の説明">?</button></div>
      ${openTech.has(g.tech)?`<p class="gdesc">${glossed(esc(g.desc))}</p>`:""}
      ${closed?"":`<div class="tiles">${shown.map(([it,ci])=>tileHtml(it,i,`data-g="${gi}" data-c="${ci}"`)).join("")}</div>`}
    </section>`;
  });
  h+=`</div><p class="legend2"><span class="vm v-good">○</span> 骨格の音とぶつからない　<span class="vm v-ok">△</span> 短い音がぶつかる　<span class="vm v-bad">✕</span> 骨格の音がぶつかる　／ 下の数字はメロディの度数。</p></div>
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
      <h2>着地点から作る<span>着地点を決めて、そこへ向かうコードを手前に積んでいく</span></h2>
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
  const order=[...rev.chain].reverse().map(e=>e.i).concat([t]), T=state.chords[t];
  // degrees seen from the goal: the goal chord is I (Im if minor), e.g. IIm7 → V7 → I
  const KT={tonic:T.root, pc:rootPc(T.root), minor:isMinorish(T.q)}, deg=c=>romanOf(c,KT);
  let h=`<div class="revbox">
    <h2>着地点から作る<span>着地点 ${slotName(t)} の ${esc(sym(T))} を ${KT.minor?"Im":"I"} とみなす</span></h2>
    <div class="chainrow">${order.map((k,j)=>`<span class="clink${k===t?" t":""}"><b>${esc(sym(state.chords[k]))}</b><small>${esc(deg(state.chords[k]))}</small></span>${j<order.length-1?'<span class="arr">→</span>':""}`).join("")}</div>
    <p class="hint chainnote">下の小さな字は、着地点を ${KT.minor?"Im":"I"} とみたときの度数です。</p>
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
    h+=candButton(o.c, p, `data-o="${k}"`, `<span class="oname">${esc(o.short)}・${esc(o.name)}${last!==t?`（着地点から見て ${esc(deg(o.c))}）`:""}</span><span class="owhy">${esc(o.why)}<br>ベース ${motion(o.c,X)}</span>`);
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
  const lens = song.phrases || Array.from({length:Math.ceil(nb/4)}, (x,k)=>Math.min(4, nb-k*4));
  for(let k=0, b=0; k<lens.length; b+=lens[k++]){ const e=b+lens[k]-1;
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
const contains = (c, pcs) => { const set=new Set(pcsOf(c)); return pcs.every(p=>set.has(p)); };
// How often the chord changes, per metre: each pattern divides every bar into cells of these lengths (beats).
const RHYTHMS = {
  4:[{id:"bar", label:"1小節に1つ", lens:[4]}, {id:"half", label:"2拍に1つ", lens:[2,2]}, {id:"beat", label:"1拍に1つ", lens:[1,1,1,1]}],
  3:[{id:"bar", label:"1小節に1つ", lens:[3]}, {id:"21", label:"2拍＋1拍", lens:[2,1]}, {id:"beat", label:"1拍に1つ", lens:[1,1,1]}],
};
const rhythmsFor = bpb => RHYTHMS[bpb] || [{id:"bar", label:"1小節に1つ", lens:[bpb]}, {id:"beat", label:"1拍に1つ", lens:Array(bpb).fill(1)}];
const lensEq = (a,b) => a.length===b.length && a.every((x,k)=>Math.abs(x-b[k])<1e-6);
const barLens = b => state.chords.filter(u=>u.s>=b*song.bpb-1e-6 && u.s<(b+1)*song.bpb-1e-6).map(u=>u.l);
// "auto": one chord for the bar when one diatonic triad holds all of the bar's structural notes,
// otherwise the metre's two-part split (2+2 in 4/4, 2+1 in 3/4)
function autoLens(b){
  const bpb=song.bpb, s=b*bpb, K=keyAt(s);
  const pcs=[...new Set(notesSpan(s,bpb).filter(n=>n.strong).map(n=>mod(n.midi)))];
  const one=TRIADS[K.minor?"minor":"major"].some(x=>contains(KC(K,...x), pcs));
  const two=rhythmsFor(bpb).find(r=>r.lens.length===2);
  return one || !two ? [bpb] : two.lens;
}
const BARS = () => [...Array(song.nbars).keys()];
function rhythmNow(){
  const r=rhythmsFor(song.bpb).find(r=>BARS().every(b=>lensEq(barLens(b),r.lens)));
  return r ? r.id : BARS().every(b=>lensEq(barLens(b),autoLens(b))) ? "auto" : "mix";
}
// Re-divide every bar; each new cell takes the chord that was sounding where it starts.
function setRhythm(id){
  const bpb=song.bpb, r=rhythmsFor(bpb).find(x=>x.id===id), out=[];
  if(!r && id!=="auto") return;
  BARS().forEach(b=>{ let s=b*bpb;
    (id==="auto" ? autoLens(b) : r.lens).forEach(l=>{
      const o=state.chords.find(u=>s>=u.s-1e-6 && s<u.s+u.l-1e-6) || {root:null, q:null};
      out.push({s, l, root:o.root, q:o.q, ...(o.bass?{bass:o.bass}:{}), ...(o.tech?{tech:o.tech}:{})}); s+=l; }); });
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
    const H=HOME(), PH=PRIM(H), HN=PRIM_NAME(H), sf=c=>pcsOf(c).map(p=>solf(p,H)).join("・");
    h+=`<p class="hint">${glossed(`まず骨組みです。${song.phrases?"フレーズ":"フレーズ（4小節ずつ）"}の最後で、曲が<b>終わる（${HN.I}）</b>のか、<b>まだ続く（${HN.V}）</b>のかを決めます。最後の音が「${sf(PH.I)}」なら ${HN.I}、「${sf(PH.V)}」なら ${HN.V} が合います。曲の最後のフレーズは ${HN.I} で終えます。`)}</p><div class="glist">`;
    phrases().forEach((ph,k,arr)=>{
      const Kp=keyOfCell(ph.end), P=PRIM(Kp), PN=PRIM_NAME(Kp);
      const u=state.chords[ph.end], sol=ph.last?solf(ph.last.midi,Kp):"（休符）";
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
    const r=rhythmNow();
    h+=`<div class="gbtns">${rhythmsFor(song.bpb).map(x=>`<button class="btn${r===x.id?" primary":""}" data-rh="${x.id}">${x.label}</button>`).join("")}
        <button class="btn${r==="auto"?" primary":""}" data-rh="auto">骨格の音に合わせる</button></div>
      <p class="hint">「骨格の音に合わせる」は、小節の骨格の音が1つの三和音に収まれば1小節に1つ、収まらなければ${song.bpb===3?"2拍＋1拍":"半分"}に分けます。
        切り替えると、新しい枠には、その位置で鳴っていたコードが入ります。1つの小節だけ変えたいときは「枠を分割」「次と結合」を使います。${r==="mix"?"<br>いまは、小節によって間隔が違います。":""}</p>`;
  }
  if(step===3){
    const empt=state.chords.map((u,k)=>k).filter(k=>!state.chords[k].root);
    const sk=skeletonNotes(i), pcs=sk.map(n=>mod(n.midi));
    const skTxt=sk.map(n=>`${solf(n.midi,K)}（${n.why}）`).join("・");
    const fits=["I","IV","V"].filter(k=>contains(P[k],pcs)).map(k=>PN[k]);
    const nx=state.chords[i+1], tip=neighborTip(i);
    const each = sk.length>1 && !fits.length ? sk.map(n=>`${solf(n.midi,K)}を含む：${["I","IV","V"].filter(k=>contains(P[k],[mod(n.midi)])).map(k=>PN[k]).join("・")||"なし"}`).join("／") : "";
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
    h+=`<p class="hint">${glossed(`コードの機能が、T（トニック）→ S（サブドミナント）→ D（ドミナント）→ T の流れになっているかを見ます。押すとその枠を選びます。`)}</p>
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
      <button class="btn small" id="toRev" ${c.root&&i>0?"":"disabled"}>この枠を着地点にして手前を作る</button>
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
  const ne=$("#nextEmpty"); if(ne) ne.onclick=()=>{ const k=fillOrder().find(j=>j!==i && !state.chords[j].root); if(k!=null) selectCell(k); };
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>selectCell(+b.dataset.go));
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
  read:"まず原曲の骨組みを知ります。コードの機能（T＝安定、S＝広がり、D＝緊張）の流れと、フレーズの終わり（着地点の候補）を確かめましょう。原曲を一度聴いてから次へ進みます。",
  seventh:"コードに7度や6度を足して、響きを厚くします。いちばん安全なリハモです。さらに9度などのテンションを足すこともできます。メロディ音がテンション（青）になる所は、しゃれた響きになります。",
  func:"同じ働きをもつ別のコードに替えます。I ↔ VIm・IIIm、IV ↔ IIm のように、メロディがよく乗るものを選びます。V のあとの I を VIm にすると、終わったと思わせて続ける「偽終止」になります。",
  bass:"コードはそのままに、ベースの音だけを変えます。分数コード C/E は「C のコードで、ベースは E」という意味です。転回形でベースをなめらかにつなぐ、ベースを1音ずつ下げる（上げる）、同じベースを保つ（ペダル）、V の代わりに IV/V の形を使う、が代表です。楽譜の下にベースラインが出ます。",
  cliche:"同じコードが2枠以上続く所で使います。コードの中の1音だけを半音ずつ動かすと、止まっていた響きに線が生まれます（クリシェ）。提案を選ぶと、続いている枠にまとめて入ります。",
  toward:"次のコードを着地点とみなして、そこへ向かうコードを置きます。次のコードの V7（セカンダリードミナント）や II が代表です。「II–V にする」「II–V に分ける」を選ぶと、枠が2つに分かれて両方入ります。「着地点から」タブで、着地点から手前へ組み立てることもできます。",
  chrom:"V7 を裏コード（♭II7）に替えたり、ディミニッシュや ♯IVm7(♭5) をはさんだりして、ベースを半音で動かします。",
  borrow:"同じ主音の短調（短調の曲なら長調）からコードを借りて、陰りや明るさを足します。IVm や ♭VII7 が定番です。",
  cadence:"はじめに、フレーズの終わり（V → I）の終わり方を決めます。ここが着地点になり、あとのステップは、ここへ向かうように組み立てます。IV → I（変格終止）は柔らかく、IVm6 → I は少し切なく、♭VII7 → I（バックドア）や ♭II7 → I（裏コード）はジャズらしく終わります。IVm6・♭VII7 は同じ主音の短調から借りたコード、♭II7 は半音上から下りるコードです。V → VIm（偽終止）は、終わると思わせて続けます。原曲のままの終わり方を残してもかまいません。",
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
// the four bars around the selected cell, as the original ("orig"), the open plan ("cmp") or the comparison plan ("plancmp")
function playCompare(which){
  const {b0,b1}=cmpRange(), U = which==="orig" ? origUnits() : which==="plancmp" ? planCells(cmpPlan) : state.chords;
  const from=U.findIndex(x=>x.s+x.l>b0+1e-6), to=U.findIndex(x=>x.s>=b1-1e-6);
  playRange(Math.max(0,from), to<0?U.length:to, U, which);
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
    const cnt=rStepCount(id), goal=["toward","chrom","cliche","cadence"].includes(id)?1:2;
    h+=`<div class="chainrow"><span>課題：この段階の手法を ${goal} か所で使ってみよう（いま ${cnt}）${cnt>=goal?" <b class='okmark'>✓ 達成</b>":""}</span></div>
      <h3 class="sub">${slotName(i)}（いま ${esc(sym(state.chords[i]))}・原曲 ${esc(sym(origAt(i)))}）の候補</h3>`;
    h+= opts.length ? `<div class="cands revopts">${opts.map((o,k)=>candItem(o,i,`data-rc="${k}"`)).join("")}</div>`
                    : `<p class="hint">この枠では、この段階の候補はありません。コード名が点線で囲まれた枠を選んでください。</p>`;
    h+=`<div class="gbtns"><span class="hint" style="font-size:12.5px">メロディに合う候補がある枠：${usable.length}（コード名を点線で囲んであります）</span>${usable.length?`<button class="btn small" id="nextUsable">次の枠へ</button>`:""}</div>`;
    if(id==="toward") h+=`<div class="gbtns"><button class="btn small" id="toRev2" ${i<state.chords.length-1&&state.chords[i+1]?.root?"":"disabled"}>次の枠を着地点にして「着地点から」タブで作る</button></div>`;
  }
  h+=`<div class="gbtns"><label class="chk" style="font-size:12.5px"><input type="checkbox" id="autoPlayOn" ${state.autoPlay?"checked":""}>変更時に自動再生</label></div><div class="gnav"><button class="btn" id="gPrev" ${step===1?"disabled":""}>← 前へ</button><span class="sp"></span><button class="btn primary" id="gNext" ${step===n?"disabled":""}>次へ →</button></div></div>`;
  return h;
}
function bindRGuide(el){
  const i=state.sel, step=getGStep(), id=RFLOW[step-1];
  const go = s => { gmem[gstepKey()]=s; store.set(gstepKey(), s); el.scrollTop=0; render(); };
  el.querySelectorAll("[data-gs]").forEach(b=>b.onclick=()=>go(+b.dataset.gs));
  const gp=$("#gPrev"), gn=$("#gNext");
  if(gp) gp.onclick=()=>go(step-1);
  if(gn) gn.onclick=()=>go(step+1);
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>selectCell(+b.dataset.go));
  const co=$("#cmpO");
  if(co) co.onclick=()=>{ if(play&&play.mode==="orig") stop(); else { const ou=origUnits(); playRange(0,ou.length,ou,"orig"); } };
  const opts=rStepCands(id,i);
  el.querySelectorAll("[data-rc]").forEach(b=>b.onclick=()=>{ applyItem(i, opts[+b.dataset.rc]); previewSel(); });
  const nu=$("#nextUsable"); if(nu) nu.onclick=()=>{ const U=state.chords;
    let k=U.findIndex((u,j)=>j>i && rStepUsable(id,j)); if(k<0) k=U.findIndex((u,j)=>rStepUsable(id,j)); if(k>=0) selectCell(k); };
  const tr=$("#toRev2"); if(tr) tr.onclick=()=>{ rev={target:i+1, chain:[]}; state.sel=i+1; state.tab="rev"; store.set(tabKey(),"rev"); render(); };
  const ap=$("#autoPlayOn"); if(ap) ap.onchange=e=>{ state.autoPlay=e.target.checked; store.set("rehamo:autoplay", state.autoPlay); };
}

function renderInsp(){ renderInspBody(); restoreTerm(); showAnsNote(); }
// On phones the panel is a sheet fixed to the bottom of the screen, and near the top of the page it covers
// the lower part of the selected-cell bar, where the answer line sits. When a new answer appears, scroll
// just far enough to bring it above the sheet. Only on a change, so reading the toolbar is not disturbed.
let lastAns="";
function showAnsNote(){
  const a=$("#selbar .ansnote"), txt=a ? a.textContent : "";
  if(txt===lastAns) return; lastAns=txt;
  if(a) revealAboveSheet(a);
}
// phones only: scroll just enough that el is not covered by the panel fixed to the bottom of the screen
function revealAboveSheet(el){
  if(!matchMedia("(max-width:720px)").matches) return;
  const over=el.getBoundingClientRect().bottom+8-$("#insp").getBoundingClientRect().top;
  if(over>0) window.scrollBy({top:over, behavior:"smooth"});
}
function renderInspBody(){
  const i=state.sel;
  $("#selbar").innerHTML = selbarHtml(i);
  if(state.tab==="course" && !courseAvail()) state.tab="guide";   // e.g. a harmonize song without a course
  const tabs = `<div class="tabs" role="tablist">
    ${courseAvail() ? `<button role="tab" data-tab="course" aria-selected="${state.tab==="course"}">入門</button>` : ""}
    <button role="tab" data-tab="guide" aria-selected="${state.tab==="guide"}">ガイド</button>
    <button role="tab" data-tab="cand" aria-selected="${state.tab==="cand"}">${state.harm?"コード候補":"置き換え候補"}</button>
    <button role="tab" data-tab="rev" aria-selected="${state.tab==="rev"}">着地点から</button></div>`;
  const el=$("#insp"); 
  let tabContent = "";
  if(state.tab==="rev") tabContent = revHtml();
  else if(state.tab==="cand") tabContent = candHtml(i);
  else if(state.tab==="course") tabContent = courseHtml();
  else tabContent = guideHtml();
  el.innerHTML = tabs + tabContent;
  el.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{ state.tab=b.dataset.tab; store.set(tabKey(),state.tab); el.scrollTop=0; renderInsp(); });
  if(el.dataset.sel!==String(i)){ el.scrollTop=0; el.dataset.sel=i; }
  $("#hearHere").onclick=()=>{ if(play&&play.mode==="here") stop(); else playRange(i, state.chords.length, state.chords, "here"); };
  $("#hearPrev").onclick=()=>{ if(play&&play.mode==="prevbar") stop(); else {
    const bar=Math.floor(state.chords[i].s/song.bpb), from=unitAt(Math.max(0,bar-1)*song.bpb);
    playRange(Math.max(0,from), state.chords.length, state.chords, "prevbar"); } };
  $("#revert").onclick=()=>{ if(state.harm){ const u=state.chords[i]; state.chords[i]={s:u.s,l:u.l,root:null,q:null}; save(); render(); } else { restoreOrig(i); render(); previewSel(); } };
  const sco=$("#selCmpO"), scn=$("#selCmpN");
  if(sco) sco.onclick=()=>{ if(play&&play.mode==="orig") stop(); else playCompare("orig"); };
  if(scn) scn.onclick=()=>{ if(play&&play.mode==="cmp") stop(); else playCompare("cmp"); };
  const scp=$("#selCmpP"); if(scp) scp.onclick=()=>{ if(play&&play.mode==="plancmp") stop(); else playCompare("plancmp"); };
  $("#splitBtn").onclick=()=>{ splitUnit(i); render(); };
  $("#mergeBtn").onclick=()=>{ mergeNext(i); render(); };
  if(state.tab==="course"){ bindCourse(el); return; }
  if(state.tab==="guide"){ bindGuide(el); return; }
  if(state.tab==="cand"){
    const groups=suggest(i);
    el.querySelectorAll(".tile").forEach(b=>{
      const note=$("#tnote"), show=()=>{ note.textContent=`${b.querySelector(".tn").textContent}：${b.dataset.name}`; note.classList.add("hov"); },
            back=()=>{ note.textContent=note.dataset.default||" "; note.classList.remove("hov"); };
      // touch and pen: a long press only shows the explanation; the tap that ends it does not place the chord
      let timer=0, held=false;
      b.addEventListener("pointerdown",e=>{ if(e.pointerType==="mouse") return; held=false;
        timer=setTimeout(()=>{ held=true; show(); b.classList.add("held"); }, LONG_PRESS_MS); });
      ["pointerup","pointercancel","pointerleave"].forEach(t=>b.addEventListener(t,()=>{ clearTimeout(timer); b.classList.remove("held"); }));
      b.addEventListener("contextmenu",e=>{ if(held) e.preventDefault(); });   // some browsers open a menu on long press
      b.onclick=e=>{ if(held){ held=false; e.preventDefault(); return; }
        applyItem(i, groups[+b.dataset.g].items[+b.dataset.c]); previewSel(); };
      b.addEventListener("mouseenter",show); b.addEventListener("focus",show); b.addEventListener("mouseleave",back); b.addEventListener("blur",back);
    });
    el.querySelectorAll("[data-ft]").forEach(b=>b.onclick=()=>{ candFilter.tech=b.dataset.ft||null; renderInsp(); });
    const fo=$("#fitOnly"); if(fo) fo.onchange=()=>{ candFilter.fitOnly=fo.checked; renderInsp(); };
    el.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>{ const t=b.dataset.tg; collapsedTech.has(t)?collapsedTech.delete(t):collapsedTech.add(t); renderInsp(); });
    el.querySelectorAll("[data-gi]").forEach(b=>b.onclick=()=>{ const t=b.dataset.gi; openTech.has(t)?openTech.delete(t):openTech.add(t); renderInsp(); });
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
    state.chords[p]={s:u.s, l:u.l, root:o.c.root, q:o.c.q, tech:"着地点へ "+o.short};
    state.sel=p; save(); render();
    playRange(p, t+1, state.chords, "slot");
  });
}
// ---------- beginner course (入門コース, docs/PLAN.md section 5) ----------
// The guide's steps, but each step shows hand-picked tasks (お題) from COURSES: one cell, two or three
// candidates taken from that step's own candidate list, and one line on why. Only the songs in COURSES.
const CFLOW = () => {
  if (state.harm) return ["cad","rhythm","prim","flow","widen","color"];
  const c = COURSES[state.songId];
  if (c && c[state.genre] && c[state.genre].steps) return c[state.genre].steps;
  return ["read","cadence","seventh","cliche","func","bass","toward","chrom","borrow","review"];
};
const CSTEP_NAME = { read:"原曲を読む", setup:"土台の調整", review:"見直す", cad:GSTEPS[0], rhythm:GSTEPS[1], prim:GSTEPS[2], flow:GSTEPS[3], widen:GSTEPS[4], color:GSTEPS[5] };
const cStepName = id => CSTEP_NAME[id] || TECH[id].name;
// the course tab: every song in reharm mode (songs without tasks say so), and in harmonize mode only the songs that have that course
const courseAvail = () => !state.harm || !!(COURSES[state.songId] && COURSES[state.songId].harm);
const courseData = () => { const c=COURSES[state.songId]; return c ? (state.harm ? c.harm : (c[state.genre] ? c[state.genre].tasks : null)) : null; };
function genreBaseChords(songId, g){
  if(g==="basic") return origUnits();
  const base = typeof BASIC_FOUNDATION!=="undefined" && BASIC_FOUNDATION[songId];
  if(!base) return origUnits();
  const ch = JSON.parse(JSON.stringify(base));
  const mods = COURSES[songId]?.[g]?.baseMods;
  if(mods){
    mods.forEach(m => {
      const b = (m.bar-1)*song.bpb + (m.beat-1);
      if(m.split){
        const idx = ch.findIndex(x => Math.abs(x.s-b)<1e-6);
        if(idx>=0 && ch[idx].l>=2){
          const u=ch[idx], a=Math.ceil(u.l/2);
          ch.splice(idx, 1, {...u, l:a}, {...u, s:u.s+a, l:u.l-a});
        }
        return;
      }
      const u = ch.find(x => Math.abs(x.s-b)<1e-6);
      if(u){ u.root = m.c.root; u.q = m.c.q; if(m.c.bass) u.bass = m.c.bass; else delete u.bass; u.tech = "土台調整"; }
    });
    const merged = [];
    ch.forEach(u => {
      const prev = merged[merged.length-1];
      if(prev && Math.floor(prev.s/song.bpb)===Math.floor(u.s/song.bpb) && same(prev, u)) prev.l += u.l;
      else merged.push(u);
    });
    return merged;
  }
  return ch;
}
// The plans hold one sheet per song, but course progress is kept per genre. So the sheet of the
// genre being left is kept aside, and "続きから再開" brings it back with that genre's progress.
const genreKey = id => "rehamo:genre:"+id;
const gsheetKey = (g, id=state.songId) => "rehamo:gsheet:"+g+":"+id;
const onExample = () => !!(plans.list[plans.cur] && plans.list[plans.cur].isExample);
function keepGenreSheet(){ if(state.harm || !COURSES[state.songId] || onExample()) return; store.set(gsheetKey(state.genre), state.chords); }
// course actions write into the open plan; never into the 完成例 plan
function leaveExample(){ if(!onExample()) return; const w=plans.list.findIndex(p=>!p.isExample); if(w>=0) switchPlan(w); }
function setGenre(g){ state.genre=g; state.pendingGenre=null; cmsg=null; if(!state.harm) store.set(genreKey(state.songId), g); }
const cstepKey = () => (state.harm?"rehamo:hcstep:":"rehamo:cstep:"+state.genre+":")+state.songId;
const ctaskKey = () => (state.harm?"rehamo:htask:":"rehamo:task:"+state.genre+":")+state.songId;
const cmem = {}, cpick = {};   // open step and open task, kept for the session even when storage is off
let cmsg = null;               // the line shown after a choice: {kind, text}
const getCStep = () => Math.min(CFLOW().length, Math.max(1, cmem[cstepKey()] || store.get(cstepKey()) || 1));
const cStepId = () => CFLOW()[getCStep()-1];
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
// a step with no task in a song (e.g. no chord held for two cells inside one phrase, so no cliché)
const CEMPTY = { cliche:"この曲には、同じコードが2枠以上続く所が、1つのフレーズの中にありません。クリシェは使わずに進みます。",
  chrom:"この曲には、入門で使う半音の近づき方に合う所がありません。" };
const sayText = s => String(s||"").replace(/\{n:([^}]+)\}/g, (m,x)=>droot(x)).replace(/\{c:([^}]+)\}/g, (m,x)=>sym(parseChord(x)));
const COURSE_PLAY = new Set(["ccmp","corig","orig","all"]);
// apply a pick to a copy of the cells (to sound a clashing example without placing it)
function applyToCopy(it, i){
  const U=JSON.parse(JSON.stringify(state.chords));
  const put=(k,c)=>{ const u=U[k]; U[k]={s:u.s, l:u.l, root:c.root, q:c.q, ...(c.bass?{bass:c.bass}:{})}; };
  if(it.cells) it.cells.forEach(x=>put(x.i, x.c));
  else if(it.split){ const [c1,c2]=splitPair(it,i), u=U[i], a=Math.ceil(u.l/2);
    U.splice(i,1,{s:u.s,l:a,root:c1.root,q:c1.q,...(c1.bass?{bass:c1.bass}:{})},{s:u.s+a,l:u.l-a,root:c2.root,q:c2.q,...(c2.bass?{bass:c2.bass}:{})}); }
  else put(i, it.c);
  return U;
}
function placeEntry(t, it, i){
  if(TECH[t.step]) applyItem(i, it); else setChord(i, it.c, it.label||"");
}

// ---- panel ----
function courseHtml(){
  const flow=CFLOW(), step=getCStep(), id=flow[step-1], n=flow.length, i=state.sel, d=doneSet();
  const c = COURSES[state.songId];
  const isReharm = !state.harm && c;
  const genres = isReharm ? Object.keys(c).filter(k => k !== "harm") : [];
  
  let h=`<div class="revbox course">`;
  
  const hasFinalEx = typeof COURSE_FINALS!=="undefined" && COURSE_FINALS[state.songId] && COURSE_FINALS[state.songId][state.genre];
  const gLabel = c && c[state.genre] ? c[state.genre].label : "";
  const viewingThisEx = !!plans.list[plans.cur]?.isExample && plans.list[plans.cur]?.name === `完成例（${gLabel}）`;

  if(isReharm && genres.length > 1){
    const subGenres = genres.filter(g => g !== "basic");
    const activeIds = new Set(((c[state.genre]&&c[state.genre].tasks)||[]).filter(x=>!["read","setup","rhythm","review"].includes(x.step)).map(x=>x.id));
    const hasActiveProgress = [...d].some(tid => activeIds.has(tid));
    const baseArr = state.genre !== "basic" && genreBaseChords(state.songId, state.genre);
    const notAtBase = baseArr && JSON.stringify(state.chords.map(u=>({s:u.s,l:u.l,r:u.root,q:u.q,b:u.bass||""}))) !== JSON.stringify(baseArr.map(u=>({s:u.s,l:u.l,r:u.root,q:u.q,b:u.bass||""})));
    const restartLabel = state.pendingGenre === "basic" ? "原曲に戻して最初から" : "リハモ入門の完成形から始める";
    
    h+=`<div style="margin-bottom:12px; display:flex; flex-direction:column; gap:6px; border-bottom:1px solid var(--rule); padding-bottom:10px;">
        ${c.basic ? `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
          <span style="font-size:12.5px; font-weight:700; color:var(--ink-2);">1.</span>
          <button class="btn small${state.genre==='basic' && !state.pendingGenre?' primary':''}" data-genre="basic">${esc(c.basic.label)}</button>
          <span class="hint" style="margin:0; font-size:12px;">基本手法を体験しよう</span>
        </div>` : ""}
        ${subGenres.length ? `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px;">
          <span style="font-size:12.5px; font-weight:700; color:var(--ink-2);">2.</span>
          ${subGenres.map(g => `<button class="btn small${state.genre===g && !state.pendingGenre?' primary':''}" data-genre="${g}">${esc(c[g].label)}</button>`).join("")}
          <span class="hint" style="margin:0; font-size:12px;">さらにアレンジを加えよう</span>
        </div>` : ""}
        ${state.pendingGenre ? `
          <div style="width:100%; margin-top:4px; padding:8px 12px; background:var(--mark); color:var(--mark-ink); border-radius:6px; font-size:13px;">
            「${esc(c[state.pendingGenre].label)}」は途中の記録があります。
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
              <button class="btn small" id="cResume" style="background:var(--sheet);color:var(--ink);border-color:transparent;">続きから再開</button>
              <button class="btn small" id="cRestart" style="background:var(--sheet);color:var(--ink);border-color:transparent;">${restartLabel}</button>
            </div>
          </div>
        ` : `
          <p class="hint" style="margin:2px 0 0; width:100%;">${esc(c[state.genre].desc)}</p>
          ${state.genre !== "basic" && !hasActiveProgress && notAtBase ? `<div style="margin-top:2px;"><button class="btn small" id="cApplyBase">リハモ入門の完成形をセットする</button></div>` : ""}
          ${hasActiveProgress ? `<div style="margin-top:2px; text-align:right;"><button class="linkbtn" id="cRestartCur" style="font-size:12px;color:var(--ink-2);background:none;border:0;padding:0;text-decoration:underline;cursor:pointer;">${state.genre==="basic"?"このコースを最初からやり直す":"リハモ入門の完成形からやり直す"}</button></div>` : ""}
        `}
      </div>`;
  }
  
  h+=`<div class="cstepbar">
    <ol class="steps gsteps">${flow.map((s,k)=>`<li class="${k+1===step?"on":""}${stepDone(s)?" done":""}"><button data-cs="${k+1}" title="${cStepName(s)}" aria-label="ステップ${k+1}：${cStepName(s)}${stepDone(s)?"（済み）":""}"${k+1===step?' aria-current="step"':""}></button></li>`).join("")}</ol>
    ${hasFinalEx ? `<button class="btn small${viewingThisEx?" primary":""}" id="cShowFinal" style="flex:none;">${viewingThisEx ? `完成例を表示中` : `完成例を見る`}</button>` : ""}
  </div>
  <h3 class="gtitle"><small>${isReharm ? c[state.genre].label : "入門"}・ステップ ${step} / ${n}</small>${cStepName(id)}</h3>`;
  if(state.harm && !gridIsOrig()){
    h+=`<p class="hint">入門は、原曲と同じ枠（コードは空）から始めます。いまの案にはコードが入っているので、新しい案で始めます。</p>
      <div class="gbtns"><button class="btn primary" id="cGrid" ${plans.list.length<PLAN_MAX?"":"disabled"}>新しい案で始める</button></div>
      ${plans.list.length<PLAN_MAX?"":`<p class="hint">案がいっぱいです。使わない案を消してください。</p>`}</div>`;
    return h;
  }
  const ts=stepTasks(id), t=curTask();
  if(!ts.length) h+=`<p class="hint">${glossed(CEMPTY[id]||"この曲には、このステップのお題がありません。")}「次へ」で先へ進みます。</p>`;
  if(ts.length>1 || (ts.length===1 && ts[0].bar)) h+=`<div class="ctasks">${ts.map((x,k)=>`<button class="chip${x===t?" on":""}${d.has(x.id)?" done":""}" data-ct="${x.id}">お題 ${k+1}${d.has(x.id)?" ✓":""}</button>`).join("")}</div>`;
  if(t) h+=courseTaskHtml(t, i);
  if(id==="prim") h+=fillBtnHtml();   // shown whatever the task's state, so the later steps can start from full cells
  const pv=cMove(-1), nx=cMove(1);
  h+=`<div class="gbtns"><button class="btn small" id="cStop" ${play&&COURSE_PLAY.has(play.mode)?"":"hidden"}>■ 再生を止める</button><label class="chk" style="font-size:12.5px"><input type="checkbox" id="autoPlayOn" ${state.autoPlay?"checked":""}>変更時に自動再生</label></div>`;
  h+=`<div class="gnav"><button class="btn" id="cPrev" ${pv?"":"disabled"}>← 前へ${pv?`<small>（${esc(pv.label)}）</small>`:""}</button><span class="sp"></span>
    <button class="btn primary" id="cNext" ${nx?"":"disabled"}>次へ →${nx?`<small>（${esc(nx.label)}）</small>`:""}</button></div>
    </div>`;
  return h;
}
// where "次へ" / "前へ" go: the next task of this step, else the next step (its first task, or its last going back)
function cMove(dir){
  const flow=CFLOW(), step=getCStep(), ts=stepTasks(cStepId()), t=curTask(), k=ts.indexOf(t);
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
  if(t.step==="setup"){
    return `<p class="hint">${glossed(sayText(t.say))}</p>
      <div class="cspots">${(t.spots||[]).map((s,k)=>`<div class="gitem"><b>${s.bar}小節目周辺</b>
        <div class="gbtns"><button class="btn small" data-hear-setup="${k}">▶ 聴く</button></div></div>`).join("")}</div>
      <p class="hint">調整された土台を聴いて確かめたら、「次へ」でアレンジを始めましょう。</p>`;
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
  const needCl4 = t.needCliche4 && !(state.chords.length>=4 && [0,1,2,3].every(k=>state.chords[k].l===2 && same(state.chords[k], {root:"C",q:""})));
  const needCur = t.need && !same(state.chords[ti], parseChord(t.need));
  const needNxt = t.needNext && state.chords[ti+1] && !state.chords[ti+1].root;
  if(needCl4 || needCur || needNxt){
    const nc = t.need ? parseChord(t.need) : state.chords[ti];
    const nxc = t.needNext ? parseChord(t.needNext) : null;
    const msg = needCl4 ? `4段階のクリシェを作るため、1〜2小節目を2拍ずつ4枠の ${esc(sym({root:"C",q:""}))} に揃えます。`
              : needCur && needNxt ? `このお題は、この枠が ${esc(sym(nc))}、次の枠が ${esc(sym(nxc))} のときにできます。`
              : needCur ? `このお題は、この枠が ${esc(sym(nc))} のときにできます。`
              : `このお題は、次の枠に ${esc(sym(nxc))} が入っているときにできます。`;
    return h+`<p class="hint">${msg}</p>
      <div class="gbtns"><button class="btn small primary" id="cNeed">前提のコードをセットする</button></div>`;
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
    <div class="gbtns"><button class="btn small" id="cHearO">${play&&play.mode==="orig"?"■ 停止":"▶ 原曲を聴く"}</button><button class="btn small" id="cHearN">${play&&play.mode==="all"?"■ 停止":"▶ いまの案を聴く"}</button>
    <span class="sp"></span><button class="btn small primary" id="cReviewRestart">最初からやり直す</button></div>`;
}

function bindCourse(el){
  const step=getCStep(), id=cStepId(), t=curTask(), i=state.sel, c=COURSES[state.songId];
  // an empty harmonize plan is simply given the original's cells (recorded for Undo)
  if(state.harm && !gridIsOrig() && state.chords.every(u=>!u.root)){ state.chords=emptyOrigGrid(); save(); openTask(t); render(); return; }
  el.querySelectorAll("[data-genre]").forEach(b=>{
    b.onclick=()=>{ 
      const g = b.dataset.genre;
      if(g === state.genre && !state.pendingGenre) return;
      const gMem = cmem[(state.harm?"rehamo:htask:":"rehamo:task:"+g+":")+state.songId] || store.get((state.harm?"rehamo:htask:":"rehamo:task:"+g+":")+state.songId);
      const activeIds = new Set(((c&&c[g]&&c[g].tasks)||[]).filter(x=>!["read","setup","rhythm","review"].includes(x.step)).map(x=>x.id));
      const hasProgress = Array.isArray(gMem) && gMem.some(id=>activeIds.has(id));
      
      if(hasProgress) {
        state.pendingGenre = g;
        renderInsp();
      } else {
        keepGenreSheet(); leaveExample();
        const before = JSON.stringify(state.chords);
        setGenre(g);
        if(!state.harm){ state.chords = genreBaseChords(state.songId, g); save(); }
        openTask(curTask());   // clears cmsg, so the message is set after it
        // the sheet was replaced without asking; say how to get the previous one back
        if(!state.harm && JSON.stringify(state.chords)!==before) cmsg={kind:"good", text:`「${c[g].label}」の土台を楽譜にセットしました。前の楽譜には、ツールバーの「元に戻す」で戻せます。`};
        render();
      }
    };
  });
  const cbf=$("#cApplyBase");
  if(cbf) cbf.onclick=()=>{
    leaveExample();
    state.chords = genreBaseChords(state.songId, state.genre);
    save(); cmsg={kind:"good", text:"このコースの土台（リハモ入門の完成形）を楽譜に入れました。ここから味付けを進められます。"};
    render();
  };
  const csf=$("#cShowFinal");
  if(csf) csf.onclick=()=>{
    const fin = typeof COURSE_FINALS!=="undefined" && COURSE_FINALS[state.songId] && COURSE_FINALS[state.songId][state.genre];
    if(!fin) return;
    const gLabel = COURSES[state.songId][state.genre].label;
    const exName = `完成例（${gLabel}）`;
    const workIdx = plans.list.findIndex(p => !p.isExample && p.name !== "見本");
    const cmpIdx = workIdx >= 0 ? workIdx : (plans.cur >= 0 ? plans.cur : 0);
    let exIdx = plans.list.findIndex(p => p.isExample);
    if(exIdx >= 0){
      plans.list[exIdx] = {name: exName, chords: JSON.parse(JSON.stringify(fin)), isExample: true};
    } else if(plans.list.length < PLAN_MAX){
      plans.list.push({name: exName, chords: JSON.parse(JSON.stringify(fin)), isExample: true});
      exIdx = plans.list.length - 1;
    } else {
      exIdx = plans.list.length - 1;
      plans.list[exIdx] = {name: exName, chords: JSON.parse(JSON.stringify(fin)), isExample: true};
    }
    plans.cur = -1;
    switchPlan(exIdx);
    cmpPlan = cmpIdx !== exIdx ? cmpIdx : null;
    cmsg = {kind:"good", text:`「${exName}」をアレンジ案に表示しました。上のアレンジ案バーから「${plans.list[cmpIdx]?.name || "自分の案"}」にいつでも戻せます。`};
    render();
  };
  const cg=$("#cGrid"); if(cg) cg.onclick=()=>{ newPlan(); state.chords=emptyOrigGrid(); save(); openTask(curTask()); render(); };
  el.querySelectorAll("[data-cs]").forEach(b=>b.onclick=()=>goCStep(+b.dataset.cs));
  const move = m => { if(!m) return; if(m.step!==step){ cmem[cstepKey()]=m.step; store.set(cstepKey(), m.step); }
    openTask(m.task); const pe=$("#insp"); if(pe) pe.scrollTop=0; render(); };
  const cp=$("#cPrev"), cn=$("#cNext");
  if(cp) cp.onclick=()=>move(cMove(-1));
  if(cn) cn.onclick=()=>move(cMove(1));
  const cres = $("#cResume");
  if(cres) cres.onclick=()=>{
    const g=state.pendingGenre; keepGenreSheet(); leaveExample(); setGenre(g);
    const kept=store.get(gsheetKey(g));
    const back = !state.harm && validChords(kept) && JSON.stringify(kept)!==JSON.stringify(state.chords);
    if(back){ state.chords=kept; save(); }   // recorded for Undo like any other edit
    openTask(curTask());   // clears cmsg, so the message is set after it
    if(back) cmsg={kind:"good", text:`「${c[g].label}」の続きの楽譜に戻しました。`};
    render(); };
  const crestart = $("#cRestart");
  if(crestart) crestart.onclick=()=>{ resetCourse(state.pendingGenre); };
  const crestartCur = $("#cRestartCur");
  if(crestartCur) crestartCur.onclick=()=>{ if(confirm(state.genre==="basic"?"記録と楽譜を原曲に戻して最初からやり直しますか？\n（ツールバーの「元に戻す」で直前の楽譜には戻せます）":"記録をリセットしてリハモ入門の完成形からやり直しますか？\n（ツールバーの「元に戻す」で直前の楽譜には戻せます）")) resetCourse(); };
  el.querySelectorAll("[data-ct]").forEach(b=>b.onclick=()=>{ openTask(stepTasks(id).find(x=>x.id===b.dataset.ct)); render(); });
  el.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>selectCell(+b.dataset.go));
  if(!t) return;
  // steps that are done by being seen, or by their state
  if(t.step==="setup" || t.step==="rhythm" || t.step==="review") markDone(t.id);
  if(t.step==="setup"){
    el.querySelectorAll("[data-hear-setup]").forEach(b=>b.onclick=()=>{
      const s=t.spots[+b.dataset.hearSetup], bpb=song.bpb, bar=s.bar-1;
      const b0=Math.max(0, bar-1)*bpb, b1=Math.min(song.nbars, bar+3)*bpb;
      const U=state.chords, from=Math.max(0, U.findIndex(x=>x.s+x.l>b0+1e-6)), to=U.findIndex(x=>x.s>=b1-1e-6);
      playRange(from, to<0?U.length:to, U, "ccmp");
    });
  }
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
  const revRest=$("#cReviewRestart"); if(revRest) revRest.onclick=()=>{ if(confirm("記録と楽譜をリセットして最初からやり直しますか？")) resetCourse(); };
  const cst=$("#cStop"); if(cst) cst.onclick=()=>stop();
  const ap=$("#autoPlayOn"); if(ap) ap.onchange=e=>{ state.autoPlay=e.target.checked; store.set("rehamo:autoplay", state.autoPlay); };
  if(ti<0) return;
  const cneed=$("#cNeed"); if(cneed) cneed.onclick=()=>{
    if(t.needCliche4){
      if(state.chords[0] && state.chords[0].l===4) splitUnit(0, true);
      [0,1,2,3].forEach(k=>{ if(state.chords[k]) state.chords[k]={s:k*2, l:2, root:"C", q:"", tech:""}; });
      save(); render(); return;
    }
    if(t.needNext && state.chords[ti+1] && !state.chords[ti+1].root){
      const u=state.chords[ti+1], nxc=parseChord(t.needNext);
      state.chords[ti+1]={s:u.s, l:u.l, root:nxc.root, q:nxc.q, tech:""};
    }
    if(t.need) setChord(ti, parseChord(t.need), ""); else { save(); render(); }
  };
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
    cmsg={kind:"good", text: state.autoPlay ? `${label} を置きました。前後の小節を鳴らします。原曲と比べるときは、上の「聴き比べ」の「▶ 原曲」を押します。` : `${label} を置きました。「▶ 前小節から」や上の「聴き比べ」で響きを確かめられます。`};
    state.sel=ti; render(); if(state.autoPlay) playCourse(state.chords); });
  const ce=$("#cEmpty"); if(ce) ce.onclick=()=>{ const k=fillOrder().find(j=>j!==i && !state.chords[j].root); if(k!=null) selectCell(k); };
  const cf=$("#cFill"); if(cf) cf.onclick=()=>{
    state.chords.forEach((u,k)=>{ if(u.root) return; const o=origAt(k); state.chords[k]={s:u.s, l:u.l, root:o.root, q:o.q, ...(o.bass?{bass:o.bass}:{}), tech:"原曲"}; });
    save(); render(); };
}
// forget this song's course progress in the open mode and set the sheet back to the course's start
// (recorded for Undo); targetGenre: restart that genre instead of resuming it
function resetCourse(targetGenre){
  const g = targetGenre || state.genre;
  if(g!==state.genre) keepGenreSheet();
  leaveExample();
  if(!state.harm) try{ localStorage.removeItem(gsheetKey(g)); }catch(e){}
  const tk = (state.harm?"rehamo:htask:":"rehamo:task:"+g+":")+state.songId;
  const sk = (state.harm?"rehamo:hcstep:":"rehamo:cstep:"+g+":")+state.songId;
  try{ localStorage.removeItem(tk); localStorage.removeItem(sk); }catch(e){}
  delete cmem[tk]; delete cmem[sk];
  const flow = state.harm ? ["cad","rhythm","prim","flow","widen","color"] : (COURSES[state.songId][g]?COURSES[state.songId][g].steps:[]);
  flow.forEach(id=>delete cpick[sk+":"+id]);
  
  // Also reset the sheet to the starting point
  state.chords = state.harm ? emptyOrigGrid() : genreBaseChords(state.songId, g);
  save();

  setGenre(g);
  openTask(curTask()); render();
}
function entryLabel(it, i){
  if(it.cells) return it.cells.map(x=>sym(x.c)).join(" → ");
  if(it.split) return splitPair(it,i).map(sym).join(" → ");
  return sym(it.c);
}
