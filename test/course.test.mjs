// Tests for the beginner course's tasks (docs/PLAN.md section 5):  node --test
// Every pick must be an entry of that step's own candidate list, with the verdict the plan's tables give.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
// guide.js and course.js only need a few page helpers at call time, so they are stubbed
const ctx = vm.createContext({ console, matchMedia: () => ({ matches: false }) });
vm.runInContext("var $ = () => null, esc = s => String(s);", ctx);
for (const f of ["songs", "music", "theory", "state", "guide", "course"]) vm.runInContext(readFileSync(new URL(`js/${f}.js`, root), "utf8"), ctx, { filename: f + ".js" });
const run = code => { const v = vm.runInContext(code, ctx); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
// the harmonize tasks of steps 5-6 assume the original's chords in place, so both modes start from them
const load = (id, harm) => run(`song=buildSong(${JSON.stringify(id)}); state.songId=${JSON.stringify(id)}; state.harm=${harm};
  setKey("C"); state.chords=origUnits(); null`);
const songs = run("Object.keys(COURSES)");

test("the course covers the four beginner songs, both modes", () => {
  assert.deepEqual(songs.sort(), ["jingle", "joy", "saints", "twinkle"]);
  for (const id of songs) for (const m of ["reharm", "harm"]) {
    const ts = run(`COURSES.${id}.${m}`), flow = run(`CFLOW.${m}`);
    assert.equal(new Set(ts.map(t => t.id)).size, ts.length, `${id} ${m}: task ids are unique`);
    // every step has a task, except a cliché step in a song with no chord held inside a phrase
    for (const s of flow) if (s !== "cliche") assert.ok(ts.some(t => t.step === s), `${id} ${m}: step ${s} has a task`);
    for (const t of ts) assert.ok(flow.includes(t.step), `${id} ${m} ${t.id}: unknown step ${t.step}`);
  }
});

for (const id of songs) for (const [m, harm] of [["reharm", false], ["harm", true]]) {
  test(`${id} (${m}): every pick is in the step's list, with the planned verdict`, () => {
    load(id, harm);
    const ts = run(`COURSES.${id}.${m}`);
    for (const t of ts) {
      if (t.spots) { for (const s of t.spots) assert.ok(run(`cellAtBeat(beatOf(${s.bar},${s.beat}))`) >= 0, `${t.id}: spot bar ${s.bar}`); continue; }
      if (!t.picks) continue;
      const i = run(`taskCell(COURSES.${id}.${m}.find(x=>x.id===${JSON.stringify(t.id)}))`);
      assert.ok(i >= 0, `${t.id}: no cell starts at bar ${t.bar} beat ${t.beat}`);
      if (t.need) assert.ok(run(`same(state.chords[${i}], parseChord(${JSON.stringify(t.need)}))`), `${t.id}: the original has ${t.need} there`);
      const rp = run(`resolvePicks(COURSES.${id}.${m}.find(x=>x.id===${JSON.stringify(t.id)}), ${i}).map(r=>({c:r.p.c, found:!!r.it, v:r.v, bad:!!r.p.bad}))`);
      assert.equal(rp.filter(r => r.bad).length <= 1, true, `${t.id}: at most one clashing example`);
      assert.ok(t.picks.filter(p => p.best).length === 1, `${t.id}: one recommended pick`);
      for (const r of rp) {
        assert.ok(r.found, `${id} ${t.id}: ${r.c} is not in the ${t.step} list`);
        assert.equal(r.v, r.bad ? "bad" : "good", `${id} ${t.id}: ${r.c} is ${r.v}`);
      }
    }
  });
}

test("a clashing example comes with its reason", () => {
  for (const id of songs) for (const m of ["reharm", "harm"])
    for (const t of run(`COURSES.${id}.${m}`)) for (const p of t.picks || []) if (p.bad) assert.ok(p.why, `${id} ${t.id}: ${p.c}`);
});

test("the course is off for songs without tasks", () => {
  load("happy", false);
  assert.equal(run("courseData()"), null);
  assert.equal(run("courseOn()"), false);
});

// the learner's path: each task's picks are checked on the cells as earlier tasks left them (their ★ placed),
// so a later step never finds its cell already changed into something its list no longer offers
test("reharm: every task still works after the earlier tasks' recommended picks are placed", () => {
  vm.runInContext("var render = () => {}; save = () => {};", ctx);
  for (const id of songs) {
    load(id, false);
    for (const step of run("CFLOW.reharm")) for (const t of run(`COURSES.${id}.reharm.filter(x=>x.step===${JSON.stringify(step)} && x.picks)`)) {
      const sel = `COURSES.${id}.reharm.find(x=>x.id===${JSON.stringify(t.id)})`;
      const i = run(`taskCell(${sel})`);
      assert.ok(i >= 0, `${id} ${t.id}: no cell at bar ${t.bar} beat ${t.beat} after the earlier steps`);
      const rp = run(`resolvePicks(${sel}, ${i}).map(r=>({c:r.p.c, found:!!r.it, v:r.v, bad:!!r.p.bad, best:!!r.p.best}))`);
      for (const r of rp) {
        assert.ok(r.found, `${id} ${t.id}: ${r.c} is not offered once the earlier tasks are done`);
        assert.equal(r.v, r.bad ? "bad" : "good", `${id} ${t.id}: ${r.c} is ${r.v} on the learner's path`);
      }
      run(`(()=>{ const r=resolvePicks(${sel}, ${i}).find(r=>r.p.best); applyItem(${i}, r.it); })()`);
    }
  }
});
