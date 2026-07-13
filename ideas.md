# アップロードセンター デザインアイデア

## コンセプト概要

PANTONE Pink C（#D62598）をイメージカラーとしたインソール注文データアップロードアプリのデザイン。
ウィザード形式の8ステップUIを、モバイルファーストで構築する。

---

<response>
<probability>0.07</probability>
<text>

## アイデア A: 「メディカル・ミニマリズム」

**Design Movement**: Japanese Medical Minimalism × Vivid Accent
**Core Principles**:
1. 白を基調とした清潔感のある空間設計
2. ピンクアクセントを機能的な誘導色として使用
3. 角丸を抑えたシャープなカード設計
4. ステップ進捗を視覚的に強調

**Color Philosophy**: 白（#FFFFFF）とライトグレー（#F8F8F8）の背景に、PANTONE Pink C（#D62598）を主要アクション・進捗インジケーターに使用。テキストはチャコール（#1A1A1A）で高コントラストを確保。

**Layout Paradigm**: 縦スクロール型モバイルUI。ヘッダーに固定プログレスバー、コンテンツエリアは左揃えのフォームレイアウト。

**Signature Elements**:
1. ピンクのグラデーションプログレスバー（細い、上部固定）
2. 角丸4pxのシャープなカードコンポーネント
3. ピンクのアンダーラインアクセント

**Interaction Philosophy**: タップ時のスケールダウン（0.97）、フォーカス時のピンクボーダー
**Animation**: 画面遷移は右→左スライド（200ms ease-out）
**Typography System**: Noto Sans JP（本文）+ 数字はTabular Nums

</text>
</response>

<response>
<probability>0.05</probability>
<text>

## アイデア B: 「ビビッド・フォーム」（採用）

**Design Movement**: Bold Functional Design × Vivid Pink Identity
**Core Principles**:
1. ピンクをブランドカラーとして全面的に活用
2. 大きなタイポグラフィで情報ヒエラルキーを明確化
3. ステップ番号を大きく表示し、進捗感を演出
4. フォームUIを直感的かつ温かみのあるデザインに

**Color Philosophy**: 背景は純白（#FFFFFF）、プライマリアクションはPANTONE Pink C（#D62598）、セカンダリはピンクの薄い版（#FCE4F4）。ダークテキスト（#1F1F1F）との組み合わせでコントラストを確保。

**Layout Paradigm**: モバイルファーストの縦型ウィザード。ヘッダーにロゴ＋ステップ表示、コンテンツエリアはカード型、フッターにナビゲーションボタン。

**Signature Elements**:
1. ピンクの太いプログレスバー（ステップ数/総ステップ数表示）
2. ピンクのアクセントラインが入ったセクションヘッダー
3. ピンクのアウトラインボタン（セカンダリ）とソリッドボタン（プライマリ）

**Interaction Philosophy**: ボタンホバーでピンクが濃くなる、フォーム入力時のピンクフォーカスリング
**Animation**: ページ遷移はフェードスライド（250ms）、ボタンプレスはscale(0.97)
**Typography System**: Noto Sans JP（全体）、ステップ番号はBold 24px、セクションタイトルはSemiBold 18px、本文はRegular 14px

</text>
</response>

<response>
<probability>0.04</probability>
<text>

## アイデア C: 「グラスモーフィズム・ピンク」

**Design Movement**: Glassmorphism × Pink Gradient
**Core Principles**:
1. 半透明のガラス効果でレイヤー感を演出
2. ピンクのグラデーション背景
3. ぼかし効果でデプスを表現
4. 白いカードがピンク背景に浮かぶ構造

**Color Philosophy**: ピンクのグラデーション背景（#D62598 → #FF6EC7）に白半透明カード（rgba(255,255,255,0.85)）を重ねる。

**Layout Paradigm**: 中央揃えのカードUI、背景にピンクグラデーション。

**Signature Elements**:
1. backdrop-blur効果のカード
2. ピンクのグロー効果
3. 白いアイコンとテキスト

**Interaction Philosophy**: ホバー時のカード浮き上がり効果
**Animation**: カードのfloatアニメーション
**Typography System**: Noto Sans JP + 白テキスト

</text>
</response>

---

## 採用デザイン: アイデア B「ビビッド・フォーム」

PANTONE Pink C（#D62598）をブランドカラーとして全面活用。
白背景に鮮やかなピンクのアクセントで、清潔感と活力を両立させる。
モバイルファーストのウィザードUIで、8ステップの入力フローを直感的に案内する。
