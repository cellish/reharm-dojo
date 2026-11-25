// Tests for the music theory code (no browser needed):  node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const ctx = vm.createContext({ console });
// the app's files are plain scripts sharing one global scope; load the ones that need no page
for (const f of ["songs", "music", "theory", "state"]) vm.runInContext(readFileSync(new URL(`js/${f}.js`, root), "utf8"), ctx, { filename: f + ".js" });
// results cross from the vm realm, so plain copies are compared
const run = code => { const v = vm.runInContext(code, ctx); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
const load = (id, key) => run(`song=buildSong(${JSON.stringify(id)}); state.songId=${JSON.stringify(id)}; state.harm=false;
  setKey(${JSON.stringify(key ?? null)} ?? (song.home||"C")); state.chords=origUnits(); null`);
const cellAt = beat => run(`state.chords.findIndex(u=>Math.abs(u.s-${beat})<1e-6)`);
const A = i => run(`(()=>{ const a=analyze(state.chords[${i}], keyOfCell(${i}), state.chords[${i}+1]); return {fn:a.fn, kind:a.kind, roman:a.roman, alt:a.alt||null}; })()`);
const proposals = (i, tech) => run(`techniques(${i}).filter(x=>x.tech===${JSON.stringify(tech)}).map(x=>x.c?sym(x.c):x.split?splitPair(x,${i}).map(sym).join(">"):x.cells.map(c=>sym(c.c)).join(">"))`);

test("chord names are read in their common spellings", () => {
  load("twinkle");
  const read = s => run(`(()=>{ const c=parseChord(${JSON.stringify(s)}); return c?sym(c):null; })()`);
  assert.equal(read("CM7"), "Cmaj7");
  assert.equal(read("C△7"), "Cmaj7");
  assert.equal(read("Dm7(b5)"), "Dm7(♭5)");
  assert.equal(read("Cø"), "Cm7(♭5)");
  assert.equal(read("C/E"), "C/E");
  assert.equal(read("Bb7(#9)"), "B♭7(#9)");
  assert.equal(read("Csus"), "Csus4");
  assert.equal(read("C+"), "Caug");
  assert.equal(read("H7"), null);
});

test("a triplet eighth lasts a third of a beat", () => {
  assert.ok(Math.abs(run(`durOf("1/3")`) * 3 - 1) < 1e-9);
  assert.equal(run(`durOf(undefined)`), 1);
});

test("functions depend on the chord's quality, not only its root", () => {
  load("jingle");
  const d7 = run(`state.chords.findIndex(u=>u.root==="D"&&u.q==="7")`);
  assert.deepEqual(A(d7), { fn: null, kind: "sec", roman: "II7", alt: "V7/V" });
  assert.ok(!proposals(d7, "seventh").includes("Dm7"));
  assert.deepEqual(proposals(d7, "func"), []);
  const g7 = run(`state.chords.findIndex(u=>u.root==="G"&&u.q==="7")`);
  assert.equal(A(g7).fn, "D");
});

test("a modulated stretch is analysed in its own key", () => {
  load("tea");
  const cmaj = cellAt(40);                       // bar 11, Cmaj7 inside the C-major bridge of a song in A♭
  assert.equal(run(`sym(state.chords[${cmaj}])`), "Cmaj7");
  assert.deepEqual(A(cmaj), { fn: "T", kind: "dia", roman: "Imaj7", alt: null });
  assert.ok(!proposals(cmaj, "seventh").includes("Cm7"));
  assert.equal(A(cellAt(0)).roman, "IIm7");      // B♭m7 at the top is II of A♭
});

test("dominant sevenths are tonic, subdominant and dominant in a blues", () => {
  load("blues");
  assert.equal(A(0).fn, "T");
});

test("transposed songs keep sensible spellings", () => {
  load("tea");
  const names = run(`origUnits().map(sym)`);
  for (const n of names) assert.ok(!/♭♭|F♭|C♭|E#|B#/.test(n), `odd spelling: ${n}`);
  assert.ok(names.includes("Em7") && names.includes("E♭dim7"));
  load("godrest");
  assert.equal(run(`sym(state.chords[0])`), "Em");
  load("twinkle", "F#");
  assert.equal(run(`sym(state.chords[0])`), "F♯");
});

test("no original chord clashes with a structural melody note", () => {
  for (const id of run(`Object.keys(SONGS)`)) {
    load(id);
    const bad = run(`state.chords.map((u,i)=>verdict(rolesFor(u,i))==="bad"?slotName(i)+" "+sym(u):null).filter(Boolean)`);
    assert.deepEqual(bad, [], `${id}: ${bad.join(", ")}`);
  }
});

test("the dominant of the tonic is not called a secondary dominant", () => {
  load("twinkle");
  const i = run(`state.chords.findIndex((u,k)=>u.root==="C" && state.chords[k+1] && state.chords[k+1].root==="C")`);
  const names = run(`techniques(${i}).filter(x=>x.tech==="toward"&&x.c).map(x=>x.name)`);
  assert.ok(names.some(n => n.includes("ドミナント") && !n.includes("セカンダリー")));
});

test("a II–V proposal divides the cell and one undo step restores it", () => {
  load("twinkle");
  run(`globalThis.$ = () => ({}); render = () => {}; stop = () => {}; null`);   // page-side functions are not needed here
  const i = 6, before = run(`JSON.stringify(state.chords)`);
  run(`hist={undo:[],redo:[],last:JSON.stringify(state.chords)}; applyItem(${i}, techniques(${i}).find(x=>x.split&&x.split[0]&&x.split[1])); null`);
  assert.equal(run(`state.chords.length`), JSON.parse(before).length + 1);
  assert.equal(run(`hist.undo.length`), 1);
  run(`histGo(-1); null`);
  assert.equal(run(`JSON.stringify(state.chords)`), before);
});

test("a cliché that leads to IV inside a phrase arrives on the seventh chord", () => {
  // twinkle's melody with I held from bar 1 into bar 2 and IV on bar 2, beat 3 (all in the first phrase)
  run(`SONGS.ptest={...SONGS.twinkle, chords:"C C | C F | F C | G7 C | C F | C G7 | C F | C G7 | C C | F C | F C | G7 C"}; null`);
  load("ptest");
  const lines = run(`techniques(0).filter(x=>x.tech==="cliche").map(x=>x.cells.map(c=>sym(c.c)))`);
  run("delete SONGS.ptest; null");
  assert.ok(lines.some(l => l.join(",") === "C,C7"), JSON.stringify(lines));
});

test("a cliché stays inside one phrase", () => {
  // twinkle: the C ending phrase 1 (bar 4) and the C opening phrase 2 (bar 5) are not one held chord
  load("twinkle");
  assert.deepEqual(proposals(cellAt(14), "cliche"), []);
  // jingle: bars 1-4 hold C to the end of the phrase; the line does not lead into the F of the next phrase
  load("jingle");
  const lines = proposals(0, "cliche");
  assert.ok(lines.length > 0);
  assert.ok(lines.every(l => !l.endsWith("C7")), JSON.stringify(lines));
});

test("a cliché that leads to IV arrives on the seventh chord, but only inside a phrase", () => {
  const toNext = i => run(`techniques(${i}).filter(x=>x.tech==="cliche" && /次のコードへ/.test(x.name)).map(x=>x.cells.map(c=>sym(c.c)).join(">"))`);
  // 赤とんぼ: C, C, then F in the same phrase
  load("akatombo");
  assert.ok(toNext(0).length > 0);
  for (const p of toNext(0)) assert.equal(p.split(">").at(-1), "C7");
  // ジングルベル: the held C (bars 1–4) ends a phrase before F, so no line leads into it
  load("jingle");
  assert.deepEqual(toNext(0), []);
});

test("IV7 is a subdominant unless it moves on as a substitute or secondary dominant", () => {
  const an = (c, next, minor) => run(`(()=>{ const a=analyze(parseChord(${JSON.stringify(c)}), {tonic:"C", pc:0, minor:${minor}}, ${next ? `parseChord(${JSON.stringify(next)})` : "undefined"}); return {fn:a.fn, kind:a.kind}; })()`);
  load("twinkle");
  assert.deepEqual(an("F7", "C", false), { fn: "S", kind: "bor" });
  assert.deepEqual(an("F7", undefined, false), { fn: "S", kind: "bor" });
  assert.deepEqual(an("F7", "Em7", false), { fn: null, kind: "sub" });   // down a semitone to III
  assert.deepEqual(an("F7", "G7", true), { fn: "S", kind: "bor" });      // minor: Dorian IV7
  assert.deepEqual(an("F7", "B♭", true), { fn: null, kind: "sec" });     // minor: V7 of ♭VII
  assert.deepEqual(an("D♭7", "C", false), { fn: null, kind: "sub" });    // other substitutes are unchanged
});

test("solf reads syllables from the tonic, or from ラ in minor when chosen", () => {
  load("twinkle");
  const s = (midi, minor, la) => run(`state.laMinor=${la}; solf(${midi}, {tonic:"C", pc:0, minor:${minor}})`);
  assert.deepEqual([60, 64, 67, 71].map(m => s(m, false, true)), ["ド", "ミ", "ソ", "シ"]);   // major: never from ラ
  assert.deepEqual([60, 63, 67, 71].map(m => s(m, true, false)), ["ド", "ミ♭", "ソ", "シ"]);  // minor, read from ド
  assert.deepEqual([60, 63, 67, 65].map(m => s(m, true, true)), ["ラ", "ド", "ミ", "レ"]);    // minor, read from ラ
  assert.equal(s(71, true, true), "ソ♯");   // the leading tone of C minor (B) is ソ♯
  assert.equal(run(`state.laMinor=true; solf(62, {tonic:"D", pc:2, minor:true})`), "ラ");   // from the key's own tonic
  run("state.laMinor=false; null");
});

test("phrase lengths are kept only when they are whole bars adding up to the song", () => {
  const ph = p => run(`(()=>{ SONGS.ptest={...SONGS.twinkle${p === undefined ? "" : ", phrases:" + JSON.stringify(p)}}; const s=buildSong("ptest"); delete SONGS.ptest; return s.phrases; })()`);
  assert.equal(ph(undefined), null);              // built-in songs: 4 bars each
  assert.deepEqual(ph([4, 4, 2, 2]), [4, 4, 2, 2]); // twinkle has 12 bars
  assert.equal(ph([4, 4, 4, 4]), null);           // too many bars
  assert.equal(ph([6, 5.5, 0.5]), null);          // not whole bars
  assert.equal(ph([12, 0]), null);                // an empty phrase
  assert.equal(ph("4 4 4"), null);                // not a list
});

test("V → VIm is a deceptive cadence inside a phrase, but not when the V ended the previous phrase", () => {
  load("twinkle");
  const names = beat => run(`techniques(${cellAt(beat)}).filter(x=>x.tech==="func").map(x=>x.name)`);
  // bar 4: G7 → C ends the first phrase; the deceptive ending is offered under "終わり方を替える"
  assert.ok(run(`techniques(${cellAt(14)}).some(x=>x.tech==="cadence" && x.name.startsWith("偽終止"))`), "bar 4, beat 3");
  // bar 9 begins a phrase; the G7 of bar 8 was a half cadence
  assert.ok(!names(32).some(n => n.startsWith("偽終止")), "bar 9, beat 1");
  assert.ok(names(32).some(n => n.includes("VIm7")), "VIm7 is still offered as a tonic substitute");
});

test("♯IVm7(♭5) joins the half-step approaches between IV and I/V in major", () => {
  load("twinkle");   // bar 10: F (melody A A) then C
  const i = cellAt(36), list = run(`techniques(${i}).filter(x=>x.tech==="chrom").map(x=>({n:x.split?splitPair(x,${i}).map(sym).join(">"):sym(x.c), v:itemVerdict(x,${i})}))`);
  assert.ok(list.some(x => x.n === "F♯m7(♭5)" && x.v === "good"), JSON.stringify(list));
  assert.ok(list.some(x => x.n === "F>F♯m7(♭5)"), JSON.stringify(list));
  load("saints");    // bar 12: F with the melody on F clashes with F♯
  const j = cellAt(44), v = run(`techniques(${j}).filter(x=>x.tech==="chrom"&&x.c&&x.c.q==="m7b5").map(x=>itemVerdict(x,${j}))`);
  assert.deepEqual(v, ["bad"]);
});

test("the cadence technique offers other endings at a phrase's V → I, and only there", () => {
  load("twinkle");
  const at = b => run(`techniques(${cellAt(b)}).map(x=>x.tech+":"+(x.split?splitPair(x,${cellAt(b)}).map(sym).join(">"):sym(x.c)))`);
  const v4 = at(12);  // bar 4: G7 → C ends the first phrase
  for (const c of ["F", "Fm6", "B♭7", "D♭7", "Fm7>B♭7"]) assert.ok(v4.includes("cadence:" + c), c + " " + JSON.stringify(v4));
  // the same chords are not offered twice under borrow or chrom
  for (const c of ["Fm6", "B♭7", "D♭7"]) assert.ok(!v4.includes("borrow:" + c) && !v4.includes("chrom:" + c), c);
  // bar 8: G7 is a half cadence (the C after it opens a new phrase)
  assert.ok(!at(30).some(x => x.startsWith("cadence:")), "bar 8");
  // bar 4, beat 3: the I that ends the phrase may become VIm7 (deceptive) ...
  assert.ok(at(14).includes("cadence:Am7"));
  // ... but not the song's last chord
  const last = run("state.chords.length-1");
  assert.ok(!run(`techniques(${last}).some(x=>x.tech==="cadence")`));
});
