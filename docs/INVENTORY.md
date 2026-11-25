# リハモ道場（Reharm Dojo）— 中身の一覧

道場シリーズの共通部品（書法コア）を検討するための一覧。2026-11-20 時点の `main`（4ced27f）のコードを読んで書いた。
コードで確かめていないことには「（推測）」と付けた。

## 1. 概要

### アプリ名・目的
- リハモ道場 / Reharm Dojo。メロディにコードを付ける練習（伴奏付け）と、原曲のコードを付け替える練習（リハモ）のためのブラウザ用アプリ。
- コードはジャズ・ポップスのコードネームで扱う。画面は日本語だけ。

### 主な機能
- **2つのモード**（`state.harm`）
  - 伴奏付け：旋律だけの曲にコードを置く。6段階のガイド（`GSTEPS`、`guideHtml`）がある。
  - リハモ：原曲のコードを置き換える。9段階のガイド（`RFLOW`、`rGuideHtml`）がある。
- **楽譜に役割を重ねる**：音符を、選んだコードに対する役割（和声音・テンション・アボイド・非和声音）で色分けする。下に度数、必要ならベースの行も出す（`vfSystem`）。
- **ぶつかりの判定**：枠ごとに ○△✕ を付ける（`verdict`）。
- **置き換え候補**：7つの手法の候補を出す（`techniques`）。伴奏付けでは旋律に合うダイアトニック・コードを出す（`harmSuggest`）。
- **「着地点から」タブ**：着地点のコードから手前へ、向かうコードを積む（`revHtml`、`approachOptions`）。
- **機能と度数の表示**：T・S・D、セカンダリードミナント、借用など（`analyze`、`romanOf`）。
- **案**：1曲に案A〜案Eまでの複数の版を持てる。違う所を並べて見たり、再生して聴き比べたりできる（`PLAN_NAMES`、`planDiff`、`renderPlans`）。
- **編集の補助**
  - 移調：12調から選ぶ（`setKey`）。
  - コードを変える間隔：1小節／2拍／1拍、3拍子は 2＋1 も選べる（`RHYTHMS`、`setRhythm`）。
  - 枠の分割・結合（`splitUnit`、`mergeNext`）と、Undo／Redo（`save`、`histGo`）。
  - 曲の入力（`compileForm`）と、コード進行を文字でコピー（`progText`）。
  - キー入力でコード名を置く（`quickParse`）。
- **再生**：全体、ここから、前小節から、原曲で、案で再生できる。くり返しと、メロディとコードの音量の配分もある（`playRange`）。
- **その他**：用語の説明（`TERM_TEXT`、`GLOSS`、`showTerm`）と、「はじめに」の案内（`showIntro`）。

### 言語・ビルド・公開
- 素の HTML・CSS・JavaScript で、ビルドはしない。フレームワークも npm の依存もない。
- スクリプトは `<script src>` で順に読む普通のスクリプトで、モジュールではない。トップレベルの `const`／`function` を全ファイルで共有する。**読み込み順が依存関係になっている**（`index.html` の末尾）。
- 公開先は GitHub Pages（`CLAUDE.md` の記述による。Pages の設定そのものはリポジトリにない）。
- 1ファイル版：`tools/single-file.py` が CSS と JS を1つの HTML に埋め込む。このとき VexFlow だけは jsDelivr の CDN から読む形に変える。Claude のアーティファクト公開用。

