// Playback with the Web Audio API.
// ---------- audio ----------
let ctx, master, waves=null, play=null;
function buildAudioWaves(ac){
  const mk = amps => ac.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps));
  return {
    mel:   mk([0, 1.0, 0.32, 0.18, 0.08, 0.035, 0.015]),
    chord: mk([0, 1.0, 0.42, 0.20, 0.10, 0.055, 0.025, 0.012]),
    bass:  mk([0, 1.0, 0.48, 0.16, 0.06, 0.02])
  };
}
function buildReverb(ac){
  const sr=ac.sampleRate, len=Math.floor(sr*1.1), buf=ac.createBuffer(2, len, sr);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch); let lp=0;
    for(let i=0;i<len;i++){
      const env=Math.pow(1-i/len, 2.8);
      lp = lp*0.62 + (Math.random()*2-1)*0.38;   // gently damped room tail
      d[i]=lp*env;
    }
  }
  const conv=ac.createConvolver(); conv.buffer=buf; return conv;
}
function ensureCtx(){
  if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)();
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-14; comp.knee.value=18; comp.ratio.value=4;
    master=ctx.createGain(); master.gain.value=.62;
    const dry=ctx.createGain(); dry.gain.value=.86;
    const wet=ctx.createGain(); wet.gain.value=.18;
    const rev=buildReverb(ctx);
    master.connect(dry); dry.connect(comp);
    master.connect(rev); rev.connect(wet); wet.connect(comp);
    comp.connect(ctx.destination);
    waves=buildAudioWaves(ctx);
  }
  if(ctx.state==="suspended") ctx.resume();
}
// Melody/chord balance from the mix slider (0 = melody only … 50 = both as before … 100 = chords only).
// Squared so the fade sounds even to the ear rather than dropping off only at the end.
const melGain = () => Math.min(1,(100-state.mix)/50)**2;
const chordGain = () => Math.min(1,state.mix/50)**2;
function tone(bus,midi,t,d,kind,panVal=0,vel=1){
  const scale = (kind==="mel" ? melGain() : chordGain()) * vel;   // the bass belongs to the chords
  if(scale<1e-4) return;
  const f=440*Math.pow(2,(midi-69)/12), o=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
  lp.type="lowpass"; lp.Q.value=0.7; o.frequency.value=f;
  if(waves && waves[kind]) o.setPeriodicWave(waves[kind]); else o.type="triangle";
  let peak, sus, tau, fHi, fLo, fTau;
  if(kind==="mel"){
    peak=.19*scale; sus=.62; tau=.28; fHi=Math.max(f*5,4200); fLo=Math.max(f*2.2,1700); fTau=.35;
  } else if(kind==="bass"){
    peak=.27*scale; sus=.40; tau=.45; fHi=Math.max(f*4,1100); fLo=Math.max(f*1.8,320); fTau=.22;
  } else {
    peak=.062*scale; sus=.32; tau=.65; fHi=Math.max(f*4.5,2800); fLo=Math.max(f*1.8,720); fTau=.45;
  }
  lp.frequency.setValueAtTime(fHi, t);
  lp.frequency.setTargetAtTime(fLo, t+.015, fTau);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+.010);
  g.gain.setTargetAtTime(peak*sus,t+.010,tau);
  g.gain.setTargetAtTime(0,t+Math.max(.04,d-.035),.045);
  let pan=null;
  if(panVal && ctx.createStereoPanner){ pan=ctx.createStereoPanner(); pan.pan.value=panVal; }
  // the bus keeps its live voices so stop() can end them at once instead of leaving them scheduled
  const live = bus.voices || (bus.voices = new Set()); live.add(o);
  o.onended=()=>{ live.delete(o); o.disconnect(); lp.disconnect(); g.disconnect(); if(pan) pan.disconnect(); };
  o.connect(lp); lp.connect(g);
  if(pan){ g.connect(pan); pan.connect(bus); } else g.connect(bus);
  o.start(t); o.stop(t+d+.42);
}
function voicing(c, prevUps){
  const r=mod(rootPc(c.root)+xp.semis), ivs=Object.keys(Q[c.q].ct).map(Number);
  const bass=40+mod(bassPc(c)+xp.semis-4);
  const keepRoot = ivs.length<4 || (c.bass && rootPc(c.bass)!==rootPc(c.root));
  const pcs=(keepRoot?ivs:ivs.filter(x=>x!==0)).map(iv=>mod(r+iv));
  // Smooth voice leading: place each chord tone near the previous chord's center (within C3..G4)
  const center = prevUps && prevUps.length ? prevUps.reduce((a,m)=>a+m,0)/prevUps.length : 57;
  const ups = pcs.map(pc=>{
    let best=48+pc, bestD=99;
    for(const oct of [48,60]){
      const m=oct+pc; if(m<48 || m>67) continue;
      const dist=Math.abs(m-center);
      if(dist<bestD){ bestD=dist; best=m; }
    }
    return best;
  }).sort((a,b)=>a-b);
  return {bass, ups};
}
// the accompaniment styles scheduleCell knows; app.js resets a saved style outside these (it would play nothing)
const STYLES = new Set(["plain","jpop","jazz","bossa","neosoul","country","rock"]);
function activeStyle(mode){
  if(state.style && state.style!=="auto") return state.style;
  if(mode==="orig" || state.harm || state.tab!=="course") return "plain";
  return state.genre==="basic" ? "plain" : state.genre;
}
// Light swing delay for eighth-note offbeats in jazz style (~62:38)
function beatTime(beat, b0, spb, t0, isJazz){
  const frac = beat - Math.floor(beat);
  const sw = isJazz && Math.abs(frac-0.5)<0.02 ? 0.12 : 0;
  return t0 + (beat + sw - b0) * spb;
}
function playChordHit(bus, ups, t, d, vel=1, strum=0.011){
  const nU=ups.length;
  ups.forEach((m,k)=>{ const pan=nU>1?((k/(nU-1))*2-1)*0.24:0;
    tone(bus, m, t+k*strum, Math.max(.06, d-k*strum), "chord", pan, vel); });
}
// Schedule genre-specific accompaniment patterns inside cell [s, e)
function scheduleCell(bus, u, nextU, v, s, e, b0, spb, t0, style){
  const bpb=song.bpb, isJazz=style==="jazz";
  const T = b => beatTime(b, b0, spb, t0, isJazz);
  const altBass = v.bass>=45 ? v.bass-5 : v.bass+7;   // 5th below (or above if too low)
  const nextBass = nextU && nextU.root ? 40+mod(bassPc(nextU)+xp.semis-4) : v.bass;
  const bar0 = Math.floor(s/bpb)*bpb;
  const emit = (list, fn) => {
    let hit=0;
    for(let bar=bar0; bar<e-1e-6; bar+=bpb){
      for(const ev of list){
        const b=bar+ev[0];
        if(b<s-1e-6 || b>=e-1e-6) continue;
        const dur=Math.min(ev[1], e-b);
        if(dur<=0.04) continue;
        fn(b, dur, ev); hit++;
      }
    }
    return hit;
  };
  if(style==="plain"){
    const t=T(s), d=(e-s)*spb;
    tone(bus, v.bass, t, d, "bass", 0, 1);
    playChordHit(bus, v.ups, t, d, 1, 0.011);
    return;
  }
  if(style==="bossa"){
    const bPat = bpb===3 ? [[0,1.45,0,1],[1.5,1.4,1,.86]]
      : [[0,1.45,0,1],[1.5,.48,1,.82],[2,1.45,1,.92],[3.5,.48,0,.80]];
    const cPat = bpb===3 ? [[0,1.35,.95],[1.5,.9,.82],[2.5,.48,.76]]
      : [[0,1.35,.95],[1.5,1.35,.85],[3,.9,.84]];
    if(!emit(bPat, (b,d,ev)=>tone(bus, (Math.abs(b-s)<1e-6 || !ev[2])?v.bass:altBass, T(b), d*spb, "bass", 0, ev[3])))
      tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), d*spb, ev[2], 0.014)))
      playChordHit(bus, v.ups, T(s), (e-s)*spb, .95, 0.014);
    return;
  }
  if(style==="jazz"){
    // Walking bass (root -> 5th -> 3rd/root -> chromatic approach to next chord's bass)
    const walkNote = (step, isLast) => {
      if(step===0) return v.bass;
      if(isLast && nextU && nextU.root){
        const diff = nextBass - v.bass;
        return diff>0 ? nextBass-1 : nextBass+1;
      }
      if(step===1) return altBass;
      return v.bass + (isMinorish(u.q) ? 3 : 4);
    };
    // 3/4 walks in quarters too (root, 5th, then the 3rd or an approach), as a jazz waltz does
    const bSteps = bpb===3 ? [[0,.95,0,1],[1,.95,1,.86],[2,.95,2,.88]] : [[0,.95,0,1],[1,.95,1,.86],[2,.95,2,.90],[3,.95,3,.88]];
    let bHit=0;
    for(let bar=bar0; bar<e-1e-6; bar+=bpb){
      bSteps.forEach((ev, idx)=>{
        const b=bar+ev[0]; if(b<s-1e-6 || b>=e-1e-6) return;
        const dur=Math.min(ev[1], e-b); if(dur<=0.04) return;
        const isLast = (b+1 >= e-1e-6) && (e-s>=2);
        tone(bus, Math.abs(b-s)<1e-6 ? v.bass : walkNote(ev[2], isLast), T(b), dur*spb, "bass", 0, ev[3]); bHit++;
      });
    }
    if(!bHit) tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    const cPat = bpb===3 ? [[0,.75,.92],[1.5,1.2,.84]] : [[0,.7,.92],[1.5,1.25,.85],[3,.7,.78]];
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), Math.max(.08, T(b+d)-T(b)), ev[2], 0.012)))
      playChordHit(bus, v.ups, T(s), (e-s)*spb, .9, 0.012);
    return;
  }
  if(style==="country"){
    // Boom-chick (4/4: root on 1, 5th on 3, short chords on 2 & 4; 3/4: waltz boom-chick-chick)
    const bPat = bpb===3 ? [[0,.92,0,1]] : [[0,.92,0,1],[2,.92,1,.92]];
    const cPat = bpb===3 ? [[1,.55,.88],[2,.55,.82]] : [[1,.48,.90],[3,.48,.86]];
    if(!emit(bPat, (b,d,ev)=>tone(bus, (Math.abs(b-s)<1e-6 || !ev[2])?v.bass:altBass, T(b), d*spb, "bass", 0, ev[3])))
      tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), d*spb, ev[2], 0.008)))
      playChordHit(bus, v.ups, T(s), Math.min(0.6, e-s)*spb, .9, 0.008);
    return;
  }
  if(style==="neosoul"){
    // Laid-back lush arpeggio strum with mellow offbeat push
    const bPat = bpb===3 ? [[0,1.9,0,1],[2,.95,0,.78]] : [[0,2.3,0,1],[2.5,1.4,0,.82]];
    const cPat = bpb===3 ? [[0,1.9,.95],[2,.95,.75]] : [[0,2.2,.95],[2.5,1.4,.80]];
    if(!emit(bPat, (b,d,ev)=>tone(bus, v.bass, T(b), d*spb, "bass", 0, ev[3])))
      tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), d*spb, ev[2], 0.024)))
      playChordHit(bus, v.ups, T(s), (e-s)*spb, .95, 0.024);
    return;
  }
  if(style==="jpop"){
    const bPat = bpb===3 ? [[0,2.8,0,1]] : [[0,1.4,0,1],[1.5,.48,0,.80],[2,1.4,0,.92],[3.5,.48,0,.80]];
    const cPat = bpb===3 ? [[0,.95,.96],[1,.9,.72],[2,.9,.74]] : [[0,.95,.96],[1,.9,.74],[2,.48,.88],[2.5,.48,.76],[3,.9,.80]];
    if(!emit(bPat, (b,d,ev)=>tone(bus, v.bass, T(b), d*spb, "bass", 0, ev[3])))
      tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), d*spb, ev[2], 0.010)))
      playChordHit(bus, v.ups, T(s), (e-s)*spb, .95, 0.010);
    return;
  }
  if(style==="rock"){
    // Driving 8th-note bass + punchy chord hits
    const bPat = bpb===3 ? [[0,.46,0,1],[.5,.46,0,.76],[1,.46,0,.88],[1.5,.46,0,.76],[2,.46,0,.92],[2.5,.46,0,.80]]
      : [[0,.46,0,1],[.5,.46,0,.76],[1,.46,0,.88],[1.5,.46,0,.78],[2,.46,0,.94],[2.5,.46,0,.78],[3,.46,0,.88],[3.5,.46,0,.80]];
    const cPat = bpb===3 ? [[0,1.4,1.05],[1.5,.48,.92],[2,.95,.96]]
      : [[0,1.4,1.05],[1.5,.48,.92],[2,.95,.98],[3,.95,.92]];
    if(!emit(bPat, (b,d,ev)=>tone(bus, v.bass, T(b), d*spb, "bass", 0, ev[3])))
      tone(bus, v.bass, T(s), (e-s)*spb, "bass", 0, 1);
    if(!emit(cPat, (b,d,ev)=>playChordHit(bus, v.ups, T(b), d*spb, ev[2], 0.005)))
      playChordHit(bus, v.ups, T(s), (e-s)*spb, 1.02, 0.005);
    return;
  }
}
function stop(){
  if(!play) return; cancelAnimationFrame(play.raf); clearInterval(play.timer);
  const g=play.bus, t=ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0,t+.05);
  // end every voice right after the fade, including ones scheduled to start later
  if(g.voices) g.voices.forEach(o=>{ try{ o.stop(t+.06); }catch(e){} });
  setTimeout(()=>g.disconnect(),150); play=null; markPlaying(-1); playButtons();
}
// Notes are created only this far ahead of the playhead, so a long song does not build hundreds of
// nodes at once. Longer than the 1 s timer clamp of hidden tabs, so playback keeps going there.
const LOOKAHEAD_S = 1.5, PUMP_MS = 100;
// startBeat: where this pass begins (a restart after a tempo or mix change begins mid-way);
// origin: where the range began when it was first played, for the next pass when repeating.
function playRange(from,to,chords,mode,startBeat,origin){
  stop(); ensureCtx();
  const bus=ctx.createGain(); bus.connect(master);
  const spb=60/state.bpm, b0=startBeat ?? chords[from].s-(from===0?song.pk:0), b1=chords[to-1].s+chords[to-1].l, t0=ctx.currentTime+.06;
  const style=activeStyle(mode), isJazz=style==="jazz";
  // Jobs are worked out now (voicings chain from cell to cell) but their notes are made only when
  // their start comes within LOOKAHEAD_S; jobs are pushed in time order.
  const jobs=[];
  let prevUps=null;
  for(let i=from;i<to;i++){ if(!chords[i].root) continue; const u=chords[i], v=voicing(u, prevUps), s=Math.max(u.s,b0), e=u.s+u.l;
    prevUps=v.ups;
    if(e<=s+1e-6) continue;
    const next=chords[i+1];
    jobs.push({t:beatTime(s,b0,spb,t0,isJazz), run:()=>scheduleCell(bus, u, next, v, s, e, b0, spb, t0, style)}); }
  if(state.melOn) song.notes.forEach(n=>{
    if(n.tiedFrom && n.start>b0+1e-6) return;
    let dur=n.dur, k=n.idx; while(song.notes[k].tie && song.notes[k+1]){ k++; dur+=song.notes[k].dur; }
    if(n.start<b1 && n.start+dur>b0){
      const s=Math.max(n.start,b0), e=Math.min(n.start+dur,b1);
      const ts=beatTime(s,b0,spb,t0,isJazz), te=beatTime(e,b0,spb,t0,isJazz), midi=n.midi+xp.semis;
      jobs.push({t:ts, run:()=>tone(bus,midi,ts,Math.max(.05,te-ts),"mel")}); }});
  jobs.sort((a,b)=>a.t-b.t);
  let next=0;
  const start = origin ?? b0;
  const me={bus,mode,raf:0,timer:0, from,to,chords, start, end:b1, beat:()=>(ctx.currentTime-t0)/spb+b0};
  play=me;
  // returns false once this pass is over (ended, repeated, or stopped)
  const pump=()=>{ if(play!==me) return false;
    const beat=(ctx.currentTime-t0)/spb+b0;
    // repeat on the end beat; a short audition of a cell ("slot") always plays once
    if(beat>=b1 && state.loop && !ONCE.has(mode)){ replayBeats(me, start); return false; }
    if(beat>=b1){ clearInterval(me.timer); cancelAnimationFrame(me.raf); setTimeout(()=>bus.disconnect(),600); play=null; markPlaying(-1); playButtons(); return false; }
    const until=ctx.currentTime+LOOKAHEAD_S;
    while(next<jobs.length && jobs[next].t<until) jobs[next++].run();
    return true; };
  pump();
  // the timer keeps notes coming (and the end noticed) in hidden tabs, where animation frames stop
  me.timer=setInterval(pump, PUMP_MS);
  const tick=()=>{ if(!pump()) return;
    const beat=me.beat(); markPlaying(beat>=0 && !OTHER_CELLS.has(mode) ? unitAt(beat):-1); me.raf=requestAnimationFrame(tick); };
  me.raf=requestAnimationFrame(tick); playButtons();
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
// modes that play once even when repeat is on: a cell's audition, and the course's phrase and four-bar plays
const ONCE = new Set(["slot","corig","ccmp"]);
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
  // the beginner course's playback: a stop button, and the review step's two buttons
  const cs=$("#cStop"); if(cs) cs.hidden = !(play && COURSE_PLAY.has(play.mode));
  const co=$("#cHearO"), cn=$("#cHearN");
  if(co) co.textContent = play&&play.mode==="orig" ? "■ 停止" : "▶ 原曲を聴く";
  if(cn) cn.textContent = play&&play.mode==="all" ? "■ 停止" : "▶ いまの案を聴く";
  const pc=$("#planPlayCmp"); if(pc && cmpPlan!=null) pc.textContent = play&&play.mode==="plan" ? "■ 停止" : `▶ ${plans.list[cmpPlan].name}を再生`;
}
function previewSel(){ const i=state.sel, [a,b]=previewSpan||[i, Math.min(i+2,state.chords.length)]; previewSpan=null; if(state.autoPlay) playRange(a, b, state.chords, "slot"); }
