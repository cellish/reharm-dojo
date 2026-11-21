// Melody-versus-chord analysis, keys and chord functions, and every chord proposal (techniques).
// ---------- analysis ----------
const SOLF={0:"ド",1:"ド♯",2:"レ",3:"ミ♭",4:"ミ",5:"ファ",6:"ファ♯",7:"ソ",8:"ラ♭",9:"ラ",10:"シ♭",11:"シ"};
// minor keys read from ラ (the relative-major way many Japanese classes teach), when state.laMinor is on
const SOLF_LA={0:"ラ",1:"シ♭",2:"シ",3:"ド",4:"ド♯",5:"レ",6:"レ♯",7:"ミ",8:"ファ",9:"ファ♯",10:"ソ",11:"ソ♯"};
// the syllable of a note in key K (from keyAt): the one place that turns a pitch into ド・レ・ミ
const solf = (midi, K) => (K && K.minor && state.laMinor ? SOLF_LA : SOLF)[mod(midi-(K ? K.pc : 0))];
function roleOf(chord, midi, K){
  if(!chord || !chord.root) return {kind:"un", label:solf(midi, K)};
  const iv = mod(midi - rootPc(chord.root)); const q=Q[chord.q];
  if(iv in q.ct) return {kind:"ct", label:q.ct[iv]};
  if(iv in q.tn) return {kind:"tn", label:q.tn[iv]};
  if(iv in q.av) return {kind:"av", label:q.av[iv]};
  return {kind:"nc", label:FALLBACK[iv]};
}
// A "unit" is one chord cell: {s: start beat, l: length in beats, root, q, tech}
// A note is structural ("strong") in a span when it starts the span, falls on a strong beat of the bar
// (beat 1; also beat 3 in 4/4), or sounds for a long share of the span. Everything else is ornamental.
function isStrong(n, s, l){
  if(n.start<=s+1e-6) return true;
  const pos=mod(n.start, song.bpb);
  if(pos<1e-6 || (song.bpb===4 && Math.abs(pos-2)<1e-6)) return true;
  const len=Math.min(n.start+n.dur, s+l)-Math.max(n.start, s);
  return len >= Math.max(1.5, l/2)-1e-6;
}
function notesSpan(s, l){
  const e=s+l;
  return song.notes.filter(n=>n.start<e-1e-6 && n.start+n.dur>s+1e-6).map(n=>({...n, strong:isStrong(n,s,l)}));
}
const notesIn = i => notesSpan(state.chords[i].s, state.chords[i].l);
const origAt = i => { const s0=state.chords[i].s; return song.orig.find(c=>s0>=c.s-1e-6 && s0<c.s+c.l-1e-6) || song.orig[0]; };
const sameCell = (u,o) => Math.abs(u.s-o.s)<1e-6 && Math.abs(u.l-o.l)<1e-6;
const totalBeats = () => song.nbars*song.bpb;
const origUnits = () => song.orig.map(c=>({...c}));
const unitAt = beat => state.chords.findIndex(u=>beat>=u.s-1e-6 && beat<u.s+u.l-1e-6);
function isPassing(n){
  const a=song.notes[n.idx-1], b=song.notes[n.idx+1];
  if(!a || !b || n.dur>1+1e-6) return false;
  if(Math.abs(a.start+a.dur-n.start)>1e-6 || Math.abs(n.start+n.dur-b.start)>1e-6) return false;
  const d1=n.midi-a.midi, d2=b.midi-n.midi;
  return d1!==0 && d2!==0 && Math.abs(d1)<=2 && Math.abs(d2)<=2 && Math.sign(d1)===Math.sign(d2);
}
function rolesSpan(chord,s,l){ const K=keyAt(s); return notesSpan(s,l).map(n=>{ const r={...n, ...roleOf(chord,n.midi,K), name:dnoteName(n.midi)};
  if((r.kind==="av"||r.kind==="nc") && isPassing(n)) r.passing=true; return r; }); }
const rolesFor = (chord,i) => rolesSpan(chord, state.chords[i].s, state.chords[i].l);
function verdict(roles){
  if(roles.some(r=>r.kind==="un")) return "none";
  if(roles.some(r=>r.strong && !r.passing && (r.kind==="av"||r.kind==="nc"))) return "bad";
  if(roles.some(r=>(r.kind==="av"||r.kind==="nc") && (!r.strong || r.passing) && !(r.passing && !r.strong))) return "ok";
  return "good";
}
const VERDICT_TEXT = {none:"コード未設定", good:"○ ぶつかりなし", ok:"△ 短い音がぶつかる", bad:"✕ 骨格の音がぶつかる"};