### ファイル構成
| ファイル | 役割 |
|---|---|
| `index.html` | ページの骨組み、曲の入力フォーム、フッター。末尾で全スクリプトを順に読む |
| `css/style.css` | 見た目。ライトとダークの色を変数で持つ（`prefers-color-scheme`、`data-theme`）。幅 720px 以下ではスマートフォン向けの配置になる |
| `js/songs.js` | 収録曲 `SONGS`（11曲） |
| `js/music.js` | 音名、コードの種類 `Q`、`parseChord`、移調（`setKey`、`xp`、`dnote`、`droot`、`sym`）、曲の読み込み `buildSong` |
| `js/theory.js` | 役割の判定（`roleOf`、`isStrong`、`isPassing`、`verdict`）、調と機能（`keyAt`、`analyze`、`romanOf`）、提案（`techniques`、`harmSuggest`、`bassOptions`） |
| `js/state.js` | `state`、localStorage、案、Undo、枠の編集 |
| `js/score.js` | VexFlow で楽譜を描く（`vfSystem`、`vfEngrave`、`vfMap`）と、全体の描き直し `render` |
| `js/guide.js` | 右のパネル：候補のタイル、着地点から、2つのガイド、フレーズと骨格の音（`phrases`、`skeletonNotes`） |
| `js/audio.js` | Web Audio の発振器で鳴らす（`tone`、`voicing`、`playRange`） |
| `js/app.js` | 曲のメニュー、曲の入力、用語説明、キー操作、起動 |
| `vendor/vexflow-bravura.js` | VexFlow 5.0.0（Bravura・Academico を埋め込んだ版）。同梱していて、編集しない |
| `test/theory.test.mjs` | `node --test`。`node:vm` に songs・music・theory・state を読み込んで試す（12件） |
| `tools/smoke.py` | Playwright（Python）で全曲・両モード・全ステップを開き、候補の適用と Undo を試す |
| `tools/single-file.py` | 上に書いた1ファイル版を作る |
| `docs/PLAN.md`、`CLAUDE.md` | 計画と作業の手引き（Fable が計画と確認、Opus が実装） |
| `LICENSE`、`THIRD_PARTY_NOTICES.md` | 著作権表示（All rights reserved）と他者の著作物の一覧 |

## 2. 音楽データの表し方（最重要）

### 音高
- **入力は音名＋オクターブ**（`"F#4"`、`"Bb3"`。中央のド＝C4）。読み込み時（`parseNotes`）に次の2つを持つ。
  - MIDI 番号 `midi`
  - 綴り `sp:{li, alter, oct}`。`li` は文字の番号（C=0〜B=6）、`alter` は ♯＋1・♭−1。
- **異名同音は区別する。** 綴りを保ち、音高から名前を作り直さないのが設計の要点（`CLAUDE.md` の「1」）。
  - 曲ごとに「C の枠での pc → 綴り」の表 `song.spellC` を作る（`buildSong`）。
  - 表示は `dnote(midi)` が `spellC` から綴りを引き、選んだ調へ文字ごと移す（`xposeSpelled`）。
  - 曲に無い pc は `MANUAL_ROOTS`（C, D♭, D, E♭, E, F, F#, G, A♭, A, B♭, B）で綴る。
- コードの根音・ベースは**文字列の音名**で持つ（`"B♭"`、`"F#"`）。
  - 計算するときに `rootPc(name)` で pc にする。
  - 新しい根音は `upIv(name, 文字数, 半音数)`、コードの上の音は `noteAbove(root, 半音数)` で作る。
- 臨時記号の字が揃っていない。内部の名前は ♭ を `"♭"`（U+266D）で、♯ を `"#"`（ASCII）で持つ。入力は `b`／`♭`／`#`／`♯` のどれも読む。
- ダブルシャープ・ダブルフラットは入力できない（`parseNotes` の正規表現が臨時記号1つまで）。表示側の `accStr` は2つ以上も出せる。

### 音価・拍・小節
- 時刻は**曲の頭からの拍数（4分音符＝1）の小数**。
  - 音符は `{midi, start, dur, tie, tiedFrom, idx, sp}`、休符は `{start, dur}`。
  - アウフタクトは負の `start` に置き、その長さを `song.pk` に持つ。
- 拍子は `bpb`（1小節の拍数）だけで持つ。分母はいつも4として描く（`` `${bpb}/4` ``）。
  - 入力フォームで選べるのは 4/4・3/4・2/4。6/8 などはない。
