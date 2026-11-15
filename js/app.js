// Song menu, custom-song editor, keyboard and button events, start-up.
// ---------- songs menu, custom songs, events ----------
// Built-in songs from easiest to hardest: length, metre and pickup, then how far the harmony
// strays from I・IV・V (secondary dominants, minor key, jazz changes).
const SONG_LEVELS = [
  ["入門（I・IV・V）", ["twinkle","joy","jingle","saints"]],
  ["初級（3拍子・アウフタクト）", ["happy","akatombo","amazing","silent"]],
  ["中級（ブルース・短調・ジャズ）", ["blues","godrest","tea"]],
];
const songLabel = s => `${esc(s.name)}（${s.bpb}/4）`;
function songOptions(){
  const all=Object.entries(SONGS), mine=all.filter(([,s])=>s.custom);
  const opt = id => SONGS[id] ? `<option value="${id}">${songLabel(SONGS[id])}</option>` : "";
  const listed = new Set(SONG_LEVELS.flatMap(([,ids])=>ids));
  const rest = all.filter(([id,s])=>!s.custom && !listed.has(id)).map(([id])=>id);
  $("#songSel").innerHTML = SONG_LEVELS.map(([label,ids],k)=>`<optgroup label="${label}">${ids.map(opt).join("")}${k===SONG_LEVELS.length-1?rest.map(opt).join(""):""}</optgroup>`).join("")
    + (mine.length?`<optgroup label="自分の曲">${mine.map(([id,s])=>`<option value="${id}">${songLabel(s)}</option>`).join("")}</optgroup>`:"");
  if(state.songId && SONGS[state.songId]) $("#songSel").value=state.songId;
}
const customList = () => store.get("rehamo:songs") || [];
function registerCustom(){ customList().forEach(d=>{ SONGS[d.id]={...d, custom:true}; }); }
const TONICS = ["C","C#","D♭","D","E♭","E","F","F#","G","A♭","A","B♭","B"];
$("#fTonic").innerHTML = TONICS.map(t=>`<option value="${t}">${keyLabel(t)}</option>`).join("");
const fmtDur = d => +d.toFixed(4);
function parseTok(tok){
  const D="(\\d+\\/\\d+|\\d*\\.?\\d+)", ds = x => x && x.includes("/") ? x : fmtDur(durOf(x));   // keep "1/3" as written
  let m=tok.match(new RegExp(`^r(?::${D})?$`,"i"));
  if(m){ const dur=durOf(m[1]); return dur>0?{rest:true,dur,norm:`r:${ds(m[1])}`}:null; }
  m=tok.match(new RegExp(`^([A-Ga-g])([#b♯♭]?)(\\d)(?::${D})?(~?)$`));
  if(!m) return null;
  const dur=durOf(m[4]); if(!(dur>0)) return null;
  const acc=m[2].replace("♯","#").replace("♭","b");
  return {dur, norm:`${m[1].toUpperCase()}${acc}${m[3]}:${ds(m[4])}${m[5]}`};
}
const fBeats = s => fmtDur(s);
function compileForm(){
  const errs=[], name=$("#fName").value.trim(), bpb=+$("#fMeter").value;
  const slot = bpb;
  const tonic=$("#fTonic").value, mode=$("#fMode").value;
  if(!name) errs.push("曲名を入れてください。");
  const toks = (txt, where) => { let sum=0; const out=[];
    txt.trim().split(/\s+/).filter(Boolean).forEach(t=>{ const p=parseTok(t);
      if(!p) errs.push(`${where}: 「<code>${esc(t)}</code>」を読み取れません。`); else { sum+=p.dur; out.push(p.norm); } });
    return {sum, out}; };
  let pickup="";
  if($("#fPickup").value.trim()){
    const p=toks($("#fPickup").value,"アウフタクト");
    if(p.sum>=bpb) errs.push(`アウフタクトは ${bpb} 拍より短くしてください（いま ${fBeats(p.sum)} 拍）。`);
    pickup=p.out.join(" ");
  }
  const mBars=$("#fMelody").value.split("|").map(s=>s.trim()).filter(Boolean);
  if(!mBars.length) errs.push("旋律を入れてください。");
  const bars=mBars.map((b,i)=>{ const p=toks(b,`旋律 ${i+1}小節目`); const last=i===mBars.length-1;
    if(p.sum>bpb+1e-6 || (!last && Math.abs(p.sum-bpb)>1e-6))
      errs.push(`旋律 ${i+1}小節目: 拍の合計が ${fBeats(p.sum)} 拍です（${bpb} 拍にしてください）。`);
    if(last && p.sum<bpb-1e-6 && p.sum>0) p.out.push(`r:${fmtDur(bpb-p.sum)}`);
    return p.out.join(" "); });
  const cBars=$("#fChords").value.split("|").map(s=>s.trim()).filter(Boolean);
  if(mBars.length && cBars.length!==mBars.length) errs.push(`コードの小節数（${cBars.length}）と旋律の小節数（${mBars.length}）が合っていません。`);
  let prev=null; const cOut=[];
  cBars.forEach((b,i)=>{
    let ts=b.split(/\s+/).filter(Boolean);
    if(ts.length<1 || ts.length>bpb){ errs.push(`コード ${i+1}小節目: 1〜${bpb} 個にしてください（いま ${ts.length} 個）。`); return; }
    const row=ts.map(t=>{ if((t==="-"||t==="%")){ if(!prev){ errs.push(`コード ${i+1}小節目: 最初のコードに「-」は使えません。`); return "C"; } return prev; }
      if(!parseChord(t)){ errs.push(`コード ${i+1}小節目: 「<code>${esc(t)}</code>」は使えないコードです（書き方を参照）。`); return "C"; }
      prev=t; return t; });
    cOut.push(row.join(" "));
  });
  return {errs, def:{name, bpb, slot, mode, src:tonic, origKey:tonic, pickup,
    bars, chords:cOut.join(" | "), raw:{melody:$("#fMelody").value, chords:$("#fChords").value, pickup:$("#fPickup").value}}};
}
let editingId=null, delArmed=0;
function openEditor(id){
  editingId=id; delArmed=0; const d=id?SONGS[id]:null;
  $("#edTitle").textContent = d?"曲を編集":"曲を入力";
  $("#fName").value=d?d.name:""; $("#fMeter").value=d?String(d.bpb):"4";
  $("#fTonic").value=d?d.src:"C"; $("#fMode").value=d?d.mode:"major";
  $("#fPickup").value=d?d.raw.pickup:""; $("#fMelody").value=d?d.raw.melody:""; $("#fChords").value=d?d.raw.chords:"";
  $("#edDelete").hidden=!d; $("#edDelete").textContent="この曲を削除"; $("#edErr").innerHTML="";
  $("#editor").hidden=false; stop(); $("#fName").focus();
}
function closeEditor(){ $("#editor").hidden=true; }
$("#newSong").onclick=()=>openEditor(null);
$("#editSong").onclick=()=>openEditor(state.songId);
$("#edClose").onclick=closeEditor;
$("#editor").addEventListener("keydown",e=>{ if(e.key==="Escape") closeEditor(); });
$("#editor").addEventListener("click",e=>{ if(e.target.id==="editor") closeEditor(); });
$("#edSample").onclick=()=>{
  $("#fName").value="かえるのうた（例）"; $("#fMeter").value="4"; $("#fTonic").value="F"; $("#fMode").value="major"; $("#fPickup").value="";
  $("#fMelody").value="F4 G4 A4 Bb4 | A4 G4 F4:2 |\nA4 Bb4 C5 D5 | C5 Bb4 A4:2 |\nF4:2 F4:2 | F4:2 F4:2 |\nF4:0.5 F4:0.5 G4:0.5 G4:0.5 A4:0.5 A4:0.5 Bb4:0.5 Bb4:0.5 | A4 G4 F4:2";
  $("#fChords").value="F | C7 F | F | C7 F |\nF | - |\nF C7 | C7 F";
};
$("#edDelete").onclick=()=>{
  if(Date.now()-delArmed>3000){ delArmed=Date.now(); $("#edDelete").textContent="もう一度押すと削除します"; return; }
  store.set("rehamo:songs", customList().filter(d=>d.id!==editingId));
  delete SONGS[editingId]; closeEditor(); songOptions(); loadSong("twinkle");
};
$("#edForm").addEventListener("submit",e=>{
  e.preventDefault();
  const {errs, def}=compileForm();
  if(errs.length){ $("#edErr").innerHTML=`<ul>${errs.slice(0,12).map(x=>`<li>${x}</li>`).join("")}</ul>`; return; }
  def.id = editingId || ("u"+Date.now().toString(36));
  const list=customList().filter(d=>d.id!==def.id); list.push(def); store.set("rehamo:songs", list);
  SONGS[def.id]={...def, custom:true};
  store.set("rehamo:"+def.id, null); store.set("rehamo:key:"+def.id, null);
  closeEditor(); state.songId=null; songOptions(); loadSong(def.id);
});
registerCustom();
songOptions();
$("#songSel").onchange=e=>{ if(e.target.value!==state.songId) loadSong(e.target.value); };
$("#keySel").onchange=e=>{ stop(); setKey(e.target.value); store.set("rehamo:key:"+state.songId, e.target.value); setGeom(); render(); };
function slotFromEvent(e){
  const s=e.target.closest(".slot"); if(s) return +s.dataset.i;
  const svg=e.target.closest("svg"); if(!svg) return -1;
  const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*(+svg.dataset.w);
  const hit=JSON.parse(svg.dataset.cells||"[]").find(c=>x>=c[0] && x<c[1]);
  return hit ? hit[2] : -1;
}
$("#sheet").onclick=e=>{ const i=slotFromEvent(e); if(i<0) return; state.sel=i; render(); };
$("#sheet").ondblclick=e=>{ if(slotFromEvent(e)>=0) previewSel(); };
let lastBps=0;
if(window.ResizeObserver) new ResizeObserver(()=>{ const b=barsPerSystem(); if(lastBps && b!==lastBps) render(); lastBps=b; }).observe($("#sheet"));
$("#playAll").onclick=()=>{ if(play&&play.mode==="all") stop(); else playRange(0,state.chords.length,state.chords,"all"); };
document.querySelectorAll(".modesw button").forEach(b=>b.onclick=()=>{ const h=b.dataset.mode==="harm"; if(h===state.harm) return; stop(); state.harm=h; state.reveal=false; $("#resetConfirm").hidden=true; store.set("rehamo:harm",state.harm); restoreTab(); applyHarmUi(); loadSong(state.songId); });
function applyHarmUi(){
  $("#playOrig").hidden = state.harm && !state.reveal;
  $("#reset").textContent = state.harm ? "すべて消す" : "すべて原曲に戻す";
  document.body.classList.toggle("harm", state.harm);
  document.querySelectorAll(".modesw button").forEach(b=>b.setAttribute("aria-pressed", String((b.dataset.mode==="harm")===state.harm)));
  $("#modeDesc").textContent = state.harm ? "旋律に合うコードを一から付けて、メロディ音との関係を確かめる" : "コードを置き換えて、メロディ音がそのコードの何度になるかを確かめる";
}
$("#summary").addEventListener("change",e=>{
  if(e.target.id==="revealOn"){ state.reveal=e.target.checked; applyHarmUi(); render(); }
  if(e.target.id==="romanOn"){ state.roman=e.target.checked; store.set("rehamo:roman", state.roman); render(); }
});
$("#playOrig").onclick=()=>{ if(play&&play.mode==="orig") stop(); else { const ou=origUnits(); playRange(0,ou.length,ou,"orig"); } };
const TERM_TEXT = {
  ct:["和声音","コードを形づくる音です（根音 R・3度・5度・7度など）。メロディがこの音だと、コードによく溶け込みます。"],
  tn:["テンション","コードの音には含まれないけれど、重ねると響きを豊かにする音です（9・11・13度など）。ジャズやポップスでは、強拍や長い音にあっても「しゃれた響き」として使えます。"],
  av:["アボイド","コードの音と半音でぶつかって、響きを濁らせやすい音です。たとえば C の上のファ（11度）は、コードのミと半音でぶつかります。弱拍で通り過ぎるだけなら問題ありませんが、強拍や長い音では避けるか、コードを替えます。"],
  sk:["骨格の音","耳に残りやすい音のことです。枠の最初の音、強拍（小節の1拍目。4拍子では3拍目も）の音、長くのびる音がこれに当たります。コードとの相性は、この音で判定します。それ以外の短い音は、経過音や刺繍音として通り過ぎるなら、ぶつかっても気になりません。音符の下の数字は、骨格の音が濃く、それ以外が薄く表示されます。"],
  nc:["非和声音","コードの音にもテンションにも当たらない音です。経過音（音階を順に通り過ぎる音）や刺繍音（隣の音に行って戻る音）として弱拍で鳴るなら自然ですが、強拍で長く鳴るとぶつかって聞こえます。"],
};
document.querySelectorAll(".legend .term").forEach(b=>b.onclick=()=>{
  const open=b.getAttribute("aria-expanded")==="true", box=$("#termbox");
  document.querySelectorAll(".legend .term").forEach(x=>x.setAttribute("aria-expanded","false"));
  if(open){ box.hidden=true; return; }
  const [t,txt]=TERM_TEXT[b.dataset.term]; box.innerHTML=`<b>${t}</b>${txt}`; box.hidden=false; b.setAttribute("aria-expanded","true");
});
// A tempo change while playing restarts playback from the current beat at the new tempo
// (debounced, so dragging the slider does not re-attack the chords on every step).
let bpmTimer=0;
$("#bpm").oninput=e=>{ state.bpm=+e.target.value; $("#bpmOut").textContent=state.bpm;
  if(!play) return; clearTimeout(bpmTimer);
  bpmTimer=setTimeout(()=>{ if(!play) return; const p=play, at=p.beat();
    playRange(p.from, p.to, p.chords, p.mode, Math.max(at, p.chords[p.from].s-(p.from===0?song.pk:0))); }, 90); };
