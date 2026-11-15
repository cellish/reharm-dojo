// Note names, chord qualities, parsing, and transposition between the C frame and the shown key.
const LETTER = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];
const MANUAL_ROOTS = ["C","D♭","D","E♭","E","F","F#","G","A♭","A","B♭","B"];
const mod = (n,m=12)=>((n%m)+m)%m;
function rootPc(name){ let p=LETTER[name[0]]; for(const c of name.slice(1)){ if(c==="♭"||c==="b")p--; if(c==="#"||c==="♯")p++; } return mod(p); }

// quality: ct = chord tones, tn = available tensions, av = avoid
const Q = {
  "":    {show:"",       ct:{0:"R",4:"3",7:"5"},            tn:{2:"9",6:"#11",9:"6",11:"M7"},      av:{5:"11"}},
  maj7:  {show:"maj7",   ct:{0:"R",4:"3",7:"5",11:"M7"},    tn:{2:"9",6:"#11",9:"13"},              av:{5:"11"}},
  "6":   {show:"6",      ct:{0:"R",4:"3",7:"5",9:"6"},      tn:{2:"9",6:"#11",11:"M7"},             av:{5:"11"}},
  "7":   {show:"7",      ct:{0:"R",4:"3",7:"5",10:"♭7"},    tn:{2:"9",1:"♭9",3:"#9",6:"#11",9:"13",8:"♭13"}, av:{5:"11"}},
  "7sus4":{show:"7sus4", ct:{0:"R",5:"4",7:"5",10:"♭7"},    tn:{2:"9",9:"13",1:"♭9",8:"♭13"},       av:{4:"3"}},
  "7b9": {show:"7(♭9)",  ct:{0:"R",4:"3",7:"5",10:"♭7",1:"♭9"}, tn:{3:"#9",8:"♭13",9:"13",6:"#11"}, av:{5:"11"}},
  m:     {show:"m",      ct:{0:"R",3:"♭3",7:"5"},           tn:{2:"9",5:"11",10:"♭7",9:"6"},        av:{8:"♭13"}},
  m7:    {show:"m7",     ct:{0:"R",3:"♭3",7:"5",10:"♭7"},   tn:{2:"9",5:"11",9:"13"},               av:{8:"♭13",1:"♭9"}},
  m6:    {show:"m6",     ct:{0:"R",3:"♭3",7:"5",9:"6"},     tn:{2:"9",5:"11",11:"M7"},              av:{8:"♭13"}},
  mM7:   {show:"m(maj7)", ct:{0:"R",3:"♭3",7:"5",11:"M7"},   tn:{2:"9",5:"11",9:"13"},               av:{8:"♭13"}},
  m7b5:  {show:"m7(♭5)", ct:{0:"R",3:"♭3",6:"♭5",10:"♭7"},  tn:{2:"9",5:"11",8:"♭13"},              av:{1:"♭9"}},
  dim7:  {show:"dim7",   ct:{0:"R",3:"♭3",6:"♭5",9:"°7"},   tn:{2:"T",5:"T",8:"T",11:"T"},           av:{}},
  add9:  {show:"add9",   ct:{0:"R",4:"3",7:"5",2:"9"},      tn:{6:"#11",9:"6",11:"M7"},             av:{5:"11"}},
  maj9:  {show:"maj9",   ct:{0:"R",4:"3",7:"5",11:"M7",2:"9"}, tn:{6:"#11",9:"13"},                 av:{5:"11"}},
  sus4:  {show:"sus4",   ct:{0:"R",5:"4",7:"5"},            tn:{2:"9",9:"6",10:"♭7"},               av:{4:"3"}},
  aug:   {show:"aug",    ct:{0:"R",4:"3",8:"#5"},           tn:{2:"9",6:"#11",10:"♭7",11:"M7"},     av:{}},
  m9:    {show:"m9",     ct:{0:"R",3:"♭3",7:"5",10:"♭7",2:"9"}, tn:{5:"11",9:"13"},                 av:{8:"♭13"}},
  "9":   {show:"9",      ct:{0:"R",4:"3",7:"5",10:"♭7",2:"9"},  tn:{6:"#11",9:"13"},                av:{5:"11"}},
  "13":  {show:"13",     ct:{0:"R",4:"3",7:"5",10:"♭7",9:"13"}, tn:{2:"9",6:"#11"},                 av:{5:"11"}},
  "7#9": {show:"7(#9)",  ct:{0:"R",4:"3",7:"5",10:"♭7",3:"#9"}, tn:{1:"♭9",8:"♭13",6:"#11",9:"13"}, av:{5:"11"}},
  "7b13":{show:"7(♭13)", ct:{0:"R",4:"3",7:"5",10:"♭7",8:"♭13"}, tn:{1:"♭9",3:"#9",2:"9",6:"#11"},  av:{5:"11"}},
  "7#5": {show:"7(#5)",  ct:{0:"R",4:"3",8:"#5",10:"♭7"},   tn:{2:"9",1:"♭9",3:"#9",6:"#11"},        av:{5:"11"}}
};
const FALLBACK = {0:"R",1:"♭9",2:"9",3:"#9",4:"3",5:"11",6:"#11",7:"5",8:"♭13",9:"13",10:"♭7",11:"M7"};
const KIND_TEXT = {ct:"和声音", tn:"テンション", av:"アボイド", nc:"非和声音", un:"階名"};
const KIND_NOTE = {
  ct:"安定して響く", tn:"色彩を加える音",
  av:"コードの響きとぶつかりやすい", nc:"コードに含まれない音", un:"まだコードがない"
};
// ---------- transposition (songs and analysis live in C; display/playback are shifted) ----------
const LETTERS="CDEFGAB", NAT=[0,2,4,5,7,9,11];
const KEYS_MAJ=[["C",0],["D♭",-5],["D",2],["E♭",-3],["E",4],["F",-1],["F#",6],["G",1],["A♭",-4],["A",3],["B♭",-2],["B",5]];
const KEYS_MIN=[["C",-3],["C#",4],["D",-1],["E♭",-6],["E",1],["F",-4],["F#",3],["G",-2],["G#",5],["A",0],["B♭",-5],["B",2]];
const isMinor = () => song && song.mode==="minor";
const KEYS_NOW = () => isMinor()?KEYS_MIN:KEYS_MAJ;
const keyName = n => keyLabel(n)+(isMinor()?"m":"");
let xp={name:"C", semis:0, steps:0, sig:0, alters:[0,0,0,0,0,0,0]};
function parseSpelled(name){ let a=0; for(const ch of name.slice(1)){ if(ch==="♭"||ch==="b")a--; if(ch==="#"||ch==="♯")a++; } return {li:LETTERS.indexOf(name[0]), alter:a}; }
const accStr = a => a>0?"♯".repeat(a):"♭".repeat(-a);
const keyLabel = n => n.replace("#","♯");
function setKey(name){
  const K=KEYS_NOW(), k=K.find(x=>x[0]===name)||K[0], pc=rootPc(k[0]), li=LETTERS.indexOf(k[0][0]);
  const avg=song.notes.reduce((a,n)=>a+n.midi,0)/song.notes.length;
  const up={semis:pc,steps:li}, dn={semis:pc-12,steps:li-7};
  const c = Math.abs(avg+up.semis-69) <= Math.abs(avg+dn.semis-69) ? up : dn;
  const alters=[0,0,0,0,0,0,0], sig=k[1];
  for(let j=0;j<Math.abs(sig);j++) alters[LETTERS.indexOf((sig>0?"FCGDAEB":"BEADGCF")[j])] = sig>0?1:-1;
  xp={name:k[0], ...c, sig, alters};
}
function xposeSpelled(li, oct, alter){
  const midi=12*(oct+1)+NAT[li]+alter+xp.semis; let nl=li+xp.steps; const no=oct+Math.floor(nl/7); nl=mod(nl,7);
  return {li:nl, oct:no, alter:midi-(12*(no+1)+NAT[nl]), midi};
}
function dnote(midi){ const nm=(song&&song.spellC&&song.spellC[mod(midi)])||MANUAL_ROOTS[mod(midi)], s=parseSpelled(nm); return xposeSpelled(s.li, Math.floor((midi-s.alter)/12)-1, s.alter); }
const dnoteName = midi => { const d=dnote(midi); return LETTERS[d.li]+accStr(d.alter); };
function droot(name){ const s=parseSpelled(name), d=xposeSpelled(s.li,4,s.alter); return LETTERS[d.li]+accStr(d.alter); }
const sym = c => c && c.root ? droot(c.root) + Q[c.q].show + (c.bass && rootPc(c.bass)!==rootPc(c.root) ? "/"+droot(c.bass) : "") : "？";
const bassPc = c => rootPc(c.bass || c.root);
const same = (a,b) => !!(a && b && a.root && b.root && rootPc(a.root)===rootPc(b.root) && a.q===b.q && bassPc(a)===bassPc(b));