// ---------- keys and chord analysis ----------
// Everything below works in a "local key": the song's home key (tonic C in the C frame) or,
// inside a modulated region (song.regions), that region's tonic. Chord tables are written
// relative to C and moved into the local key with inKey(), which keeps the letter spelling.
const MODES = {
  major:{deg:{0:0,2:1,4:2,5:3,7:4,9:5,11:6}, dia:[["C","maj7"],["D","m7"],["E","m7"],["F","maj7"],["G","7"],["A","m7"],["B","m7b5"]], fn:["T","S","T","S","D","T","D"]},
  minor:{deg:{0:0,2:1,3:2,5:3,7:4,8:5,10:6,11:7}, dia:[["C","m7"],["D","m7b5"],["E♭","maj7"],["F","m7"],["G","7"],["A♭","maj7"],["B♭","7"],["B","dim7"]], fn:["T","S","T","S","D","S","D","D"]}
};
// chord qualities that count as "the diatonic chord" on each scale degree
const QS_MAJ=["","maj7","6","add9","maj9"], QS_MIN=["m","m7","m9"], QS_DOM=["","7","7sus4","sus4","7b9","9","13","7#9","7b13","7#5"];
const DIA_Q = {
  major:[QS_MAJ, [...QS_MIN,"m6"], ["m","m7"], QS_MAJ, QS_DOM, QS_MIN, ["m7b5","dim7"]],
  minor:[[...QS_MIN,"m6","mM7"], ["m7b5"], QS_MAJ, [...QS_MIN,"m6"], [...QS_DOM,"m","m7"], QS_MAJ, ["","7","9","13"], ["dim7"]]
};
const FUNC_NAME = {T:"トニック",S:"サブドミナント",D:"ドミナント"};
const ROMAN = ["I","♭II","II","♭III","III","IV","#IV","V","♭VI","VI","♭VII","VII"];
const isDomQ = q => ["7","7b9","7sus4","9","13","7#9","7b13","7#5"].includes(q);
const isMinorish = q => ["m","m7","m6","m7b5","mM7","m9"].includes(q);
const HOME = () => ({tonic:"C", pc:0, minor:isMinor()});
function keyAt(beat){
  const r=(song.regions||[]).find(r=>beat>=r.b0-1e-6 && beat<r.b1-1e-6);
  return r ? {tonic:r.tonic, pc:rootPc(r.tonic), minor:r.minor} : HOME();
}
const keyOfCell = i => keyAt(state.chords[i].s);
const MDk = K => MODES[K.minor?"minor":"major"];
const spell = (li, pc) => { const a=mod(pc-NAT[li]+6)-6; return Math.abs(a)>1 ? MANUAL_ROOTS[mod(pc)] : LETTERS[li]+(a>0?"#".repeat(a):"♭".repeat(-a)); };
// a note name `steps` letters and `semis` semitones above `name` (a fifth up = 4 steps, 7 semitones)
function upIv(name, steps, semis){ const s=parseSpelled(name); return spell(mod(s.li+steps,7), rootPc(name)+semis); }
// the note `iv` semitones above a chord root, spelled as that interval (a 3rd is two letters up, a 7th six)
const IV_STEPS=[0,1,1,2,2,3,3,4,5,5,6,6];
const noteAbove = (root, iv, flatFive) => upIv(root, iv===6&&flatFive ? 4 : IV_STEPS[iv], iv);
const inKey = (name, K) => K.tonic==="C" ? name : upIv(name, LETTERS.indexOf(K.tonic[0]), K.pc);
const KC = (K,root,q) => ({root:inKey(root,K), q});
const relPc = (c,K) => mod(rootPc(c.root)-K.pc);
const ROMAN_SHARP = ["I","#I","II","#II","III","IV","#IV","V","#V","VI","#VI","VII"];
// a diminished chord that climbs a semitone into the next chord is named from below (#I°7), otherwise from above (♭III°7)
const romanOf = (c,K,next) => (c.q==="dim7" && next && next.root && mod(rootPc(next.root)-rootPc(c.root))===1 ? ROMAN_SHARP : ROMAN)[relPc(c,K)] + Q[c.q].show + (c.bass && rootPc(c.bass)!==rootPc(c.root) ? "/"+ROMAN[mod(rootPc(c.bass)-K.pc)] : "");
// What a chord is in key K: a diatonic chord with a function (T/S/D), a secondary dominant,
// a chord borrowed from the parallel key, a tritone substitute, a passing diminished, or none of these.
function analyze(c, K, next){
  if(!c || !c.root) return {fn:null, kind:"none", roman:"", d:null};
  const mode=K.minor?"minor":"major", other=K.minor?"major":"minor";
  const M=MODES[mode], p=relPc(c,K), d=M.deg[p], roman=romanOf(c,K,next), dom=isDomQ(c.q);
  if(song.blues && dom && [0,5,7].includes(p)) return {fn:{0:"T",5:"S",7:"D"}[p], kind:"dia", roman, d};
  if(d!=null && DIA_Q[mode][d].includes(c.q)) return {fn:M.fn[d], kind:"dia", roman, d};
  if(dom && M.deg[mod(p+5)]!=null){ const t=ROMAN[mod(p+5)];
    return {fn:null, kind:"sec", roman, d:null, alt:`V7/${t}`, note:`${t} へ向かうセカンダリードミナント`}; }
  const od=MODES[other].deg[p];
  if(od!=null && DIA_Q[other][od].includes(c.q))
    return {fn:MODES[other].fn[od], kind:"bor", roman, d:null, note:K.minor?"同主長調からの借用":"同主短調からの借用"};
  if(dom && M.deg[mod(p-1)]!=null){ const t=ROMAN[mod(p-1)];
    return {fn:null, kind:"sub", roman, d:null, alt:`subV7/${t}`, note:`${t} へ半音で下りる裏コード`}; }
  if(c.q==="dim7") return {fn:null, kind:"dim", roman, d:null, note:"経過的なディミニッシュ"};
  return {fn:null, kind:"other", roman, d:null};
}
const fnOfCell = (c) => analyze(c, keyAt(c.s)).fn;
const fnText = A => A.fn ? `<b>${A.fn}</b> ${FUNC_NAME[A.fn]}${A.kind==="bor"?"（借用）":""}` : A.note ? esc(A.note) : "<b>—</b>";
const fnMark = A => A.fn || (A.kind==="sec"||A.kind==="sub" ? "→" : A.kind==="dim" ? "°" : "—");

