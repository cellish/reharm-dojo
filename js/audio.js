// Playback with the Web Audio API.
// ---------- audio ----------
let ctx, master, play=null;
function ensureCtx(){
  if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)();
    const comp=ctx.createDynamicsCompressor(); master=ctx.createGain(); master.gain.value=.6;
    master.connect(comp); comp.connect(ctx.destination); }
  if(ctx.state==="suspended") ctx.resume();
}
// Melody/chord balance from the mix slider (0 = melody only … 50 = both as before … 100 = chords only).
// Squared so the fade sounds even to the ear rather than dropping off only at the end.
const melGain = () => Math.min(1,(100-state.mix)/50)**2;
const chordGain = () => Math.min(1,state.mix/50)**2;
function tone(bus,midi,t,d,kind){
  const f=440*Math.pow(2,(midi-69)/12), o=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
  lp.type="lowpass"; o.frequency.value=f;
  let peak, sus, tau;
  if(kind==="mel"){ o.type="triangle"; lp.frequency.value=3400; peak=.2; sus=.7; tau=.25; }
  else if(kind==="bass"){ o.type="triangle"; lp.frequency.value=700; peak=.26; sus=.45; tau=.5; }
  else { o.type="triangle"; lp.frequency.value=1500; peak=.065; sus=.35; tau=.7; }
  peak *= kind==="mel" ? melGain() : chordGain();   // the bass belongs to the chords
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+.012);
  g.gain.setTargetAtTime(peak*sus,t+.012,tau);
  g.gain.setTargetAtTime(0,t+Math.max(.05,d-.04),.05);
  o.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o.stop(t+d+.4);
}
function voicing(c){
  const r=mod(rootPc(c.root)+xp.semis), ivs=Object.keys(Q[c.q].ct).map(Number);
  const bass=40+mod(bassPc(c)+xp.semis-4);
  const ups=(ivs.length>=4? ivs.filter(x=>x!==0):ivs).map(iv=>53+mod(r+iv-5)).sort((a,b)=>a-b);
  return {bass, ups};
}
function stop(){
  if(!play) return; cancelAnimationFrame(play.raf);
  const g=play.bus, t=ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0,t+.05);
  setTimeout(()=>g.disconnect(),150); play=null; markPlaying(-1); playButtons();
}
// startBeat: where this pass begins (a restart after a tempo or mix change begins mid-way);
// origin: where the range began when it was first played, for the next pass when repeating.
function playRange(from,to,chords,mode,startBeat,origin){
  stop(); ensureCtx();
  const bus=ctx.createGain(); bus.connect(master);
  const spb=60/state.bpm, b0=startBeat ?? chords[from].s-(from===0?song.pk:0), b1=chords[to-1].s+chords[to-1].l, t0=ctx.currentTime+.06;
  for(let i=from;i<to;i++){ if(!chords[i].root) continue; const u=chords[i], v=voicing(u), s=Math.max(u.s,b0), e=u.s+u.l;
    if(e<=s+1e-6) continue; const t=t0+(s-b0)*spb, d=(e-s)*spb;
    tone(bus,v.bass,t,d,"bass"); v.ups.forEach(m=>tone(bus,m,t,d,"chord")); }
  if(state.melOn) song.notes.forEach(n=>{
    if(n.tiedFrom && n.start>b0+1e-6) return;
    let dur=n.dur, k=n.idx; while(song.notes[k].tie && song.notes[k+1]){ k++; dur+=song.notes[k].dur; }
    if(n.start<b1 && n.start+dur>b0){
      const s=Math.max(n.start,b0), e=Math.min(n.start+dur,b1); tone(bus,n.midi+xp.semis,t0+(s-b0)*spb,(e-s)*spb,"mel"); }});
  const start = origin ?? b0;
  play={bus,mode,raf:0, from,to,chords, start, end:b1, beat:()=>(ctx.currentTime-t0)/spb+b0};
  const tick=()=>{ if(!play) return; const beat=(ctx.currentTime-t0)/spb+b0;
    // repeat on the end beat; a short audition of a cell ("slot") always plays once
    if(beat>=b1 && state.loop && mode!=="slot"){ replayBeats(play, start); return; }
    if(beat>=b1){ play.bus.disconnect && setTimeout(()=>bus.disconnect(),600); play=null; markPlaying(-1); playButtons(); return; }
    markPlaying(beat>=0 && !OTHER_CELLS.has(mode) ? unitAt(beat):-1); play.raf=requestAnimationFrame(tick); };
  play.raf=requestAnimationFrame(tick); playButtons();
}
// Play the same span of beats again from startBeat. Cells may have been merged or split since the range
// was chosen, so the cell indices are found anew from the beats (the original's cells never change).
function replayBeats(p, startBeat){
  const U = OTHER_CELLS.has(p.mode) ? p.chords : state.chords;
  const from=U.findIndex(x=>x.s+x.l>p.start+1e-6), to=U.findIndex(x=>x.s>=p.end-1e-6);
  playRange(Math.max(0,from), to<0?U.length:to, U, p.mode, startBeat, p.start);
}
// modes that play cells other than the open plan's (the original, another plan): no position marks on the score
const OTHER_CELLS = new Set(["orig","plan","plancmp"]);
let lastPlaying=-1;
function markPlaying(i){
  if(i===lastPlaying) return; lastPlaying=i;
  document.querySelectorAll("#sheet .playing").forEach(e=>e.classList.remove("playing"));
  if(i>=0) document.querySelectorAll(`#sheet [data-i="${i}"]`).forEach(e=>e.classList.add("playing"));
}
function playButtons(){
  $("#playAll").textContent = play&&play.mode==="all" ? "■ 停止" : "▶ 全体を再生";
  $("#playOrig").textContent = play&&play.mode==="orig" ? "■ 停止" : "原曲で再生";
  const hh=$("#hearHere"), hp=$("#hearPrev");
  if(hh) hh.textContent = play&&play.mode==="here" ? "■ 停止" : "▶ ここから";
  if(hp) hp.textContent = play&&play.mode==="prevbar" ? "■ 停止" : "▶ 前小節から";
  const pc=$("#planPlayCmp"); if(pc && cmpPlan!=null) pc.textContent = play&&play.mode==="plan" ? "■ 停止" : `▶ ${plans.list[cmpPlan].name}を再生`;
}
function previewSel(){ const i=state.sel; playRange(i, Math.min(i+2,state.chords.length), state.chords, "slot"); }