const QALIAS = {"":"","M":"","maj":"","maj7":"maj7","M7":"maj7","△7":"maj7","△":"maj7","Δ7":"maj7","Δ":"maj7","6":"6","7":"7","7sus4":"7sus4",
  "7b9":"7b9","m":"m","-":"m","m7":"m7","-7":"m7","m6":"m6","-6":"m6","m7b5":"m7b5","ø":"m7b5","ø7":"m7b5","dim7":"dim7","o7":"dim7","°7":"dim7","dim":"dim7",
  "mM7":"mM7","mmaj7":"mM7","m△7":"mM7","-maj7":"mM7",
  "add9":"add9","maj9":"maj9","M9":"maj9","△9":"maj9","sus4":"sus4","sus":"sus4","aug":"aug","+":"aug","m9":"m9","-9":"m9",
  "9":"9","13":"13","7#9":"7#9","7b13":"7b13","7#5":"7#5","7+5":"7#5","aug7":"7#5","+7":"7#5"};
function normQ(q){ return QALIAS[q.replace(/[()]/g,"").replace(/♭/g,"b").replace(/♯/g,"#")]; }
function parseChord(s){
  let bass=null; const sl=s.match(/^(.*)\/([A-Ga-g][#b♭♯]?)$/);
  if(sl){ s=sl[1]; bass=sl[2][0].toUpperCase()+sl[2].slice(1).replace("b","♭").replace("♯","#"); }
  const m = s.match(/^([A-G][#b♭♯]?)(.*)$/); if(!m) return null;
  const q = Q[m[2]] ? m[2] : normQ(m[2]); if(q===undefined) return null;
  const c={root:m[1].replace("b","♭").replace("♯","#"), q};
  if(bass && rootPc(bass)!==rootPc(c.root)) c.bass=bass;
  return c;
}
const durOf = d => !d ? 1 : d.includes("/") ? d.split("/")[0]/d.split("/")[1] : +d;   // "1/3" = triplet eighth
// token: "E4" (quarter), "E4:1.5", "r" / "r:2" (rest), trailing "~" = tie to next note
function parseNotes(str, t, notes, rests){
  str.trim().split(/\s+/).forEach(tok=>{
    const tie=tok.endsWith("~"); tok=tok.replace("~","");
    const [n,d]=tok.split(":"); const dur=durOf(d);
    if(n==="r"){ rests.push({start:t,dur}); t+=dur; return; }
    const m=n.match(/^([A-G][#b]?)(\d)$/);
    const sp=parseSpelled(m[1]);
    notes.push({midi:12*(+m[2]+1)+rootPc(m[1]), start:t, dur, tie, sp:{li:sp.li, alter:sp.alter, oct:+m[2]}}); t+=dur;
  });
}
// how a bar is shared among n chords: equal when possible, otherwise the longer part first (3/4 with 2 chords = 2+1)
function splitBar(bpb, n){
  n=Math.max(1,Math.min(n,bpb));
  if(bpb%n===0) return Array(n).fill(bpb/n);
  const base=Math.floor(bpb/n), out=Array(n).fill(base); let r=bpb-base*n;
  for(let k=0;r>0;k++,r--) out[k]++;
  return out;
}
function buildSong(id){
  const s = SONGS[id], notes=[], rests=[]; let pk=0;
  if(s.pickup){ pk=s.pickup.trim().split(/\s+/).reduce((a,tok)=>a+durOf(tok.replace("~","").split(":")[1]),0);
    parseNotes(s.pickup,-pk,notes,rests); }
  s.bars.forEach((bar,bi)=>parseNotes(bar,bi*s.bpb,notes,rests));
  notes.forEach((n,k)=>{ n.idx=k; if(n.tie && notes[k+1]) notes[k+1].tiedFrom=true; });
  const sh = s.src ? mod(-rootPc(s.src)+6)-6 : 0;   // authored in another tonic: move everything to the C frame
  const Ls = s.src ? LETTERS.indexOf(s.src[0]) : 0, st = sh>=0 ? mod(-Ls,7) : mod(-Ls,7)-7;
  // keep the written spelling: move letters by the same interval as the pitches
  const conv = (li,alter,oct) => { const midi=12*(oct+1)+NAT[li]+alter+sh; let nl=li+st; const no=oct+Math.floor(nl/7); nl=mod(nl,7);
    return {li:nl, oct:no, alter:midi-(12*(no+1)+NAT[nl])}; };
  const nameOf = c => LETTERS[c.li]+(c.alter>0?"#".repeat(c.alter):"♭".repeat(-c.alter));
  const convName = nm => { const p=parseSpelled(nm); return nameOf(conv(p.li,p.alter,4)); };
  const spellC={};
  notes.forEach(n=>{ n.midi+=sh; const c=conv(n.sp.li,n.sp.alter,n.sp.oct); if(!spellC[mod(n.midi)]) spellC[mod(n.midi)]=nameOf(c); });
  const cells=[];
  s.chords.split("|").map(b=>b.trim()).filter(Boolean).forEach((b,bi)=>{
    let toks=b.split(/\s+/).filter(Boolean);
    if(toks.every(t=>t===toks[0])) toks=[toks[0]];
    const lens=splitBar(s.bpb, toks.length); let t=bi*s.bpb;
    toks.forEach((tok,k)=>{ const c=parseChord(tok)||{root:"C",q:""};
      const o={s:t, l:lens[k], root:convName(c.root), q:c.q};
      if(c.bass) o.bass=convName(c.bass);
      cells.push(o); t+=lens[k]; });
  });
  const lo=Math.min(...notes.map(n=>n.midi)), hi=Math.max(...notes.map(n=>n.midi));
  // modulated stretches: keys:[[firstBar, lastBar, tonic as written, "major"|"minor"]]
  const regions=(s.keys||[]).map(([a,b,t,m])=>({b0:(a-1)*s.bpb, b1:b*s.bpb, tonic:convName(t), minor:m==="minor"}));
  return {...s, id, notes, rests, pk, orig:cells, nbars:s.bars.length, lo, hi, spellC, regions};
}
