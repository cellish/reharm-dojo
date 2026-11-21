// The score: VexFlow engraving plus the app's own overlay, and the main render().
// ---------- render ----------
const $ = s=>document.querySelector(s);
const esc = s=>String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function slotName(i){
  const u=state.chords[i], bar=Math.floor(u.s/song.bpb)+1, beat=fmtDur(u.s%song.bpb)+1;
  if(u.l===song.bpb) return `第${bar}小節`;
  if(u.l===2 && song.bpb===4 && (beat===1||beat===3)) return `第${bar}小節・${beat===1?"前半":"後半"}`;
  return `第${bar}小節 ${beat}拍目（${fmtDur(u.l)}拍）`;
}

// ---------- staff (lead sheet) ----------
// vertical layout of one system, in SVG units: staff top/bottom, degree row, bass row, total height
let HB=86, BASS_Y=95, T=20, B=60, H=86, DEG_Y=78, BEATW=55;
const isNarrow = () => ($("#sheet").clientWidth || 800) < 600;
const barsPerSystem = () => isNarrow()?2:4;
function setGeom(){
  const ps=song.notes.map(n=>staffPos(n.midi).p), maxP=Math.max(...ps), minP=Math.min(...ps);
  BEATW=220/song.bpb; T=Math.max(20,(maxP-38)*5+16); B=T+40;
  DEG_Y=Math.max(B+26, yOf(minP)+18); H=DEG_Y+8;
}
function staffPos(midi){ const d=dnote(midi); return {p:d.oct*7+d.li, li:d.li, alter:d.alter}; }
const yOf = p => B-(p-30)*5;   // E4 (p=30) sits on the bottom line
// ---------- VexFlow engraving ----------
// VexFlow places noteheads, accidentals, beams, ties and rests; this code keeps the app's own overlay
// (cell highlights, degree labels, bass row) and derives x(t)/edge(t) from where VexFlow put each note.
const VF = () => window.VexFlow;
// VexFlow gives each note space growing like factor^(share of the bar); its default (100) lets a long note
// swallow most of a sparse bar, so a gentler factor keeps beat positions closer to where they fall in time.
const VF_SOFTMAX = 10;
const BAR_PAD = 14;   // extra space between a barline (or clef/key) and the bar's first note
const vfOn = () => !!VF() && vfFontOk;   // the score is drawn once VexFlow and its music font are in
let vfFontOk = false, vfFailed = false;
const VDUR=[[4,"w"],[3,"hd"],[2,"h"],[1.5,"qd"],[1,"q"],[0.75,"8d"],[0.5,"8"],[0.375,"16d"],[0.25,"16"],[0.125,"32"]];
const TRIP=[[2/3,"q"],[1/3,"8"],[1/6,"16"]];   // triplet values: shown as the plain value under a 3
function splitDur(d){ const tp=TRIP.find(x=>Math.abs(x[0]-d)<1e-6); if(tp) return [[tp[0],tp[1],true]]; const out=[]; let r=d; while(r>1e-6){ const v=VDUR.find(x=>x[0]<=r+1e-6); if(!v) break; out.push(v); r-=v[0]; } return out; }
const SIGKEY={"0":"C","1":"G","2":"D","3":"A","4":"E","5":"B","6":"F#","7":"C#","-1":"F","-2":"Bb","-3":"Eb","-4":"Ab","-5":"Db","-6":"Gb","-7":"Cb"};
let vfHost=null;
function vfModW(first){
  const V=VF(), s=new V.Stave(0,0,400);
  s.addClef("treble").addKeySignature(SIGKEY[xp.sig]); if(first) s.addTimeSignature(`${song.bpb}/4`);
  return s.getNoteStartX();
}
function vfKey(midi){ const s=dnote(midi); return LETTERS[s.li].toLowerCase()+(s.alter>0?"#".repeat(s.alter):"b".repeat(-s.alter))+"/"+s.oct; }
// Engraving a system is the slow part of render(), so its result is cached per system. The key holds
// everything that changes the engraving; the selection, the 「着地点から」 marks and the play position are not in
// it, because svg() reads them from state each time it builds the markup.
let VF_CACHE = true;   // false: engrave every time (tools/smoke.py compares both)
const vfCache = new Map(), VF_CACHE_MAX = 64;
function vfSystem(b0,bars,first,last,bps,units){
  const cs=getComputedStyle(document.documentElement), cv=v=>cs.getPropertyValue(v).trim();
  const col={ct:cv("--ct"),tn:cv("--tn"),av:cv("--av"),nc:cv("--nc"),pk:cv("--ink-2"),un:cv("--ink")};
  // the colours are in the key too: they are baked into the note heads and follow the light/dark theme
  const key=JSON.stringify([state.songId, xp.name, bps, b0, HB, T, DEG_Y, Object.values(col), state.laMinor,
    units.map(i=>{ const u=state.chords[i]; return [u.s, u.l, u.root, u.q, u.bass||null]; })]);
  let E = VF_CACHE && vfCache.get(key);
  if(E){ vfCache.delete(key); vfCache.set(key, E); }   // keep recently used systems at the end
  else {
    E = vfEngrave(b0,bars,first,last,bps,units,col);
    if(VF_CACHE){ vfCache.set(key, E); if(vfCache.size>VF_CACHE_MAX) vfCache.delete(vfCache.keys().next().value); }
  }
  const {clefW, W, barW, sys0, info, inner}=E, M=vfMap(info, sys0), {x, edge}=M;
  const svg = () => {
    let g=""; const cells=[];
    units.forEach(i=>{ const u=state.chords[i], x1=edge(u.s), x2=edge(u.s+u.l); cells.push([+x1.toFixed(1),+x2.toFixed(1),i]);
      g+=`<rect class="hl${i===state.sel?" sel":""}" data-i="${i}" x="${x1}" y="0" width="${x2-x1}" height="${HB}"/>`; });
    g+=`<g class="vfw">${inner}</g>`;
    info.forEach(s=>s.heads.forEach(h=>{ if(h.rest || h.kind==="pk") return;
      g+=`<text class="deg f-${h.kind}${h.strong?"":" weak"}" x="${h.x}" y="${DEG_Y}" text-anchor="middle">${esc(h.label)}</text>`; }));
    if(HB>H){
      g+=`<text class="blab" x="4" y="${BASS_Y}">ベース</text>`;
      units.forEach(k=>{ const u=state.chords[k]; if(!u.root) return; const pv=state.chords[k-1];
        const d = pv&&pv.root ? mod(bassPc(u)-bassPc(pv)) : -1;
        const cls = d===0?"pedal": [1,2,10,11].includes(d)?"step":"";
        g+=`<text class="bnote ${cls}${u.bass?" sl":""}" x="${x(u.s)}" y="${BASS_Y}" text-anchor="middle">${esc(droot(u.bass||u.root))}</text>`; });
    }
    return `<svg viewBox="0 0 ${W} ${HB}" data-cells='${JSON.stringify(cells)}' data-w="${W}" role="img" aria-label="${b0+1}小節目からの旋律">${g}</svg>`;
  };
  return {clefW, W, M, svg, barW};
}
// The engraving of one system: VexFlow's SVG as a string, plus where each note and cell edge landed.
function vfEngrave(b0,bars,first,last,bps,units,col){
  const V=VF(), bpb=song.bpb, sys0=b0*bpb, key=SIGKEY[xp.sig];
  // Pickup: the space left of its notes matches the space after its last note (which grows with that note's
  // length), so a lone quarter-note pickup sits in the middle instead of hugging the time signature.
  const pkLast = song.pk ? song.notes.filter(n=>n.start<0).reduce((a,n)=>n.start>a.start?n:a, {start:-99, dur:0}).dur : 0;
  const PK_PAD = 16 + pkLast*BEATW*0.5, modW=vfModW(first), pkW = first&&song.pk ? song.pk*BEATW+30+PK_PAD : 0;
  const clefW = pkW ? modW+pkW : modW-6;
  // Every system gets the same total width (that of a plain clef+key line), so all staves are drawn at the
  // same scale; a wider opening (time signature, pickup) takes its room from that line's bars instead.
  const W = vfModW(false)-6 + bps*bpb*BEATW, barW = (W-clefW)/bps;
  if(!vfHost){ vfHost=document.createElement("div"); vfHost.setAttribute("aria-hidden","true");
    vfHost.style.cssText="position:absolute;left:-10000px;top:0;visibility:hidden"; document.body.appendChild(vfHost); }
  vfHost.innerHTML="";
  const R=new V.Renderer(vfHost, V.Renderer.Backends.SVG); R.resize(W,HB); const ctx=R.getContext();
  const segs=[];
  if(pkW) segs.push({t0:-song.pk, t1:0, x:0, w:clefW, mods:true, bx:0});
  for(let k=0;k<bars;k++){ const own=k===0&&!pkW;
    segs.push({t0:sys0+k*bpb, t1:sys0+(k+1)*bpb, x: own?0:clefW+k*barW, w: own?clefW+barW:barW, mods:own, bx:clefW+k*barW}); }
  const vn={}, info=[];   // vn[note idx] = {first,last}; info = per segment time→x points
  segs.forEach((sg,si)=>{
    const st=new V.Stave(sg.x, T-40, sg.w);
    if(sg.mods){ st.addClef("treble").addKeySignature(key); if(first) st.addTimeSignature(`${bpb}/4`); }
    // pickup: keep its notes clear of the time signature; other bars: a little room after the barline
    st.setNoteStartX(st.getNoteStartX() + (sg.t1<=0 ? PK_PAD : BAR_PAD));
    if(si>0) st.setBegBarType(V.BarlineType.NONE);
    if(last && si===segs.length-1) st.setEndBarType(V.BarlineType.END);
    st.setContext(ctx).draw();
    const evs=[...song.notes.filter(n=>n.start>=sg.t0-1e-6&&n.start<sg.t1-1e-6).map(n=>({n,start:n.start,dur:n.dur})),
               ...song.rests.filter(r=>r.start>=sg.t0-1e-6&&r.start<sg.t1-1e-6).map(r=>({rest:true,start:r.start,dur:r.dur}))]
               .sort((a,b)=>a.start-b.start);
    const tk=[], heads=[], tups=[]; let trip=[], tripDur=0;
    evs.forEach(e=>{
      let kind="pk", strong=false, label="";
      if(!e.rest && e.start>=0){ const ui=unitAt(e.start), u=state.chords[ui], r=roleOf(u,e.n.midi,keyAt(e.start));
        kind=r.kind; label=r.label; strong = u.root ? isStrong(e.n,u.s,u.l) : skelIdx(ui).has(e.n.idx); }
      const parts=splitDur(Math.min(e.dur, sg.t1-e.start)); let prev=null;
      parts.forEach(([d,code,isT],pi)=>{
        const sn = e.rest ? new V.StaveNote({keys:[bpb===3&&code==="w"?"d/5":"b/4"], duration:code+"r"})
                          : new V.StaveNote({keys:[vfKey(e.n.midi)], duration:code, autoStem:true});
        if(code.endsWith("d")) V.Dot.buildAndAttach([sn],{all:true});
        if(isT){ trip.push(sn); tripDur+=d;
          if(trip.length>=3 && Math.abs(tripDur-Math.round(tripDur))<1e-6){ tups.push(new V.Tuplet(trip,{numNotes:3, notesOccupied:2, bracketed:false})); trip=[]; tripDur=0; } }
        else if(trip.length){ trip=[]; tripDur=0; }
        if(!e.rest) sn.setKeyStyle(0,{fillStyle:col[kind]||col.un});
        tk.push(sn);
        if(pi===0){ heads.push({e,sn,kind,label,strong}); if(!e.rest) vn[e.n.idx]={first:sn,last:sn}; }
        else if(!e.rest){ vn[e.n.idx].last=sn; }
        if(prev && !e.rest) ctxTies.push([prev,sn]);
        prev=sn;
      });
    });
    if(tk.length){
      // VexFlow pushes the last note of a bar against the right edge, whatever its length. A ghost note
      // after it reserves room proportional to the last note's duration, as the old spacing did.
      const lastCode=tk[tk.length-1].getDuration();
      const voice=new V.Voice({numBeats:bpb, beatValue:4}).setMode(V.Voice.Mode.SOFT); voice.addTickables([...tk, new V.GhostNote({duration:lastCode})]);
      V.Accidental.applyAccidentals([voice], key);
      const beams=V.Beam.generateBeams(tk.filter(n=>!n.isRest()), {groups:[new V.Fraction(1,4)]});
      new V.Formatter({softmaxFactor:VF_SOFTMAX}).joinVoices([voice]).formatToStave([voice], st);
      voice.draw(ctx, st); beams.forEach(b=>b.setContext(ctx).draw());
      tups.forEach(t=>t.setTupletLocation(V.Tuplet.LOCATION_TOP).setContext(ctx).draw());   // above, clear of the degree row
    }
    const pts=[[sg.t0, st.getNoteStartX()]];
    heads.forEach(h=>{ const sn=h.sn, cx = h.e.rest ? sn.getAbsoluteX()+sn.getWidth()/2 : (sn.getNoteHeadBeginX()+sn.getNoteHeadEndX())/2;
      const left = h.e.rest ? sn.getAbsoluteX() : sn.getNoteHeadBeginX() - (sn.getMetrics().modLeftPx||0);
      h.x=cx; h.left=left;
      if(Math.abs(h.e.start-sg.t0)<1e-6) pts[0]=[sg.t0,cx]; else pts.push([h.e.start,cx]); });
    pts.push([sg.t1, st.getNoteEndX()]);
    info.push({sg, pts, heads});
  });
  ctxTies.splice(0).forEach(([a,b])=>new V.StaveTie({firstNote:a,lastNote:b,firstIndexes:[0],lastIndexes:[0]}).setContext(ctx).draw());
  song.notes.forEach(n=>{ if(!n.tie) return; const a=vn[n.idx], b=vn[n.idx+1]; if(!a&&!b) return;
    new V.StaveTie({firstNote:a?a.last:undefined, lastNote:b?b.first:undefined, firstIndexes:[0], lastIndexes:[0]}).setContext(ctx).draw(); });
  // copied out as a string: vfHost is reused by the next system, and nothing below reads it again
  const inner=vfHost.querySelector("svg").innerHTML;
  // only plain values go into the cache: no VexFlow objects, no closures over this function's locals
  const plain=info.map(({sg,pts,heads})=>({t0:sg.t0, t1:sg.t1, bx:sg.bx, x:sg.x, w:sg.w, pts,
    heads:heads.map(h=>({start:h.e.start, rest:!!h.e.rest, x:h.x, left:h.left, kind:h.kind, label:h.label, strong:h.strong}))}));
  return {clefW, W, barW, sys0, info:plain, inner};
}
const ctxTies=[];
// time → x on one engraved system (x: between note positions; edge: where a cell starting at t begins)
function vfMap(info, sys0){
  const seg = t => info.find(s=>t>=s.t0-1e-6 && t<s.t1-1e-6) || info[info.length-1];
  const x = t => { const s=seg(t), p=s.pts; let j=0; while(j<p.length-2 && t>=p[j+1][0]-1e-6) j++;
    const f=(t-p[j][0])/(p[j+1][0]-p[j][0]||1); return p[j][1]+f*(p[j+1][1]-p[j][1]); };
  const edge = t => { const s=info.find(ss=>Math.abs(ss.t0-t)<1e-6 && ss.t0>=sys0-1e-6);
    if(s) return s.bx;
    const l=info[info.length-1]; if(Math.abs(t-l.t1)<1e-6) return l.x+l.w;
    const h=seg(t).heads.find(hh=>Math.abs(hh.start-t)<1e-6);
    return h ? h.left-6 : x(t)-10; };
  return {x, edge};
}
function vfWaitFonts(){
  if(!VF()) return;
  let n=0; const tick=()=>{
    if(song && document.fonts.check("30px Bravura")){ vfFontOk=true; setGeom(); render(); return; }
    if(++n<80) setTimeout(tick,100); else { vfFailed=true; render(); } };
  tick();
}

