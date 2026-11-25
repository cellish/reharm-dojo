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

## 収録曲の権利の状態

旋律だけを収めています（歌詞は収めていません）。いずれも日本と米国の両方で著作権の保護期間が終わったもの、または作者自身の作品です。

| 曲 | 作者 | 状態 |
|---|---|---|
| きらきら星 | フランス民謡 | 公有 |
| 歓喜の歌 | L. v. ベートーヴェン（1827年没） | 公有 |
| ジングルベル | J. ピアポント（1893年没） | 公有 |
| 聖者の行進 | 黒人霊歌 | 公有 |
| ハッピーバースデー | P. & M. ヒル（"Good Morning to All"、1893年） | 公有（米国では2016年の和解で確定） |
| 赤とんぼ | 山田耕筰（1965年没） | 公有（日本は2015年末で満了。米国は1927年の出版から95年で満了） |
| アメイジング・グレイス | 伝承曲 "New Britain" | 公有 |
| きよしこの夜 | F. X. グルーバー（1863年没） | 公有 |
| 世の人忘るな | イングランド民謡 | 公有 |
| Tea for Two | V. ユーマンス（1946年没） | 旋律は公有（日本は戦時加算を含めても2007年ごろに満了。米国は1924年の出版で2020年に満了）。作詞（I. シーザー、1996年没）は日本でまだ保護されているので、歌詞は収めない |
| ブルース | 練習用のオリジナル | 著作権者 jun |