$("#melOn").onchange=e=>{ state.melOn=e.target.checked; };
// the current progression as plain text, four bars to a line (with a line of degrees when they are shown)
function progText(){
  const head=`${song.name}（Key: ${keyName(xp.name)}、${song.bpb}/4）`, rows=[], degs=[]; let row=[], drow=[];
  for(let b=0;b<song.nbars;b++){
    const cs=state.chords.map((u,k)=>[u,k]).filter(([u])=>u.s>=b*song.bpb-1e-6 && u.s<(b+1)*song.bpb-1e-6);
    row.push(cs.map(([u])=>u.root?sym(u):"？").join("  "));
    drow.push(cs.map(([u,k])=>u.root?analyze(u,keyAt(u.s),state.chords[k+1]).roman:"？").join("  "));
    if(row.length===4 || b===song.nbars-1){ rows.push("| "+row.join(" | ")+" |"); degs.push("| "+drow.join(" | ")+" |"); row=[]; drow=[]; }
  }
  return [head, ...rows, ...(state.roman?["", "度数", ...degs]:[])].join("\n");
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); return true; }catch(e){}
  try{ const ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta);
    ta.select(); const ok=document.execCommand("copy"); ta.remove(); return ok; }catch(e){ return false; }
}
$("#copyProg").onclick=async()=>{
  const t=progText(), ok=await copyText(t), b=$("#copyProg"), box=$("#progBox");
  if(ok){ box.hidden=true; b.textContent="コピーしました"; }
  else { box.value=t; box.hidden=false; box.focus(); box.select(); b.textContent="下に表示しました"; }   // clipboard refused: show it for manual copying
  setTimeout(()=>{ b.textContent="コード進行をコピー"; }, 1800);
};
$("#reset").onclick=()=>{ $("#resetMsg").textContent = state.harm?"置いたコードをすべて消しますか？":"置き換えをすべて元に戻しますか？";
  $("#resetConfirm").hidden=false; $("#resetYes").focus(); };
