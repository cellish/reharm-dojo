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

test("a cliché that leads to IV arrives on the seventh chord", () => {
  load("jingle");
  assert.deepEqual(proposals(0, "cliche")[0].split(">").slice(-2), ["Cmaj7", "C7"]);
});
