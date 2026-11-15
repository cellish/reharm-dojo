// App state, saving, undo/redo, and edits to the chord cells.
// ---------- state ----------
function store0(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
const state = {songId:"twinkle", chords:[], sel:0, bpm:88, melOn:true, tab:"rev", harm:!!store0("rehamo:harm"), reveal:false, roman:!!store0("rehamo:roman"),
  loop:!!store0("rehamo:loop"), mix:Number.isFinite(store0("rehamo:mix"))?store0("rehamo:mix"):50};
let rev = {target:null, chain:[]};   // chain: [{i, prev}] from the target backwards
const openTech = new Set();
let song;
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function loadSong(id){
  stop(); state.songId=id; song=buildSong(id);
  const want = store.get("rehamo:key:"+id) || song.origKey || song.home || (isMinor()?"A":"C");
  const kk = KEYS_NOW().find(x=>rootPc(x[0])===rootPc(want)), k = kk?kk[0]:KEYS_NOW()[0][0];
  const isOrig = n => song.origKey && rootPc(n)===rootPc(song.origKey);
  $("#keySel").innerHTML = KEYS_NOW().map(([n])=>`<option value="${n}">${keyName(n)}${isOrig(n)?"（原調）":""}</option>`).join("");
  $("#keySel").value=k; setKey(k); setGeom();
  const saved = store.get(saveKey(id)), total=totalBeats();
  const okSaved = Array.isArray(saved) && saved.length && saved.every(u=>u && typeof u.s==="number" && u.l>0 && (u.q===null || Q[u.q]!==undefined))
    && Math.abs(saved.reduce((a,u)=>a+u.l,0)-total)<1e-6;
  state.chords = okSaved ? saved : (state.harm ? emptyUnits() : origUnits());
  state.sel=0; rev={target:null, chain:[]}; store.set("rehamo:last", id);
  hist={undo:[], redo:[], last:JSON.stringify(state.chords)}; histButtons();
  $("#editSong").hidden = !song.custom; render();
}
const tabKey = () => state.harm?"rehamo:tab:h":"rehamo:tab";
const restoreTab = () => { state.tab = store.get(tabKey()) || "guide"; };
const saveKey = id => (state.harm?"rehamo:h:":"rehamo:")+id;
const emptyUnits = () => Array.from({length:song.nbars},(x,b)=>({s:b*song.bpb, l:song.bpb, root:null, q:null}));
let hist={undo:[], redo:[], last:null};
function save(){
  const snap=JSON.stringify(state.chords);
  if(hist.last!=null && snap!==hist.last){ hist.undo.push(hist.last); if(hist.undo.length>200) hist.undo.shift(); hist.redo=[]; }
  hist.last=snap; store.set(saveKey(state.songId), state.chords); histButtons();
}
function histGo(dir){
  const from=dir<0?hist.undo:hist.redo, to=dir<0?hist.redo:hist.undo; if(!from.length) return;
  stop(); to.push(hist.last); hist.last=from.pop(); state.chords=JSON.parse(hist.last);
  rev={target:null, chain:[]}; state.sel=Math.min(state.sel, state.chords.length-1);
  store.set(saveKey(state.songId), state.chords); histButtons(); render();
}
function histButtons(){ $("#undoBtn").disabled=!hist.undo.length; $("#redoBtn").disabled=!hist.redo.length; }
function setChord(i, c, tech){
  const u=state.chords[i], o=origAt(i);
  state.chords[i] = !state.harm && same(c,o) && sameCell(u,o) ? {s:u.s, l:u.l, root:o.root, q:o.q} : {s:u.s, l:u.l, root:c.root, q:c.q, tech};
  if(c.bass && rootPc(c.bass)!==rootPc(c.root)) state.chords[i].bass=c.bass;
  save(); render();
}
const isChanged = i => { const u=state.chords[i]; if(state.harm) return !!u.root; const o=origAt(i); return !same(u,o) || !sameCell(u,o); };
// put back the original chord cells over the span of unit i (undoes splits/merges there)
function restoreOrig(i){
  const u=state.chords[i], a=u.s, b=u.s+u.l;
  const os=song.orig.filter(c=>c.s+c.l>a+1e-6 && c.s<b-1e-6);
  const lo=Math.min(a, ...os.map(c=>c.s)), hi=Math.max(b, ...os.map(c=>c.s+c.l));
  const first=state.chords.findIndex(x=>x.s+x.l>lo+1e-6), last=state.chords.findIndex(x=>x.s>=hi-1e-6);
  const end = last<0 ? state.chords.length : last;
  const repl=song.orig.filter(c=>c.s>=lo-1e-6 && c.s<hi-1e-6).map(c=>({...c}));
  state.chords.splice(first, end-first, ...repl);
  rev={target:null, chain:[]}; state.sel=Math.min(first, state.chords.length-1); save();
}
function shiftRev(from, by){
  if(rev.target!=null && rev.target>=from) rev.target+=by;
  rev.chain.forEach(e=>{ if(e.i>=from) e.i+=by; });
}
function splitUnit(i, quiet){   // quiet: the caller goes on editing and saves once at the end
  const u=state.chords[i]; if(u.l<2) return;
  const a=Math.ceil(u.l/2);
  state.chords.splice(i,1,{...u, l:a},{...u, s:u.s+a, l:u.l-a, tech:u.tech||"分割"});
  shiftRev(i+1,1); if(!quiet) save();
}
function canMerge(i){ const u=state.chords[i], v=state.chords[i+1];
  return v && Math.floor(u.s/song.bpb)===Math.floor(v.s/song.bpb); }
function mergeNext(i){
  if(!canMerge(i)) return;
  const u=state.chords[i], v=state.chords[i+1];
  if(rev.target===i+1 || rev.chain.some(e=>e.i===i+1)) clearRev(false);
  state.chords.splice(i,2,{...u, l:u.l+v.l});
  shiftRev(i+2,-1);
  const m=state.chords[i];   // back to the original cell shape and chord: drop the edit mark
  const om=origAt(i); if(sameCell(m,om) && same(m,om)) state.chords[i]={...om};
  save();
}
function clearRev(restore){
  if(restore) rev.chain.slice().reverse().forEach(e=>{ state.chords[e.i]=e.prev; });
  rev={target:null, chain:[]}; save();
}
