// Tests for the course tasks (docs/PLAN.md sections 5 and 6):  node --test
// Every pick must be an entry of that step's own candidate list, with the verdict the plan's tables give,
// also when the earlier tasks' recommended picks are already placed (the learner's path).
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
// guide.js only needs a few page helpers at call time, so they are stubbed
const ctx = vm.createContext({ console, matchMedia: () => ({ matches: false }) });
vm.runInContext("var $ = () => null, esc = s => String(s);", ctx);
for (const f of ["songs", "music", "theory", "state", "guide"]) vm.runInContext(readFileSync(new URL(`js/${f}.js`, root), "utf8"), ctx, { filename: f + ".js" });
const run = code => { const v = vm.runInContext(code, ctx); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
// a course starts from the original's chords (basic, harmonize) or from the genre's foundation
const load = (id, genre, harm) => run(`song=buildSong(${JSON.stringify(id)}); state.songId=${JSON.stringify(id)}; state.harm=${harm}; state.genre=${JSON.stringify(genre)};
  setKey("C"); state.chords=${harm ? "origUnits()" : `genreBaseChords(${JSON.stringify(id)}, ${JSON.stringify(genre)})`}; null`);
const songs = run("Object.keys(COURSES)");
// [song, mode name, genre, tasks selector] for every course
const courses = [];
for (const id of songs) for (const g of run(`Object.keys(COURSES.${id})`)) courses.push(g === "harm" ? [id, "harm", "basic", true] : [id, g, g, false]);
const tasksOf = (id, name) => run(name === "harm" ? `COURSES.${id}.harm` : `COURSES.${id}.${name}.tasks`);
const sel = (id, name, tid) => (name === "harm" ? `COURSES.${id}.harm` : `COURSES.${id}.${name}.tasks`) + `.find(x=>x.id===${JSON.stringify(tid)})`;

test("every song has the basic course; the genres come on top of it", () => {
  for (const id of songs) assert.ok(run(`Object.keys(COURSES.${id})`).includes("basic"), id);
});

for (const [id, name, genre, harm] of courses) {
  test(`${id} (${name}): task ids are unique and every task belongs to a step of the course`, () => {
    load(id, genre, harm);
    const ts = tasksOf(id, name), flow = run("CFLOW()");
    assert.equal(new Set(ts.map(t => t.id)).size, ts.length);
    for (const t of ts) assert.ok(flow.includes(t.step), `${t.id}: unknown step ${t.step}`);
  });
}

test("a clashing example comes with its reason", () => {
  for (const [id, name] of courses) for (const t of tasksOf(id, name)) for (const p of t.picks || []) if (p.bad) assert.ok(p.why, `${id} ${name} ${t.id}: ${p.c}`);
});

test("the course is off for songs without tasks, and the harmonize course only for songs that have it", () => {
  load("happy", "basic", false);
  assert.equal(run("courseData()"), null);
  assert.equal(run("courseAvail()"), true);    // reharm: the tab is there and says the song has no tasks
  load("happy", "basic", true);
  assert.equal(run("courseAvail()"), false);
  load("amazing", "basic", true);              // amazing has genres but no harmonize course
  assert.equal(run("courseAvail()"), false);
  load("twinkle", "basic", true);
  assert.equal(run("courseAvail()"), true);
});

// the learner's path: each task's picks are checked on the cells as earlier tasks left them (their ★ placed),
// so a later step never finds its cell already changed into something its list no longer offers
for (const [id, name, genre, harm] of courses) {
  test(`${id} (${name}): every task works after the earlier tasks' recommended picks are placed`, () => {
    vm.runInContext("var render = () => {}; save = () => {};", ctx);
    load(id, genre, harm);
    for (const step of run("CFLOW()")) for (const t of tasksOf(id, name).filter(x => x.step === step)) {
      if (t.spots) { for (const s of t.spots) assert.ok(run(`cellAtBeat(beatOf(${s.bar},${s.beat}))`) >= 0, `${t.id}: spot bar ${s.bar}`); continue; }
      if (!t.picks || t.needCliche4) continue;   // needCliche4: the page first splits bars 1-2 into four cells of C
      const i = run(`taskCell(${sel(id, name, t.id)})`);
      assert.ok(i >= 0, `${id} ${name} ${t.id}: no cell at bar ${t.bar} beat ${t.beat}`);
      if (t.need) assert.ok(run(`same(state.chords[${i}], parseChord(${JSON.stringify(t.need)}))`), `${id} ${name} ${t.id}: needs ${t.need} there`);
      assert.ok(t.picks.filter(p => p.bad).length <= 1, `${id} ${name} ${t.id}: at most one clashing example`);
      assert.ok(t.picks.some(p => p.best), `${id} ${name} ${t.id}: a recommended pick`);
      const rp = run(`resolvePicks(${sel(id, name, t.id)}, ${i}).map(r=>({c:r.p.c, found:!!r.it, v:r.v, bad:!!r.p.bad}))`);
      for (const r of rp) {
        assert.ok(r.found, `${id} ${name} ${t.id}: ${r.c} is not in the ${t.step} list`);
        assert.equal(r.v === "bad", r.bad, `${id} ${name} ${t.id}: ${r.c} is ${r.v}`);   // a pick may be ○ or △, never ✕, unless it is the clashing example
      }
      run(`(()=>{ const r=resolvePicks(${sel(id, name, t.id)}, ${i}).find(r=>r.p.best); applyItem(${i}, r.it); })()`);
    }
  });
}
