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
    # how long a selection change takes on the longest song (see docs/PLAN.md, item D)
    ev('state.harm=false; applyHarmUi(); loadSong("tea")')
    ms = ev("(()=>{ const t=performance.now(); for(let k=0;k<10;k++){ state.sel=k; render(); } return (performance.now()-t)/10; })()")
    b.close()

print(f"{n} renders and edits, {len(errs)} page errors, selection change on Tea for Two: {ms:.0f} ms")
for e in errs[:10]:
    print("  ", e)
sys.exit(1 if errs else 0)