- 3連符は `"1/3"` のような分数で書き、`durOf` が小数（1/3）にする。
  - 楽譜では `TRIP` 表に当てはめて `V.Tuplet` を付ける。
  - 小数で比べるので、あちこちで `1e-6` の許容を使っている。
- タイは音の末尾の `~`。`tie`／`tiedFrom` を立てる。再生ではつないだ長さで鳴らす。
- 小節は「`start / bpb` の整数部」で求めるだけで、小節のオブジェクトはない。

### 声部
- **旋律は1声だけ**（`song.notes` は1本の列）。複数の声部を持つ仕組みは「なし」。
- 和音の声部（ボイシング）はデータとして持たない。再生のときだけ `voicing(c)` が組む：ベースは MIDI 40 付近、上の音は 53 付近に寄せる。

### 和音
- **コードネームの枠（セル）の列**で持つ。`state.chords` が `{s, l, root, q, bass?, tech?}` の並び。
  - `s` は開始拍、`l` は長さ（拍）。枠は小節をまたがない。
  - `root:null` は「未設定」（伴奏付けモードの空の枠）。
  - `tech` は、どの手法で置いたかの印（表示用の短い名前。`techId` で手法の id に戻す）。
- コードの種類は `Q` 表のキー（`""`、`"maj7"`、`"m7b5"`、`"7b9"` など22種）。
  - 種類ごとに、根音からの半音数→度数名を3つの表で持つ：和声音 `ct`、テンション `tn`、アボイド `av`。
  - `QALIAS` が `CM7`、`C△7`、`Cø`、`C-7` などの別名を正規の名前にそろえる（`normQ`、`parseChord`）。
- **ローマ数字は持たず、その場で計算する**。
  - `romanOf(c, K, next)` が作る。半音で上へ進む減七は `#I°7`、それ以外は `♭III°7` のように名前を変える。
  - `analyze` が `{fn, kind, roman, d, alt?, note?}` を返す。`kind` は dia／sec／bor／sub／dim／other のどれか。
- 数字付き低音は「なし」。分数コードはベースの音名（`bass`）だけで持ち、転回の数字は持たない。
- 原曲のコードは `song.orig`（同じ形の列）。`origAt(i)` で枠 i の位置の原曲コードを引く。

### 調・転調
- **内部はいつも C**（短調は C マイナー）。`buildSong` が曲を C の枠へ移す。
  - 移す量は、曲データの `src`（書かれた調の主音）から決める。
  - 文字は同じ度数だけずらし、綴りを保つ。
- 表示と音だけを、選んだ調へ移す。
  - 移す量は `xp = {name, semis, steps, sig, alters}`。`setKey` が旋律の平均の高さから、上下どちらへ移すかを選ぶ。
  - 選べる調は `KEYS_MAJ`／`KEYS_MIN`（12調ずつ）。調号の数 `sig` も一緒に持つ。
- 転調区間：曲データの `keys:[[開始小節, 終了小節, 主音, "major"|"minor"]]` を、`song.regions = [{b0, b1, tonic, minor}]`（拍で持つ）にする。
  - `keyAt(拍)` がその場所の調 `{tonic, pc, minor}` を返す。
  - 調ごとのコード表は C を基準に書き、`KC(K, "F", "m6")` でその調へ移す。
- 長調・短調の音階とダイアトニック・コードは `MODES` と `DIA_Q` で持つ。短調は8つの度：和声的短音階の VII°7 を含み、V は 7 と m／m7 の両方を許す。
- ブルースの曲（`blues:true`）だけは、I・IV・V のドミナント7を T・S・D とみなす（`analyze`）。