// ---------- techniques: every chord the app proposes, generated in one place ----------
const TECH = {
  seventh:{name:"音を足して厚くする", short:"音を足す", desc:"三和音に7度や6度を足して4和音にする。さらに9度などのテンションを足す。コードの働きは変わらないので、いちばん安全なリハモ。"},
  func:   {name:"同じ機能で置き換える", short:"代理", desc:"同じ機能（T・S・D）をもつ別のダイアトニック・コードに置き換える。V のあとの I を VIm にすると偽終止になる。"},
  bass:   {name:"ベースを動かす（分数コード）", short:"分数", desc:"コードはそのままに、ベースの音だけを変える。転回形でなめらかにつなぐ、ベースを1音ずつ動かす、同じベースを保つ（ペダル）など。"},
  cliche: {name:"同じコードが続く所を動かす", short:"クリシェ", desc:"同じコードが続く所で、コードの中の1音だけを半音ずつ動かす（クリシェ）。C → Cmaj7 → C7、Am → Am(maj7) → Am7 → Am6 のように、内声に線ができる。"},
  toward: {name:"次のコードへ向かう", short:"向かう", desc:"次のコードを一時的な I とみなし、その V7 や II を置く。枠を2つに分けて II–V にすることもできる。"},
  chrom:  {name:"半音で近づく", short:"半音", desc:"裏コード（♭II7）やディミニッシュで、ベースを半音で動かして次のコードへつなぐ。"},
  borrow: {name:"借りてくる", short:"借用", desc:"同じ主音の短調（短調の曲なら長調）からコードを借りて、陰りや明るさを足す。"},
};
const TECH_ORDER = ["seventh","func","bass","cliche","toward","chrom","borrow"];
// labels saved on cells by earlier versions → technique id
const TECH_ALIAS = {"4和音化":"seventh","4和音":"seventh","ダイアトニック代理":"func","分数コード（ベースを動かす）":"bass","セカンダリードミナント":"toward","リレイテッド II":"toward",
  "着地点へ":"toward","裏コード":"chrom","パッシング・ディミニッシュ":"chrom","同主短調からの借用":"borrow","同主長調からの借用":"borrow"};
