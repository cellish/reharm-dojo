# リハモ道場 / Reharm Dojo

メロディにコードを付ける練習と、コードを付け替える（リハーモナイズする）練習のためのブラウザ用ツールです。ジャズ・ポップスのコードネームで考えます。

- **伴奏付け**：旋律だけからコードを付けます。区切りと終わり方 → コードを変える間隔 → I・IV・V で埋める → 流れを確かめる → ダイアトニック・コードを広げる → 向かうコードと色づけ、の6ステップのガイド付きです。
- **リハモ**：原曲のコードを付け替えます。原曲を読む → 音を足して厚くする → 同じ機能で置き換える → ベースを動かす（分数コード） → 同じコードが続く所を動かす（クリシェ） → 次のコードへ向かう → 半音で近づく → 借りてくる → 見直す、の9ステップのガイドと、置き換え候補の一覧、着地点から手前へ組み立てる「着地点から」タブがあります。

楽譜の音符は、選んだコードに対する役割（和声音・テンション・アボイド・非和声音）で色分けされ、下に度数が表示されます。骨格の音（強拍や長い音）がぶつかる所は印で知らせます。コードの機能（T・S・D、セカンダリードミナント、借用など）と度数（IIm7、V7/V など）も表示できます。

1つの曲に複数の案（案A・案B…）を作って、違う所を並べて見たり、聴き比べたりできます。

コード名はキーボードから打ち込めます（例：`Dm7`、`C/E` → Enter）。操作は Ctrl+Z で元に戻せます。スペースキーで再生・停止します。できたコード進行は、文字にしてコピーできます。

## 収録曲

どの曲も好きな調に移調できます。

- **入門（I・IV・V）**：きらきら星、歓喜の歌、ジングルベル、聖者の行進
- **初級（3拍子・アウフタクト）**：ハッピーバースデー、赤とんぼ、アメイジング・グレイス、きよしこの夜
- **中級（ブルース・短調・ジャズ）**：ブルース（練習用オリジナル）、世の人忘るな、Tea for Two

旋律は日本と米国の両方で著作権の保護期間が終わったものだけを収めています。「曲を入力」から自分の曲も追加できます（ブラウザに保存されます）。

## 著作権・ライセンス

ライセンスは `LICENSE`、同梱している他者の著作物（VexFlow・楽譜フォント・書体）と収録曲の権利の状態は `THIRD_PARTY_NOTICES.md` を参照してください。音はブラウザ内で合成しています。

## ファイル構成

ビルドは不要です。`index.html` をブラウザで開けば動きます。

- `index.html`：ページの骨組み
- `css/style.css`：見た目
- `js/songs.js`：収録曲のデータ
- `js/music.js`：音名・コードの種類・コード名の読み取り・移調
- `js/theory.js`：旋律とコードの関係の判定、調とコードの機能、コードの提案
- `js/state.js`：状態の保存、元に戻す・やり直す、枠の編集
- `js/score.js`：楽譜の描画
- `js/guide.js`：右側のパネル（入門コース・ガイド・候補・着地点から）
- `js/audio.js`：再生
- `js/app.js`：曲のメニュー、曲の入力、キー操作
- `vendor/`：VexFlow と、VexFlow・Bravura・Academico のライセンス文
- `LICENSE`、`THIRD_PARTY_NOTICES.md`：このアプリの著作権表示と、他者の著作物の一覧
- `test/`：理論部分とコースのお題のテスト（`node --test`）
- `tools/single-file.py`：1つの HTML にまとめる道具（VexFlow は CDN から読み込む形になります）
- `tools/smoke.py`：ブラウザで全曲・全ステップを開いて試す確認（Playwright が必要）
- `CLAUDE.md`：Claude で作業するときの手引き
- `STATUS.md`、`PLAN.md`、`docs/DESIGN.md`：現状、未完了の作業、設計の決定
- `docs/INVENTORY.md`：中身の一覧（道場シリーズの共通部品を検討するため）

## English

Reharm Dojo is a browser tool for practising chord choice over a melody, in jazz/pop chord symbols. *Harmonize* mode walks you through adding chords to a bare melody in six steps; *Reharm* mode helps you substitute the original chords in nine steps (sevenths and tensions, functional substitutes, slash-chord bass lines, line clichés, secondary dominants and II–Vs, tritone and diminished approaches, modal interchange). Melody notes are coloured by their role against the chosen chord, with the chord degree shown beneath. Every song can be transposed to any key. Notation is rendered with VexFlow.