$("#resetNo").onclick=()=>{ $("#resetConfirm").hidden=true; };
$("#resetYes").onclick=()=>{ $("#resetConfirm").hidden=true; stop();
  rev={target:null,chain:[]}; state.chords=state.harm?emptyUnits():origUnits(); state.sel=Math.min(state.sel,state.chords.length-1); save(); render(); };
$("#undoBtn").onclick=()=>histGo(-1);
$("#redoBtn").onclick=()=>histGo(1);
// Space plays from the selected cell (or stops), unless a control that uses Space itself has the focus
const spaceFree = () => { const a=document.activeElement; return !a || a===document.body || a.classList.contains("slot"); };
document.addEventListener("keyup",e=>{ if(e.key===" " && spaceFree() && $("#editor").hidden) e.preventDefault(); });
document.addEventListener("keydown",e=>{
  if(["SELECT","INPUT","TEXTAREA"].includes(document.activeElement.tagName) || !$("#editor").hidden) return;
  if((e.ctrlKey||e.metaKey) && !e.altKey && (e.key.toLowerCase()==="z" || e.key.toLowerCase()==="y")){
    e.preventDefault(); histGo(e.key.toLowerCase()==="y" || e.shiftKey ? 1 : -1); return;
  }
  if(e.key===" " && spaceFree()){
    e.preventDefault(); if(play) stop(); else playRange(state.sel, state.chords.length, state.chords, "here"); return;
  }
  if(/^[A-Ga-g]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey){
    e.preventDefault(); openQuick(e.key.toUpperCase()); return;
  }
  if((e.key==="Delete"||e.key==="Backspace") && state.harm){
    e.preventDefault(); const u=state.chords[state.sel]; state.chords[state.sel]={s:u.s,l:u.l,root:null,q:null}; save(); render(); return;
  }
  if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
    e.preventDefault(); state.sel=Math.max(0,Math.min(state.chords.length-1,state.sel+(e.key==="ArrowRight"?1:-1))); render();
    const s=document.querySelector(`.slot[data-i="${state.sel}"]`); s&&s.focus({preventScroll:false});
  }
});

