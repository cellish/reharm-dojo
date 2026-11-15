#!/usr/bin/env python3
"""Open the app in a headless browser and exercise it:  python3 tools/smoke.py

Every song, both modes, every guide step and tab is rendered; in reharm mode every proposal
on a few cells is applied and undone. Fails (exit 1) on any page error or undo mismatch.
Needs Playwright for Python with Chromium. Web fonts are blocked so it runs offline.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

page_url = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    pg.goto(page_url)
    pg.wait_for_function("vfOn()", timeout=10000)
    ev = pg.evaluate
    n = 0
    for harm in (False, True):
        ev(f"state.harm={'true' if harm else 'false'}; applyHarmUi(); restoreTab();")
        for sid in ev("Object.keys(SONGS)"):
            ev(f'loadSong("{sid}")')
            steps = ev("state.harm ? GSTEPS.length : RFLOW.length")
            for tab in ("guide", "cand", "rev"):
                for st in (range(1, steps + 1) if tab == "guide" else [1]):
                    for sel in ev("[0, Math.floor(state.chords.length/2), state.chords.length-1]"):
                        ev(f'state.tab="{tab}"; gmem[gstepKey()]={st}; state.sel={sel}; render()')
                        n += 1
            if harm:   # fill every cell with I, walk the guide again, then clear
                ev("state.chords.forEach((u,i)=>{ const P=PRIM(keyOfCell(i)); state.chords[i]={s:u.s,l:u.l,root:P.I.root,q:P.I.q}; }); save();")
                for st in range(1, steps + 1):
                    ev(f'state.tab="guide"; gmem[gstepKey()]={st}; state.sel=1; render()')
                    n += 1
                ev('$("#resetYes").click()')
            else:      # apply and undo every proposal on a few cells
                n += ev("""(()=>{ let k=0; const cells=[0,1,Math.floor(state.chords.length/2),state.chords.length-2].filter(i=>i>=0&&i<state.chords.length);
                  for(const i of cells){ const m=techniques(i).length; for(let j=0;j<m;j++){ const before=JSON.stringify(state.chords), it=techniques(i)[j]; if(!it) continue;
                    applyItem(i,it); k++; histGo(-1); if(JSON.stringify(state.chords)!==before) throw new Error("undo mismatch at cell "+i+", proposal "+j); } } stop(); return k; })()""")
    # the per-system engraving cache (VF_CACHE) must give the same sheet as engraving afresh
    ev('state.harm=false; applyHarmUi(); restoreTab(); loadSong("tea")')
    # VexFlow numbers its elements (vf-auto123) afresh on each engraving, so those ids are left out
    same = "(()=>{ const h=()=>$('#sheet').innerHTML.replace(/vf-auto\\d+/g,''); render(); const a=h(); VF_CACHE=false; render(); const b=h(); VF_CACHE=true; return a===b; })()"
    checks = [
        ("replace", "state.sel=5; setChord(5, techniques(5)[0].c || {root:'E',q:'7'}, 'test')"),
        ("split", "splitUnit(2); render()"),
        ("merge", "mergeNext(2); render()"),
        ("undo", "histGo(-1)"),
        ("transpose", "setKey('E♭'); setGeom(); render()"),
        ("undo all", "histGo(-1); histGo(-1)"),
        # Twinkle has no slash chord: the first one turns the bass row on (taller systems), Undo turns it off
        ("bass row on", "loadSong('twinkle'); render(); setChord(1, {root:'C', q:'', bass:'E'}, 'test')"),
        ("bass row off", "histGo(-1)"),
        ("back to Tea", "loadSong('tea')"),
    ]
    for name, js in checks:
        ev(js)
        if not ev(same):
            errs.append(f"cached sheet differs after {name}")
    # cached systems hold plain values only: a JSON round trip must give back the same thing
    # (a function, undefined, or an object of some class such as a VexFlow note would not survive it)
    plain = ev("""(()=>{ const same=(a,b)=>{ if(typeof a!=="object" || a===null) return Object.is(a,b);
        if(typeof b!=="object" || b===null) return false;
        if(Array.isArray(a) ? !Array.isArray(b) : Object.getPrototypeOf(a)!==Object.prototype) return false;
        const ka=Object.keys(a), kb=Object.keys(b); return ka.length===kb.length && ka.every(k=>same(a[k],b[k])); };
      const rt=v=>{ try{ return same(v, JSON.parse(JSON.stringify(v))); }catch(e){ return false; } };   // VexFlow objects are circular
      const vs=[...vfCache.values()]; return vs.length>0 && vs.every(rt); })()""")
    if not plain:
        errs.append("a cached system holds something other than plain values")
    # only the system holding the edited cell is engraved anew
    ev("render()"); vfw = "[...document.querySelectorAll('#sheet .vfw')].map(g=>g.innerHTML)"; before = ev(vfw)
    ev("setChord(state.chords.length-1, {root:'A', q:'m7'}, 'test')")
    after = ev(vfw)
    if [a == b for a, b in zip(before, after)] != [True] * (len(before) - 1) + [False]:
        errs.append("editing the last cell changed other systems")
    pg.set_viewport_size({"width": 480, "height": 900}); pg.wait_for_timeout(200)
    if ev("barsPerSystem()") != 2 or not ev(same):
        errs.append("cached sheet differs after narrowing to 2 bars per system")
    pg.set_viewport_size({"width": 1280, "height": 900}); pg.wait_for_timeout(200)
    if not ev(same):
        errs.append("cached sheet differs after widening back to 4 bars per system")
    ev('$("#resetYes").click()')
    # repeat playback goes on across a merge and a split made while playing (cell indices shift)
    ev('state.harm=false; applyHarmUi(); loadSong("twinkle"); state.bpm=150; state.loop=true; state.sel=state.chords.length-3; render()')
    ev("window.passes=[]; window.pr0=playRange; playRange=function(...a){ passes.push([a[0], a[1], a[2].length]); return pr0.apply(this, a); }; 0")
    # wait for each next pass (one pass is 2.4 s) rather than a fixed time, so a slow machine does not fail
    def wait_passes(k):
        try: pg.wait_for_function(f"passes.length>={k}", timeout=8000)
        except Exception: pass   # reported by the check below
    ev('$("#hearHere").click()'); ev("mergeNext(0); render()"); wait_passes(2)
    ev("splitUnit(0); render()"); wait_passes(3)
    loop = ev("[!!play, passes.length, passes[passes.length-1], state.chords.length]")
    if not loop[0] or loop[1] < 3 or loop[2][1] != loop[3]:
        errs.append(f"repeat after merge/split: playing {loop[0]}, passes {loop[1]}, last pass {loop[2]}, cells {loop[3]}")
    ev("stop(); playRange=pr0; state.loop=false; state.bpm=88; histGo(-1); histGo(-1)")
    # selectCell only moves the selection marks: the sheet must equal a full render() afterwards
    sheet = "$('#sheet').innerHTML.replace(/vf-auto\\d+/g,'')"
    for harm in (False, True):
        for sid in ("tea", "twinkle"):
            ev(f"state.harm={'true' if harm else 'false'}; applyHarmUi(); restoreTab(); loadSong('{sid}')")
            for k in ev("[1, Math.floor(state.chords.length/2), state.chords.length-1, 0]"):
                a = ev(f"selectCell({k}), {sheet}")
                if a != ev(f"render(), {sheet}"):
                    errs.append(f"selectCell({k}) on {sid} ({'harm' if harm else 'reharm'}) differs from render()")
    # how long a selection change takes on the longest song (see docs/PLAN.md, items A and I)
    ev('state.harm=false; applyHarmUi(); loadSong("tea")')
    ms = ev("(()=>{ const t=performance.now(); for(let k=0;k<10;k++){ state.sel=k; render(); } return (performance.now()-t)/10; })()")
    ms_sel = ev("(()=>{ const t=performance.now(); for(let k=0;k<10;k++) selectCell(k); return (performance.now()-t)/10; })()")
    b.close()

print(f"{n} renders and edits, {len(errs)} page errors, selection change on Tea for Two: render() {ms:.0f} ms, selectCell() {ms_sel:.0f} ms")
for e in errs[:10]:
    print("  ", e)
sys.exit(1 if errs else 0)