// Changing only the selection: move the marks on the score instead of rebuilding it, then redo the
// right-hand panel. The whole render() is still used when the score itself may look different.
function selectCell(i){
  const prev=state.sel; state.sel=i;
  const sheet=$("#sheet");
  if(!vfOn() || !sheet.querySelector(`.slot[data-i="${i}"]`)
     || (state.harm && keyOfCell(prev).minor!==keyOfCell(i).minor)){ render(); return; }   // the ラ toggle in #summary may come or go
  sheet.querySelectorAll(".slot.sel, rect.hl.sel").forEach(e=>e.classList.remove("sel"));
  sheet.querySelectorAll(`.slot[data-i="${i}"], rect.hl[data-i="${i}"]`).forEach(e=>e.classList.add("sel"));
  renderInsp();
}
// the comparison plan's chord over cell i, shown on the line above the chord name when it differs
function cmpMark(i){
  const d=planDiff(cmpPlan, state.chords[i]);
  return d.differs ? `<span class="cmpc">${esc(plans.list[cmpPlan].name)} ${d.o&&d.o.root?esc(sym(d.o)):"—"}</span>` : "";
}
function renderPlans(){
  const L=plans.list, n=L.length, cur=plans.cur;
  const diffs = cmpPlan!=null ? state.chords.filter(u=>planDiff(cmpPlan,u).differs).length : 0;
  $("#plansBar").innerHTML = `<span class="tlabel">案</span>
    ${L.map((p,k)=>`<button class="btn small plan${k===cur?" on":""}" data-plan="${k}" aria-pressed="${k===cur}">${esc(p.name)}</button>`).join("")}
    ${n<PLAN_MAX?`<button class="btn small" id="planNew" title="いまの案を写して、新しい案を作ります">＋ 新しい案</button>`:""}
    ${n>1?`<label class="chk">比べる相手 <select id="planCmp" class="btn small"><option value="">なし</option>${L.map((p,k)=>k===cur?"":`<option value="${k}"${k===cmpPlan?" selected":""}>${esc(p.name)}</option>`).join("")}</select></label>`:""}
    ${cmpPlan!=null?`<span>違う枠 <b>${diffs}</b></span><button class="btn small" id="planPlayCmp">${play&&play.mode==="plan"?"■ 停止":`▶ ${esc(L[cmpPlan].name)}を再生`}</button>`:""}
    <span class="sp"></span>
    ${n>1?`<button class="btn small warn" id="planDel">${esc(L[cur].name)}を削除</button>
      <span class="confirm" id="planDelConfirm" hidden>${esc(L[cur].name)}を削除しますか？（元に戻せません）
        <button class="btn small warn" id="planDelYes">削除</button><button class="btn small" id="planDelNo">やめる</button></span>`:""}`;
}
function render(){
  $("#songSel").value=state.songId;
  const n=state.chords.length, bpb=song.bpb, nb=song.nbars, bps=barsPerSystem();
  $("#sheet").classList.toggle("narrow", isNarrow());
  const chainSet=new Set(rev.chain.map(e=>e.i));
  const cOn = state.tab==="guide" && courseOn(), cMarks = cOn ? courseMarks() : new Set();
  const showBass = state.chords.some(u=>u.bass) || (!state.harm && state.tab==="guide" && (cOn ? cStepId() : rflow())==="bass");
  BASS_Y = DEG_Y+17; HB = showBass ? DEG_Y+24 : H;
  const gs = (!state.harm && state.tab==="guide" && !cOn) ? rflow() : null;
  const canSet = new Set(TECH[gs] ? state.chords.map((u,k)=>k).filter(k=>rStepUsable(gs,k)) : []);
  $("#legendCan").hidden = !canSet.size;
  let html="", cnt={good:0,ok:0,bad:0,none:0}, changed=0, match=0, fnMatch=0;
  const ready=vfOn();
  if(!ready) html=`<p class="hint sheetmsg">${vfFailed||!VF() ? "楽譜を描く部品（VexFlow）を読み込めませんでした。通信の状態を確かめて、ページを読み込み直してください。" : "楽譜を準備しています…"}</p>`;
  for(let b0=0; ready && b0<nb; b0+=bps){
    const bars=Math.min(bps,nb-b0), first=b0===0, last=b0+bars>=nb, sys0=b0*bpb, sys1=(b0+bars)*bpb, pad=(bps-bars)*bpb;
    const units=state.chords.map((u,i)=>i).filter(i=>state.chords[i].s>=sys0-1e-6 && state.chords[i].s<sys1-1e-6);
    const L=vfSystem(b0,bars,first,last,bps,units), clefW=L.clefW, M=L.M;
    html+=`<div class="sys" style="grid-template-columns:${clefW}fr ${units.map(i=>{ const u=state.chords[i]; return `${(M.edge(u.s+u.l)-M.edge(u.s)).toFixed(2)}fr`; }).join(" ")}${pad?` ${pad/bpb*L.barW}fr`:""}"><span class="lead">${b0+1}</span>`;
    units.forEach(i=>{
      const c=state.chords[i], o=origAt(i), v=verdict(rolesFor(c,i));
      cnt[v]++; const mod_=isChanged(i); if(mod_) changed++; if(state.harm && same(c,o)) match++;
      else if(state.harm && state.reveal && c.root){ const K=keyAt(c.s), A=analyze(c,K); if(A.fn && A.fn===analyze(o,K).fn) fnMatch++; }
      const cls = (canSet.has(i)?" can":"")+(i===state.sel?" sel":"")+(i===rev.target?" tgt":"")+(chainSet.has(i)?" chain":"")+(cMarks.has(i)?" task":"")+(c.l<=1?" small":"");
      html+=`<button class="slot${cls}" data-i="${i}" aria-label="${slotName(i)} ${esc(sym(c))}">
        <span class="orig">${cmpPlan!=null ? cmpMark(i) : state.harm ? (state.reveal?`<span class="ans${same(c,o)?" hit":""}">原曲 ${esc(sym(o))}</span>`:esc(c.tech||"")) : (mod_?`<s>${esc(sym(o))}</s> ${esc(c.tech||"")}`:"")}</span>
        <span class="chord">${esc(sym(c))}<i class="dot ${v}"></i></span>${state.roman?`<span class="rom">${c.root?esc(analyze(c,keyAt(c.s),state.chords[i+1]).roman):"&nbsp;"}</span>`:""}
      </button>`;
    });
    html+=L.svg()+`</div>`;
  }
  $("#sheet").innerHTML=html;
  renderPlans();
  $("#summary").innerHTML = state.harm ? `<span>コードを置いた枠 <b>${changed}</b> / ${n}</span>
    <span class="pill good">○ ${cnt.good}</span><span class="pill ok">△ ${cnt.ok}</span><span class="pill bad">✕ ${cnt.bad}</span>
    <label class="chk"><input type="checkbox" id="revealOn" ${state.reveal?"checked":""}>原曲のコードを見る</label>
    <label class="chk"><input type="checkbox" id="romanOn" ${state.roman?"checked":""}>度数を表示</label>
    ${isMinor() || keyOfCell(state.sel).minor ? `<label class="chk"><input type="checkbox" id="laOn" ${state.laMinor?"checked":""}>短調はラから読む</label>` : ""}
    ${state.reveal&&cmpPlan==null?`<span>原曲と同じ：<b>${match}</b> 枠、同じ機能：<b>${fnMatch}</b> 枠（違っていても、合っていれば正解です）</span>`:""}` :
    `<span>置き換え <b>${changed}</b> / ${n} か所</span>
    <span class="pill good">○ ${cnt.good}</span><span class="pill ok">△ ${cnt.ok}</span><span class="pill bad">✕ ${cnt.bad}</span>
    <span>${cnt.bad? "赤い点の枠は、骨格の音（強拍や長い音）がコードとぶつかっています。":"骨格の音がぶつかっている枠はありません。"}</span>
    <label class="chk"><input type="checkbox" id="romanOn" ${state.roman?"checked":""}>度数を表示</label>`;
  renderInsp();
}