### データの例（`js/songs.js`）
```js
happy:{ name:"ハッピーバースデー", bpb:3, slot:3, pickup:"G4:0.75 G4:0.25",
  bars:["A4 G4 C5","B4:2 G4:0.75 G4:0.25", …],
  chords:"C | G7 | G7 | C | C7 | F | G7 | C" },
tea:{ name:"Tea for Two", bpb:4, slot:2, src:"A♭", home:"A♭", keys:[[9,15,"C","major"]], bars:[…], chords:"Bbm7 Eb7 | …" },
```
- コードは小節を `|` で区切り、1小節に1〜`bpb` 個を書く。等分できないときは長いほうを先にする（3拍子で2つなら 2＋1、`splitBar`）。
- 曲の入力フォームでは `-`（または `%`）で「前と同じ」と書ける（`compileForm`）。
- 自分の曲は、同じ形（と、入力をそのまま残した `raw`）で localStorage に保存する。

## 3. 機能ごとの実装

| 項目 | あるか・どこにあるか・作り方 |
|---|---|
| 楽譜表示 | **あり**。VexFlow 5.0.0（Bravura・Academico を埋め込んだ `vexflow-bravura.js`）を `vendor/` に同梱し、`<script>` で読む。グローバルの `window.VexFlow` を使う。詳しくは下 |
| MIDI入力 | なし |
| 音の再生 | **あり**。`js/audio.js`。Web Audio の三角波の発振器に、ローパスと音量の包絡を掛ける（`tone`）。音源ファイルはない。出口にコンプレッサーを置いている。詳しくは下 |
| マイク入力・音高判定 | なし |
| 音程・コード・調の計算 | **あり**。`js/music.js`（`rootPc`、`upIv`、`noteAbove`、`parseChord`）と `js/theory.js`（`roleOf`、`keyAt`、`analyze`、`romanOf`）。音程はすべて pc の差（`mod 12`）で計算し、綴りは文字数で別に付ける |
| 規則の判定と採点 | **あり**。詳しくは下 |
| 課題・問題データ | `js/songs.js` の `SONGS`（JS のオブジェクト）。11曲で、難易度の分け方は `app.js` の `SONG_LEVELS`。「問題と正解」の形ではなく、原曲のコード（`song.orig`）を答えの一例として見せる（`answerNote`） |
| ファイルの読み込み・書き出し | MusicXML・MIDI は「なし」。書き出しは、コード進行を小節線つきの文字にしてクリップボードへ（`progText`、`copyText`）。読み込みは曲の入力フォームの独自の文字形式だけ（`compileForm`、`parseTok`） |
| 言語切替 | なし（日本語のみ。README の最後に英語の段落があるだけ） |
| 保存 | **あり**。localStorage。`store.get/set`（JSON）と、同じ働きの `store0`（`state.js`）。キーは下 |
| PWA・オフライン | なし（manifest も Service Worker もない）。VexFlow を同梱しているので、通信がなくても楽譜は出る。Google Fonts が読めないときは端末のフォントになる |
| 著作権表示 | **あり**。`LICENSE`、`THIRD_PARTY_NOTICES.md`、README の「著作権・ライセンス」、`index.html` の `<footer class="foot">` |

### 楽譜表示の作り（`js/score.js`）
- **1段の決まり**：1段は4小節。楽譜の欄が 600px 未満なら2小節（`barsPerSystem`）。どの段も同じ横幅にそろえる（`vfEngrave` の `W`）。
- **VexFlow に任せる部分**：小節ごとに `Stave` を作り、`StaveNote` を置き、`Voice`（SOFT モード）→ `Formatter` の順で並べる。
  - 並べるときは `softmaxFactor: 10` にしている。
  - 次も VexFlow に任せる：臨時記号（`Accidental.applyAccidentals`）、連桁（`Beam.generateBeams`）、3連符（`Tuplet`）、タイ（`StaveTie`）、付点（`Dot`）。
  - 小節の最後の音のあとに `GhostNote` を足して、余白を作る。
- **アプリが重ねる部分**：枠の色、度数、ベースの行は、アプリが SVG の文字列で重ねる（`svg()`）。
  - 音符の頭の色は `setKeyStyle` で付ける。
  - 時刻→x座標は、VexFlow が置いた音符の位置から補間する（`vfMap` の `x(t)`、`edge(t)`）。