const techId = label => { if(!label) return null; const k=TECH_ORDER.find(t=>TECH[t].short===label); return k || TECH_ALIAS[label] || (/^(逆算|着地点へ)/.test(label)?"toward":null); };
const ckey = c => rootPc(c.root)+"|"+c.q+"|"+bassPc(c);

function bassOptions(i, K){
  const u=state.chords[i], prev=state.chords[i-1], out=[], seen=new Set(); K = K || keyOfCell(i);
  if(!u || !u.root) return out;
  const r=rootPc(u.root), cts=Object.keys(Q[u.q].ct).map(Number).map(iv=>mod(r+iv)), tns=Object.keys(Q[u.q].tn).map(Number).map(iv=>mod(r+iv));
  const scale=new Set(Object.keys(MDk(K).deg).map(n=>mod(+n+K.pc)));
  const add=(bpc,name)=>{ if(bpc===r && !u.bass) return; if(bpc===bassPc(u)) return; if(seen.has(bpc)) return; seen.add(bpc);
    const c={root:u.root, q:u.q}; if(bpc!==r) c.bass=noteAbove(u.root, mod(bpc-r), 6 in Q[u.q].ct); out.push({c,name}); };
  if(u.bass) add(r,"基本形に戻す（ベース＝根音）");
  const ivName={3:"3度",4:"3度",6:"5度",7:"5度",8:"5度",9:"6度",10:"7度",11:"7度"};
  cts.filter(p=>p!==r).forEach(p=>add(p, `転回形（${ivName[mod(p-r)]||"和音の音"}がベース）`));
  if(prev && prev.root){ const pb=bassPc(prev);
    [1,2].forEach(st=>{ const p=mod(pb-st); if(scale.has(p) && (cts.includes(p)||tns.includes(p))) add(p, `下降ベース（前のベース ${droot(MANUAL_ROOTS[pb])} から下がる）`); });
    [1,2].forEach(st=>{ const p=mod(pb+st); if(scale.has(p) && (cts.includes(p)||tns.includes(p))) add(p, `上行ベース（前のベース ${droot(MANUAL_ROOTS[pb])} から上がる）`); });
    if(cts.includes(pb)||tns.includes(pb)) add(pb, `ペダル（前のベース ${droot(MANUAL_ROOTS[pb])} を保つ）`);
  }
  if(r!==K.pc && (cts.includes(K.pc)||tns.includes(K.pc))) add(K.pc, "主音ペダル（ベースを主音に保つ）");
  const A=analyze(u,K);
  if(isDomQ(u.q) || (u.q==="" && A.fn==="D")){
    const c={root:upIv(u.root,6,10), q:"", bass:u.root};
    if(!same(c,u)) out.push({c, name:"IV/V の形（V の上に ♭VII の和音・柔らかいドミナント）"});
  }
  return out;
}
// chords that lead to X: its dominant, its II, its tritone substitute, the diminished a semitone below
const domOf  = X => ({root:upIv(X.root,4,7),  q:isMinorish(X.q)?"7b9":"7"});
const twoOf  = X => ({root:upIv(X.root,1,2),  q:isMinorish(X.q)?"m7b5":"m7"});
const subOf  = X => ({root:upIv(X.root,1,1),  q:"7"});
const dimTo  = X => ({root:upIv(X.root,6,11), q:"dim7"});
// Every proposal for cell i, based on the chord that is there now (the original chord if the cell is empty).
// Items: {tech, c, name} or, for proposals that divide the cell in two, {tech, split:[first, second], name}
// where a null half keeps the current chord.
// a phrase begins at beat b (the song's phrase lengths, else 4 bars each; the same split as the guide's phrases())
function phraseStartsAt(b){
  const lens = song.phrases || Array.from({length:Math.ceil(song.nbars/4)}, (x,k)=>Math.min(4, song.nbars-k*4));
  let t=0; for(const n of lens){ if(Math.abs(t-b)<1e-6) return true; t+=n*song.bpb; }
  return false;
}
function techniques(i){
  const u=state.chords[i], base=(u&&u.root)?u:origAt(i), K=keyOfCell(i), next=state.chords[i+1], prev=state.chords[i-1];
  if(!base || !base.root) return [];
  const A=analyze(base,K), M=MDk(K), mi=K.minor, C=(r,q)=>KC(K,r,q), R=q=>({root:base.root, q});
  const out=[], seen=new Set([ckey(base)]);
  const add=(tech,c,name)=>{ const k=ckey(c); if(seen.has(k)) return; seen.add(k); out.push({tech,c,name}); };
  const addSplit=(tech,a,b,name)=>{ if(u.l<2) return; const k="s"+ckey(a||base)+">"+ckey(b||base); if(seen.has(k)) return; seen.add(k); out.push({tech, split:[a,b], name}); };
  const p=relPc(base,K);
  // 4和音にする
  if(base.q===""){
    if(A.fn==="D" && !(mi&&A.d===6)){ add("seventh",R("7"),"7th を足す"); add("seventh",R("7sus4"),"sus4 にする"); if(mi) add("seventh",R("7b9"),"♭9 を足す"); }
    else if((mi&&A.d===6) || (A.kind==="bor"&&p===10)) add("seventh",R("7"),"7th を足す");
    else if(A.kind==="dia" || A.kind==="bor"){ add("seventh",R("maj7"),"長7度を足す"); add("seventh",R("6"),"6度を足す"); }
    else if(M.deg[mod(p+5)]!=null) add("seventh",R("7"),`7th を足す（${ROMAN[mod(p+5)]} へのセカンダリードミナント）`);
  }
  if(base.q==="m" && (A.kind==="dia"||A.kind==="bor")){
    add("seventh",R("m7"),"短7度を足す");
    if((mi&&(A.d===0||A.d===3)) || (!mi&&A.d===1) || A.kind==="bor") add("seventh",R("m6"),"6度を足す");
    if(mi&&A.d===0) add("seventh",R("mM7"),"長7度を足す");
  }
  const nextMinor = next && next.root && isMinorish(next.q);
  if(base.q==="7"){
    add("seventh",R("7sus4"),"sus4 にする");
    if(nextMinor){ add("seventh",R("7b9"),"♭9 を足す"); add("seventh",R("7#9"),"#9 を足す"); add("seventh",R("7b13"),"♭13 を足す"); }
    else { add("seventh",R("9"),"9度を足す"); add("seventh",R("13"),"13度を足す"); add("seventh",R("7b9"),"♭9 を足す"); }
  }
  if(base.q==="" && (A.kind==="dia"||A.kind==="bor") && A.fn!=="D") add("seventh",R("add9"),"9度を足す（add9）");
  if(base.q==="maj7") add("seventh",R("maj9"),"9度を足す");
  if(base.q==="m7" && A.kind==="dia" && !(!mi&&A.d===2)) add("seventh",R("m9"),"9度を足す");
  // 同じ機能で置き換える
  if(A.kind==="dia" && A.fn){
    const afterD = prev && prev.root && analyze(prev,keyAt(prev.s)).fn==="D";
    M.fn.forEach((x,j)=>{ if(x!==A.fn || j===A.d) return; const c=C(...M.dia[j]);
      // a V that ends the previous phrase is a half cadence: the next phrase starting on VIm is not a deceptive cadence
      const decept = A.d===0 && j===5 && afterD && !phraseStartsAt(u.s);
      add("func", c, decept ? `偽終止（V → ${romanOf(c,K)}）` : `${FUNC_NAME[A.fn]}の仲間（${romanOf(c,K)}）`); });
  }
  // ベースを動かす
  bassOptions(i,K).forEach(x=>add("bass", x.c, x.name));
  // 同じコードが続く所を動かす（クリシェ）: one proposal covers the whole run of equal chords
  if(u.root && !u.bass){
    const U=state.chords; let a=i, b=i; while(a>0 && same(U[a-1],u)) a--; while(b<U.length-1 && same(U[b+1],u)) b++;
    const n=b-a+1, after=U[b+1], toIV = after && after.root && mod(rootPc(after.root)-rootPc(u.root))===5;
    const lines = ["","maj7","6","add9"].includes(u.q) ? [
        toIV ? [["","maj7","7"], "根音から半音ずつ下がる線で、次のコードへ", true] : [["","maj7","6","maj7"], "根音から下がって戻る線"],
        toIV ? [["","aug","6","7"], "5度から半音ずつ上がる線で、次のコードへ"] : [["","aug","6","aug"], "5度から上がって戻る線"] ]
      : ["m","m7"].includes(u.q) ? [ [["m","mM7","m7","m6"], "根音から半音ずつ下がる線"] ] : [];
    if(n>=2) lines.forEach(([seq,name,toEnd])=>{
      // toEnd: the line must arrive on its last chord in the last cell (C → Cmaj7 → C7 → F), so wait on the first chord
      const qs = toEnd ? (n===2 ? [seq[0], seq[seq.length-1]] : Array.from({length:n},(x,k)=>seq[Math.max(0, k-(n-seq.length))]))
                       : Array.from({length:n},(x,k)=>{ const m=seq.length, t=k%(2*m-2||1); return seq[t<m?t:2*m-2-t]; });
      out.push({tech:"cliche", cells:qs.map((q,k)=>({i:a+k, c:{root:u.root, q}})), name}); });
  }
  // 次のコードへ向かう
  if(next && next.root){
    const ns=sym(next), V=domOf(next), II=twoOf(next), toTonic=mod(rootPc(next.root)-keyAt(next.s).pc)===0;
    add("toward", V, `次の ${ns} への V7（${toTonic?"ドミナント":"セカンダリードミナント"}）`);
    add("toward", II, `次の ${ns} への II`);
    if(isDomQ(base.q)){ const ii={root:upIv(base.root,4,7), q:base.q==="7b9"?"m7b5":"m7"};
      addSplit("toward", ii, null, `II–V に分ける（前半を ${sym(ii)} に）`); }
    if(!same(V,base)) addSplit("toward", null, V, `後半だけ ${sym(V)} にする（${ns} へ向かう）`);
    addSplit("toward", II, V, `II–V にする（${ns} へ向かう）`);
  } else if(isDomQ(base.q)){ const ii={root:upIv(base.root,4,7), q:base.q==="7b9"?"m7b5":"m7"};
    addSplit("toward", ii, null, `II–V に分ける（前半を ${sym(ii)} に）`); }
  // 半音で近づく
  if(next && next.root){ const ns=sym(next);
    add("chrom", subOf(next), `裏コード（${ns} へ半音下行）`);
    if(rootPc(dimTo(next).root)!==rootPc(base.root)) add("chrom", dimTo(next), `パッシング・ディミニッシュ（${ns} へ半音上行）`);
  }
  if(isDomQ(base.q)) add("chrom", {root:upIv(base.root,4,6), q:"7"}, "この V7 の裏コード");
  // 借りてくる
  if(A.fn){
    const b = !mi ? {T:[["E♭","maj7","♭IIImaj7"],["A♭","maj7","♭VImaj7"]], S:[["F","m6","IVm6"],["F","m7","IVm7"],["B♭","7","♭VII7"],["D","m7b5","IIm7(♭5)"],["A♭","maj7","♭VImaj7"]], D:[["G","7b9","V7(♭9)"],["B♭","7","♭VII7（バックドア）"]]}[A.fn]
                  : {T:[["C","","I（長調の主和音）"],["C","maj7","Imaj7"]], S:[["F","7","IV7（ドリアの IV）"],["F","","IV"],["D","m7","IIm7"]], D:[["G","7sus4","V7sus4"]]}[A.fn];
    b.forEach(([r,q,n])=>add("borrow", C(r,q), n));
  }
  return out;
}
// the two chords a split proposal leaves in the cell
const splitPair = (it,i) => { const u=state.chords[i], b=(u&&u.root)?u:origAt(i); return [it.split[0]||{root:b.root,q:b.q,bass:b.bass}, it.split[1]||{root:b.root,q:b.q,bass:b.bass}]; };
const worst = vs => vs.includes("bad")?"bad":vs.includes("ok")?"ok":vs.includes("none")?"none":"good";
function itemVerdict(it,i){
  if(it.cells) return worst(it.cells.map(x=>verdict(rolesFor(x.c,x.i))));
  if(!it.split) return verdict(rolesFor(it.c,i));
  const u=state.chords[i], a=Math.ceil(u.l/2), [c1,c2]=splitPair(it,i);
  const vs=[verdict(rolesSpan(c1,u.s,a)), verdict(rolesSpan(c2,u.s+a,u.l-a))];
  return vs.includes("bad")?"bad":vs.includes("ok")?"ok":"good";
}
function applyItem(i, it){
  const label = it.label!=null ? it.label : TECH[it.tech].short;
  if(it.cells){
    it.cells.forEach(x=>{ const u=state.chords[x.i], o=origAt(x.i);
      state.chords[x.i] = !state.harm && same(x.c,o) && sameCell(u,o) ? {s:u.s, l:u.l, root:o.root, q:o.q} : {s:u.s, l:u.l, root:x.c.root, q:x.c.q, tech:label}; });
    save(); render(); return;
  }
  if(!it.split){ setChord(i, it.c, label); return; }
  const [c1,c2]=splitPair(it,i); splitUnit(i,true);
  const put=(k,c,changed)=>{ const u=state.chords[k]; state.chords[k]={s:u.s, l:u.l, root:c.root, q:c.q, ...(c.bass&&rootPc(c.bass)!==rootPc(c.root)?{bass:c.bass}:{}), tech:changed?label:u.tech}; };
  put(i,c1,!!it.split[0]); put(i+1,c2,!!it.split[1]);
  save(); render();
}
// groups for the 置き換え候補 / コード候補 tab
function suggest(i){
  if(state.harm) return harmSuggest(i);
  const list=techniques(i);
  return TECH_ORDER.map(t=>({tech:t, title:TECH[t].name, desc:TECH[t].desc, items:list.filter(x=>x.tech===t)})).filter(g=>g.items.length);
}