// ---------- quick chord entry by typing ----------
function quickParse(v){
  v=v.trim(); if(!v) return null;
  v=v[0].toUpperCase()+v.slice(1);
  const c=parseChord(v); if(!c) return null;
  const o={root:MANUAL_ROOTS[mod(rootPc(c.root)-xp.semis)], q:c.q}; if(c.bass) o.bass=MANUAL_ROOTS[mod(rootPc(c.bass)-xp.semis)]; return o;   // typed in the shown key → C frame
}
function quickHint(){
  const c=quickParse($("#quickIn").value);
  $("#quickHint").textContent = c ? `→ ${slotName(state.sel)} に ${sym(c)} を置く（Enter）` : "読み取れません（例：C, Cm7, F#m7(b5), Bb7, G7sus4, C/E）";
  $("#quick").classList.toggle("bad", !c);
}
function openQuick(ch){
  const q=$("#quick"), inp=$("#quickIn"); q.hidden=false; inp.value=ch; inp.focus(); inp.setSelectionRange(1,1); quickHint();
}
function closeQuick(){ $("#quick").hidden=true; }
$("#quickIn").addEventListener("input", quickHint);
$("#quickIn").addEventListener("blur", closeQuick);
$("#quickIn").addEventListener("keydown", e=>{
  if(e.key==="Escape"){ e.preventDefault(); closeQuick(); return; }
  if(e.key==="Enter"){
    e.preventDefault(); const c=quickParse($("#quickIn").value); if(!c) return;
    const i=state.sel; closeQuick(); setChord(i, c, "手入力");
    playRange(i, i+1, state.chords, "slot");
    if(i<state.chords.length-1){ state.sel=i+1; render(); }
  }
});

restoreTab(); applyHarmUi();
const last=store.get("rehamo:last");
loadSong(SONGS[last]?last:"twinkle");
vfWaitFonts();   // after loadSong: its re-render needs a song in place