- **描き方とキャッシュ**：画面外の `div` に VexFlow で描き、`innerHTML` を文字列として取り出す。
  - その文字列を段ごとにキャッシュする（`vfCache`、最大64。キーは曲・調・枠・色など）。
  - 枠を選ぶだけなら描き直さない（`selectCell`）。
- **フォント**：Bravura が読み込まれるまで待つ（`vfWaitFonts`、`document.fonts.check`）。
- **できないこと**：音部記号はト音記号だけ。五線は1段だけ（大譜表・ヘ音記号はない）。

### 音の再生の作り（`js/audio.js`）
- 和音は `voicing(c)` が組む：ベース1音と、`Q[c.q].ct` の音を中音域に寄せたもの。4和音以上のときは根音を上の声部から抜く。
- 時刻の取り方：`ctx.currentTime` から拍を求め、`requestAnimationFrame` で鳴っている枠に印を付ける（`markPlaying`）。
- くり返し：`replayBeats` が拍の範囲から枠を探し直す（再生中の分割・結合に耐えるため）。
- 音量の配分：メロディとコード（ベースを含む）の比を `melGain`／`chordGain` で決める（2乗）。

### 規則の判定と採点
- **役割**：`roleOf` がメロディ音をコードに対する ct／tn／av／nc／un に分ける。un はコードが未設定の印。
- **骨格の音**（`isStrong`）：次のどれかに当たる音。
  - 枠の最初の音
  - 1拍目の音（4拍子は3拍目も）
  - 枠の中で長く鳴る音（1.5拍以上、または枠の半分以上）
- **経過音**（`isPassing`）：前後と途切れずにつながる1拍以下の音で、同じ向きに2半音以内で通り過ぎるもの。数えない。
- **枠の判定**（`verdict`）：none／good／ok／bad の4つ。骨格の音（経過音を除く）が av か nc なら bad（✕）。短い音だけがぶつかるなら ok（△）。
  - 画面の上に ○△✕ の数を出す（`render` の `#summary`）。
- **流れの注意**（`flowIssues`、伴奏付けのガイド）：空いた枠、✕ の枠、D→S、同じコードが4枠以上続くこと、最後が T でないこと。
- **原曲との比べ方**（`answerNote`）：同じコード／同じ機能／違う機能に分けて文を出す。
- **点数・合否・記録**はない。伴奏付けで「原曲と同じ枠の数」「同じ機能の枠の数」を数えて見せるだけ。
- **テスト**：収録曲の原曲コードに ✕ が出ないことを `test/theory.test.mjs` で見ている。

### 保存（localStorage のキー。すべて `rehamo:` で始まる）
- **曲ごと**
  - `rehamo:<曲id>`：リハモのコード列。`rehamo:h:<曲id>` は伴奏付けのもの（`saveKey`）。
  - `rehamo:p:<曲id>`：リハモの案 `{list:[{name, chords}], cur}`。`rehamo:hp:<曲id>` は伴奏付けのもの（`plansKey`）。
  - `rehamo:key:<曲id>`：選んだ調。
  - `rehamo:gstep:<曲id>`：伴奏付けのガイドの段階。`rehamo:rgstep:<曲id>` はリハモのもの（`gstepKey`）。
- **全体の設定**
  - モード `rehamo:harm`
  - 開いていたタブ `rehamo:tab`（伴奏付けは `rehamo:tab:h`）
  - 表示と再生：度数を表示 `rehamo:roman`、短調はラから読む `rehamo:la`、くり返し `rehamo:loop`、音量の配分 `rehamo:mix`
  - 最後に開いた曲 `rehamo:last`、はじめにの案内 `rehamo:intro`
- **自分の曲**：`rehamo:songs`（曲データの配列）。

## 4. 依存関係

