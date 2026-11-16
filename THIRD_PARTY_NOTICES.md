# 同梱・利用している他者の著作物

リハモ道場は、次のソフトウェアとフォントを使っています。それぞれの著作権は各権利者にあり、
各ライセンスに従って利用しています。これらは LICENSE の「All rights reserved」の対象外です。

## 同梱しているもの（`vendor/`）

| 名前 | 用途 | 権利者 | ライセンス | ライセンス文 |
|---|---|---|---|---|
| VexFlow 5.0.0 | 楽譜の描画 | VexFlow contributors、Mohit Muthanna Cheppudira | MIT License | `vendor/VEXFLOW-LICENSE` |
| Bravura 1.392 | 楽譜の記号のフォント（VexFlow の `vexflow-bravura.js` に埋め込み） | Steinberg Media Technologies GmbH | SIL Open Font License 1.1 | `vendor/BRAVURA-LICENSE.txt` |
| Academico 0.902 | 楽譜の文字のフォント（同上） | Steinberg Media Technologies GmbH | SIL Open Font License 1.1 | `vendor/ACADEMICO-LICENSE.txt` |

- フォントのライセンス文は、VexFlow のフォント集（https://github.com/vexflow/vexflow-fonts ）に含まれるものです。
- SIL Open Font License では、フォントをソフトウェアに同梱して配布・販売できます。フォントだけを単体で売ることはできません。
  また、改変したフォントに "Bravura"・"Academico" の名前を使うことはできません。

## 外部から読み込んでいるもの（同梱していない）

| 名前 | 用途 | 提供元 | ライセンス |
|---|---|---|---|
| Zen Kaku Gothic New | 本文のフォント | Google Fonts | SIL Open Font License 1.1 |
| Barlow Condensed | コード名のフォント | Google Fonts | SIL Open Font License 1.1 |

アプリとしてフォントを同梱して配布するときは、これらのライセンス文も `vendor/` に加えること。

## 1つの HTML にまとめた版

`tools/single-file.py` で作る版は、VexFlow を jsDelivr（CDN）から読み込み、フォントを同梱しません。