// ---------- harmonize-from-melody suggestions ----------
const TRIADS = { major:[["C",""],["D","m"],["E","m"],["F",""],["G",""],["A","m"]],
                 minor:[["C","m"],["E♭",""],["F","m"],["G",""],["A♭",""],["B♭",""]] };
function fitScore(c,i){ const rs=rolesFor(c,i), v=verdict(rs);
  return (v==="good"?100:v==="ok"?50:0) + rs.filter(r=>r.strong&&r.kind==="ct").length*10 + rs.filter(r=>r.kind==="ct").length; }
function harmSuggest(i){
  const K=keyOfCell(i), C=(r,q)=>KC(K,r,q), cur=state.chords[i], next=state.chords[i+1], groups=[], mode=K.minor?"minor":"major";
  const dia=[...TRIADS[mode].map(x=>C(...x)), ...MDk(K).dia.map(x=>C(...x))];
  const ranked=dia.map(c=>({c, sc:fitScore(c,i)})).filter(x=>x.sc>=50).sort((a,b)=>b.sc-a.sc).slice(0,8).map(x=>({c:x.c, name:romanOf(x.c,K)}));
  groups.push({tech:"dia", label:"ダイアトニック", title:"旋律に合うダイアトニック・コード", desc:"この枠の旋律がよく収まる、調の中のコードを合う順に並べています。骨格の音が和声音になるものほど上です。", items:ranked});
  if(next && next.root){
    const ns=sym(next);
    groups.push({tech:"toward", title:"次のコードへ向かう", desc:`次の ${ns} へ引き寄せるコード（V7、II、裏コード、パッシング・ディミニッシュ）。`,
      items:[{c:domOf(next),name:`${ns} への V7`},{c:twoOf(next),name:`${ns} への II`},{c:subOf(next),name:"裏コード"},{c:dimTo(next),name:"パッシング・ディミニッシュ"}]});
  }
  const bor = mode==="major" ? [["F","m6","IVm6"],["D","m7b5","IIm7(♭5)"],["B♭","7","♭VII7"],["A♭","maj7","♭VImaj7"],["E♭","maj7","♭IIImaj7"]] : [["F","7","IV7"],["C","","I"],["D","m7","IIm7"]];
  groups.push({tech:"borrow", title:"借りてくる", desc:"同じ主音の短調（長調）から借りるコードのうち、旋律に合うものだけを出しています。",
    items:bor.map(([r,q,n])=>({c:C(r,q),name:n})).filter(x=>verdict(rolesFor(x.c,i))!=="bad")});
  const seen=new Set(cur&&cur.root?[ckey(cur)]:[]);
  groups.forEach(g=>{ g.items=g.items.filter(x=>{ const k=ckey(x.c); if(seen.has(k)) return false; seen.add(k); return true; }); });
  const bo=bassOptions(i,K);
  if(bo.length) groups.push({tech:"bass", title:TECH.bass.name, desc:"置いたコードのベースだけを変えて、ベースラインをなめらかにする。", items:bo});
  groups.forEach(g=>g.items.forEach(x=>{ x.tech=g.tech; x.label = g.tech=="dia" ? "" : TECH[g.tech].short; }));
  return groups.filter(g=>g.items.length);
}