| 名前 | 版 | 読み込み方 | 用途 |
|---|---|---|---|
| VexFlow（Bravura・Academico 入り） | 5.0.0（ファイルの先頭：2025-03-05、0ca6f88） | 同梱 `vendor/vexflow-bravura.js`（1ファイル版だけ jsDelivr の CDN） | 楽譜 |
| Google Fonts（Zen Kaku Gothic New、Barlow Condensed） | — | `<link>` で CDN から | 画面の文字 |
| Node.js の `node:test`／`node:vm` | — | 開発のときだけ | 理論のテスト |
| Playwright（Python）＋Chromium | — | 開発のときだけ | `tools/smoke.py` |

**他のアプリから写したコード**
- `vendor/vexflow-bravura.js` は、作業場所にある gradus-dojo の写し（2026-11-18 時点）の同じ名前のファイルと**1バイトも違わない**（`cmp` で確かめた）。
- gradus-dojo の `js/score.js` には、このアプリの `SIGKEY`、`parseSpelled`、`softmaxFactor` などと同じ名前のものはなかった。楽譜まわりのコードは別々に書かれている（`GhostNote` を使う点だけ共通）。
- 理論・再生のコードを他から写したという記述も、それと分かる形跡も見つからなかった。

## 5. 共通化の候補

### 他の音楽アプリでも使えそうな部分
- **綴りを保つ音名と移調**（`music.js` の `parseSpelled`、`xposeSpelled`、`upIv`、`noteAbove`、`accStr`、`spell`）
  - 理由：調を変えても F♭ や B♭♭ を出さない仕組みは、楽譜を出すどのアプリにも要る。
  - 純粋な関数に近い。ただし `xp`・`song` というグローバルを読む部分がある（`dnote`、`setKey`）。
- **音符の文字の形式**（`parseNotes`、`durOf`、`parseTok`、`splitBar`）
  - 理由：`E4:0.5`、`r:2`、`~`、`1/3` の形は短く、手で書ける。他のアプリの課題データにも使える（推測）。
  - 1声の旋律しか想定していない。
- **VexFlow で1段を描き、時刻→x座標の対応表を返す部分**（`vfEngrave`、`vfMap`、`splitDur`、`VDUR`／`TRIP`、`SIGKEY`、`vfWaitFonts`）
  - 理由：音符に色を付けたり、楽譜の上に印を重ねたりする作りは、和声・対位法のアプリでも同じ形になる（推測）。
  - 段ごとに文字列でキャッシュする作りも、そのまま使える。
- **コード名の読み取りと、種類ごとの和声音・テンション・アボイドの表**（`Q`、`QALIAS`、`parseChord`、`sym`）
  - 理由：コードネームを扱うアプリ（アドリブ道場など）と、判定の基準をそろえられる。
- **メロディ音の役割の判定**（`roleOf`、`isStrong`、`isPassing`、`verdict`）
  - 理由：「骨格の音」「経過音」の考えは、旋律と和声を比べるアプリで共通に使える。
- **localStorage の薄い包み**（`store`）と、文字列のスナップショットで持つ Undo（`save`、`histGo`）
  - 理由：小さくて独立している。

### このアプリ固有の事情が強く、共通化しにくい部分
- **手法ごとの提案**（`techniques`、`TECH`、`harmSuggest`、`approachOptions`、`bassOptions`、`widenOptions`、`colorOptions`）
  - 理由：リハモの教え方（どの順で何を出すか）そのもので、ガイドの段階（`RFLOW`、`GSTEPS`）と強く結び付いている。
- **調と機能の分析**（`analyze`、`MODES`、`DIA_Q`）
  - 理由：ジャズ・ポップスのコードネームを前提にしている（例：短調の V に m7 も許す、ブルースの I7・IV7）。
  - クラシックの和声（数字付き低音、声部の連結）とは基準が違う。そのまま共通にすると食い違う（推測）。
- **「C の枠」で全部を持つ設計**（`buildSong`、`xp`）
  - 理由：分析は楽だが、楽譜を書かれた調のまま扱う他のアプリとは前提が違う。
  - 共通部品にするなら、この写し替えをどこでするかを決める必要がある。
- **枠（セル）のデータ構造**と、それに付く処理（分割・結合、案、着地点から）
  - 理由：「小節をまたがない、拍で区切ったコード枠」はこのアプリの UI の都合で決めたもの。
- **画面に合わせた描画の細かな調整**（`BAR_PAD`、`PK_PAD`、アウフタクトの幅、度数とベースの行の高さ `setGeom`）
  - 理由：このアプリの1段の見た目に合わせた数値。
- **再生の音色**（三角波の簡単な合成）
  - 理由：音源を使う他のアプリ（アドリブ道場は SoundFont）とは作りが違う。

### アプリ間で食い違いそうな点（このアプリから見えるもの）
- **音高**：このアプリは「MIDI 番号＋綴り」を両方持つ。
- **時刻**：このアプリは「拍の小数」。分数（`Fraction`）や tick では持っていない。
- **拍子**：分母は4に固定。
- **臨時記号の字**：内部で `"♭"` と `"#"` が混在している。
- **グローバル**：グローバルの状態（`song`、`state`、`xp`）に頼る関数が多い。共通にするなら引数で渡す形に直す必要がある。

## 6. 既知の問題

TODO・FIXME のコメントは無い（`grep` で確かめた）。コードを読んで気づいた点：

- **出典のない旋律**：`CLAUDE.md` は「旋律は出典から書き起こしたものだけ、出典は曲データのコメントに書く」としている。しかしコメントに出典があるのは「歓喜の歌」と「アメイジング・グレイス」の2曲だけ。残りの9曲（自作のブルースを除けば8曲）にはない。
- **使われていない項目**：曲データの `slot` は、`compileForm` で作るだけで、どこからも読まれていない。
- **同じ役の項目が2つ**：既定の調を決める項目が `origKey` と `home` の2つある（`loadSong`）。曲によって片方だけを書いている。
- **曲を消したときの保存**：自分の曲を消すと、関連キーに `null` を書く（`store.set(..., null)`）。キーそのものは消えず、`"null"` が残る（`app.js` 115行目付近）。
- **同じ働きの関数が2つ**：`store0` と `store.get` が同じことをしている（`state.js`）。
- **読み込み順への依存**：`$` と `esc` は `score.js` で定義しているのに、それより前に読む `theory.js` の関数（`fnText`）が使っている。呼ばれるのが後なので動いているが、読み込み順に頼っている。
- **入力の検証**：`parseNotes` は不正な音（例：`H4`）を受けると `null` を読んで例外になる。入力フォームは `parseTok` で先に弾くので、問題になるのは収録曲を手で書き換えたときだけ。
- **できないこと**
  - ダブルシャープ・ダブルフラットを入力できない。
  - 6/8 などの複合拍子がない。
  - ヘ音記号・複数の声部がない。
- **PLAN.md の「未決」**：E と F が残っている。確認の結果の R3・R4 で答えが出ているので、消し忘れと思われる（推測）。
- **再生の止め方**：`playRange` が鳴らし終えたときの片付けが `play.bus.disconnect && setTimeout(()=>bus.disconnect(),600)` という、条件式に見える書き方になっている。動きに害はないが紛らわしい。
- **自動テストで見ていないもの**：音（`smoke.py` はエラーの有無だけを見る）と、見た目（スクリーンショットは手で確かめる決まり）。

## 7. 作者のメモ

### 共通にしたい部分：

以下は可能な範囲でアプリ間で共通にしたい。

- 読み込み可能な楽譜のフォーマット
- コードの表記(同音異名の扱い)
- 他のアプリと音源データや再生方法 (音源を他のアプリで使っているよりよい音のものに変えたい。) 伴奏パタンも使えるものは利用したい。


### このアプリに残したい部分：
