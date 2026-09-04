# デプロイ・チェックポイント記録(upload-center)

customer-mgmt-consoleと同じ運用。UIに変更を加える前に必ずこの記録の一番下に新しいチェックポイントを追記してから作業する。壊れた場合はここに書かれたコミット/URLに戻せる。

## 戻し方

```
git log --oneline          # コミット履歴確認
git reset --hard <コミットhash>   # 作業ツリーを指定コミットまで戻す(要事前確認・複数回許可)
git push --force-with-lease       # リモートも戻す(要事前確認・複数回許可)
```
または Vercelダッシュボード → Deployments → 戻したいデプロイの「...」→「Promote to Production」でコード変更なしに即座に切り戻し可能(こちらの方が安全・簡単)。

---

## チェックポイント一覧

### CP0 (2026-08-26 本日の開発着手前、かつVercel初回デプロイ前)
- コミット: `fa3ab46`
- Vercel: **本プロジェクトはこの時点まで一度もデプロイされていない**(環境変数は設定済み、コードのみ存在)。今回が実質的な初回本番デプロイとなる。
- 内容: 顧客によるアップロード済みデータの確認・修正機能(EditUploadPage、改訂履歴ポリシー対応)を追加する直前のベースライン。
- **戻し方の注意**: 初回デプロイのため「Promote to Production」で戻せる前バージョンが存在しない。問題が起きた場合は`git reset --hard fa3ab46 && git push --force-with-lease`でこのコミットまで戻し、Vercelに再デプロイさせること。

### CP1 (2026-08-26 顧客によるデータ確認・修正機能 追加、Vercel初回デプロイ)
- コミット: `03f784a`
- Vercel Production: https://upload-center-fsvky1dkb-spiral-turn.vercel.app
- 内容: EditUploadPage追加。決済完了ID照合後、既存アップロードがあれば「確認・修正する」導線へ。production_workflows(measure_done/analy_done)により作製開始後は編集不可に。

### CP2 (2026-08-27 Step2に「かんたん撮影アプリを起動」ボタンを追加)
- コミット: `0241b86`("feat: Step2に「かんたん撮影アプリを起動」ボタンを追加(foot-guidance連携)")
- Vercel Production: `upload-center-805bvfnhs`
- 内容(docs/17「アップロード完全音声化ビジョン」の第一歩・フェーズ2。foot-guidance CP1 と対):
  - `Step2PhotoPage.tsx` の「足の画像」欄に「かんたん撮影アプリを起動」ボタンを追加。押下で foot-guidance(`https://foot-guidance.vercel.app`)を新タブで開き、`from=upload-center` / `orderid` / `ordername` / `uploadid` / `userid` + ログイン中なら Supabase セッション(URLハッシュ)を渡す。
  - foot-guidance 側で撮影完了 → 画像は Green Storage `upsys` / `uploads_files`(kind=foot)へ入り、端末にもダウンロードされる。本画面へは `window.opener.postMessage` で通知が来る。
  - `message` リスナー(origin を `https://foot-guidance.vercel.app` で検証)で受信し、`footPhotosUploaded=true` にして「アップロード済み」表示へ。届かなかった場合の保険として、タブ復帰(focus/visibilitychange)時に `fetchCurrentUploadFiles(uploadId)` を再確認。
  - 手動アップロード(UploadZone)の導線はそのまま残す(「または手動で選択」)。
  - 3経路(通常 / ゲスト / パスコード)は全て Step2PhotoPage に合流するため、この1画面の変更で全経路に反映される。
- 対象は足の画像のみ(靴・動画・厚紙A4は将来。docs/12・17)。
- ビルド: `vite build` 成功。`tsc` の既存エラー(`Home.tsx` の `streamdown`)は未参照の孤立ファイル由来で本変更と無関係。
- 戻し方: Vercel Deployments で CP1(`upload-center-fsvky1dkb`)を Promote to Production。

### CP3 (2026-08-27 アップロード不能を解消:uploads 行の先行作成 + 顧客ID解決)
- コミット: `d2ee71e`("fix: アップロード不能を解消(uploads 行の先行作成 + 顧客ID解決 + enum/kind是正)")
- Vercel Production: `upload-center-jqkgvtuf5`(公開URL `https://upload-center-murex.vercel.app`)
- 症状: 動画/画像をアップロードすると必ず「失敗しました」。Step2 へ進めず foot-guidance 連携も試せない。Green で `uploads_files` = 0 行(`upsys` に孤児2件)。
- 原因(3層。詳細は spiralturn-green-integration/docs/18・20、migration 008 ヘッダ):
  1. `uploads_files.upload_id → uploads.id` は FK(CASCADE)だが、親 `uploads` 行を Step8 でしか作っていなかった → Step1〜7 の INSERT が全て FK 違反。
  2. `GuestUploadPage` / `PaymentIdUploadPage` が `initUploadSession()` を呼ばず `uploadId=''`(uuid 不正)。
  3. RLS: ログイン顧客が `uploads` に INSERT できるポリシーが無い / `public.users` 行が作られない(→ migration 008 で解消済み)。
  + `file_kind` enum に `sidejump`/`running`/`swing` が無く、靴の `kind` が `shoe_*`(enum に無い)。
- DB 側前提: **migration 008 適用済み**(2026-08-27。auth.users→public.users 同期トリガー、uploads/users own系ポリシー是正、orders_select_by_email、file_kind 拡張)。
- アプリ側修正(本コミット):
  - `lib/supabase.ts`: `fetchMyCustomerId()`(セッション→`public.users.id`)、`ensureUploadRow()`(開始時に `uploads` を draft で upsert。`user_id` は `public.users.id`)、`updateUpload()` を新設。`insertUploadFile` は `user_id: null` 固定(FK 対策)+ `insole_sku` 対応、`status` 既定は従来値維持。
  - `UploadContext`: `customerId`(public.users.id)を保持。`initUploadSession` を async 化し、uploadId 生成 + `ensureUploadRow` + 文脈反映。
  - `HomePage` / `GuestUploadPage` / `PaymentIdUploadPage`: `await initUploadSession({...})` に統一。PaymentId は注文の `insole1/2_kind` を `selectedInsoles` として渡す。失敗時はトースト表示。
  - `Step8ConfirmPage`: `insertUpload` → `updateUpload`(行は開始時に作成済み。`status='submitted'` と入力内容のみ更新。`id`/`user_id`/`order_name` は上書きしない)。
  - `Step2PhotoPage`: 靴の `kind` を `'shoes'` + `insole_sku=<insoleKind>` に。エラートーストに実メッセージ。
  - `Step1VideoPage`: 動画エラートーストに実メッセージ。
- ビルド: `vite build` 成功。`tsc` の既存エラー(`Home.tsx` の `streamdown`。App.tsx 未参照の孤立ファイル)は本修正と無関係。
- 戻し方: Vercel Deployments で CP2(`upload-center-805bvfnhs`)を Promote to Production。DB は migration 008 のロールバック SQL(ファイル末尾)。

### CP4 (2026-08-28 サインイン: マジックリンク依存をやめ「コード直接入力」に固定)
- 変更前コミット: `ecc0524`
- Vercel Production(変更前): `upload-center-jqkgvtuf5`(公開URL `https://upload-center-murex.vercel.app`)
- 症状: モバイルで upload-center にログインできない。メールのマジックリンクをタップしても未ログインのまま。
- 原因(実機スクショで確定。詳細は spiralturn-green-integration セッションログ 2026-08-28):
  1. **アプリ内ブラウザのストレージ分離**: メールアプリ(Gmail等)内でリンクを開くと、その WebView の隔離 localStorage にしかセッションが載らず、本体 Safari/Chrome には共有されない。
  2. **リンクの先読み消費**: Gmail 等がメール内 URL を安全スキャンし、使い捨てトークンを本人タップ前に消費(otp_expired)。
  3. Supabase の `email_otp` は 8桁だが、アプリは `length !== 6` / `maxLength={6}` 固定でコード入力不可。
- 修正(本コミット、`SignInPage.tsx` のみ):
  - 冒頭に「マジックリンクをモバイルで使わない理由と対策」を注釈。
  - コード桁数の固定 6 をやめ `OTP_MIN_LEN=4` / `OTP_MAX_LEN=10`(Supabase の Email OTP Length 設定に追従)。`maxLength` も追従。
  - OTP ステップの案内文を「メール記載のコードをこの画面に入力。リンクは使わない」に変更。
  - 検証失敗時に実エラー(`verifyError.message`)を表示。
- Supabase 側で別途必要な設定(冨永が実施):
  - Authentication → Emails → **Magic Link テンプレートに `{{ .Token }}`(コード)を表示**させる。
  - Authentication → Providers → Email → **Email OTP Length = 6**(アプリ表記と揃える)、OTP 有効期限 ≥ 600 秒。
- ビルド: `vite build` 成功。
- 戻し方: Vercel Deployments で `upload-center-jqkgvtuf5` を Promote to Production。

### CP5 (2026-08-28 ログイン後「アップロードの開始に失敗しました」を解消)
- 変更前コミット: `3c81cd9`
- 症状: サインイン成功後、ホームで「アップロードを開始」等を押すと
  「アップロードの開始に失敗しました。再ログインしてお試しください。」。
- 切り分け(service_role + ユーザーJWTで実機再現):
  - `public.users` に本人行あり・`auth_user_id` 正しく紐付け済み。
  - 本人JWTで `uploads` への upsert(user_id = 自分の public.users.id)は **HTTP 201 成功**。
  - → DB/RLS は正常。原因はクライアント側で `customerId` が null のまま
    `ensureUploadRow` に渡っていたこと(`UploadContext` のセッション監視 useEffect が
    `fetchMyCustomerId()` を解決し終える前に利用者がボタンをタップ = 競合)。
- 修正(本コミット):
  - `lib/supabase.ts` `fetchMyCustomerId()`: 堅牢化。getSession→getUser フォールバック、
    users 取得を 1 回リトライ。
  - `contexts/UploadContext.tsx` `initUploadSession()`: state の `customerId` に依存せず、
    null なら呼び出し時に `fetchMyCustomerId()` で解決し直してから `ensureUploadRow` に渡す。
- ビルド: `vite build` 成功。
- 戻し方: Vercel Deployments で `3c81cd9` のデプロイを Promote to Production。

### CP6 (2026-08-28 「アップロードの開始に失敗」の真因: order_id に空文字)
- 変更前コミット: `657889a`(診断ログ入り)
- 実エラー(診断ログで判明): `uploads作成失敗 [22P02] invalid input syntax for type uuid: "" (user_id=9f47f4f6-…)`
- 原因: `initUploadSession` の `orderId: opts?.orderId ?? orderId ?? null`。
  ホーム/ゲスト経路は orderId を渡さず Context state を使うが、その初期値が `''`。
  `??` は null/undefined しか変換しないため `''` が uuid 列 `uploads.order_id` に渡り 22P02。
  (CP5 で customerId 競合を疑ったが実際は別。診断ログ CP=657889a で確定)
- 修正(本コミット):
  - `UploadContext.initUploadSession`: `orderId:(opts?.orderId ?? orderId) || null` / orderName も同様。
  - `lib/supabase.ensureUploadRow`: `order_id: orderId || null` / `order_name: orderName || null`(二重防御)。
- ビルド: `vite build` 成功。
- 戻し方: Vercel Deployments で `657889a` のデプロイを Promote to Production。

- **疎通確認 (2026-08-28 13:05 JST)**: `tominaga@spiralturn.co.jp` で Safari からサインイン成功 →
  「アップロードを開始」→ STEP1 → STEP2 →「かんたん撮影アプリを起動」で foot-guidance 起動まで確認。
  STEP3〜STEP8 の通しは次セッションで実施予定。foot-guidance 起動後の挙動修正も次セッション。

---

## DB migration 010(RLS 硬化)適用 2026-08-28 — コード変更なし

`spiralturn-green-integration/supabase/migrations/010_rls_hardening.sql` を Green Supabase に適用(冨永社長が SQL Editor で実行・検証済み)。upload-center への影響:

- `uploads` の **anon INSERT ポリシー(`uploads_insert_anon`, `WITH CHECK true`)を削除**。ゲスト/決済経路とも、アップロード開始は **ログイン済み(authenticated)セッション**で `uploads_insert_own`(`user_id` を `users.auth_user_id = auth.uid()` で解決)を通ること。S2 でログイン必須化済みなので想定どおりのはずだが、`initUploadSession` / `ensureUploadRow` が匿名セッションで走っていないか実機で確認する。
- `uploads_files` の緩い INSERT/SELECT(`true` / anon)を全削除し、`uploads_files_insert_own` / `uploads_files_select_own`(いずれも `upload_id → uploads.user_id → users.auth_user_id = auth.uid()`)を新設。顧客はこの経路で自分のファイルのみ読み書き可。
- Storage `upsys`: anon INSERT を全廃。認証アップロードは `allow authenticated upload to upsys` が残る。バケットに 200MB 上限。
- 実機確認(未): サインイン → アップロード開始 → STEP2 でファイル添付 → 反映。壊れたら 010 末尾のロールバック SQL。

---

## 2026-09-04: Legacy anon JWT → 新 publishable キー(docs/35 WS-B / docs/36)

- 変更前 HEAD: `0cafa38` / Vercel Production: https://upload-center-murex.vercel.app
- `client/src/lib/supabase.ts`: ハードコード fallback(旧 anon JWT)撤去 → env 必須(未設定なら throw)
- Vercel env `VITE_SUPABASE_ANON_KEY` を `sb_publishable_...` に差し替え済み(Production ほか)
- 巻き戻し: この commit を revert + Vercel env を旧 anon JWT に戻す

---

## 2026-09-04: STEP1/STEP2 の (1) 保存パス不整合バグ修正 (2) 「次へ」ブロック時の具体的な案内

- 変更前 HEAD: `4a2868e` / Vercel Production: https://upload-center-murex.vercel.app
- 対象: `client/src/pages/Step1VideoPage.tsx` / `client/src/pages/Step2PhotoPage.tsx`。他ファイル・Green スキーマ変更なし。ビルド OK(`vite build` 成功。`tsc` の `Home.tsx` streamdown エラーは既存・無関係)

### (1) 保存パス不整合の修正(実害バグ)
- `uploadFileToStorage` は Storage に `{fileId}.{ext}` という名前で保存し、実パスを `path` で返す。
- ところが Step1/Step2 は返り値を使わず、`uploads_files.url` を **元ファイル名**(`file.name`、例 `IMG_6836.mov`)で手組みしていた → DB の `url` と Storage の実体名が食い違い。
- 実測(2026-09-04 冨永社長のテストデータ): `uploads_files.url` = `…/{fileId}/IMG_6836.mov` / `storage.objects.name` = `…/{fileId}/{fileId}.mov`。
- 後工程(計測・動作分析・動画確認)が `uploads_files.url` で Storage を引くと 404 になる。
- 修正: 3箇所(Step1 動画 / Step2 足写真 / Step2 靴写真)を `const { path } = await uploadFileToStorage(...)` にして `url: path` を保存。フォーマット(相対パス)は現状維持、ファイル名だけ実体と一致させる = 影響最小。
- ⚠️ 既存の食い違い行(冨永社長のテスト分・`upload_id` `150ab754…` `d4685bda…` `fd739cc0…`)は手修正が必要(`uploads_files.url` の末尾を実 `storage.objects.name` に合わせる UPDATE)。テストデータのみなので次の rollback 対象と一緒に消してもよい。
- ※ `EditUploadPage.tsx` は元から返り値の `url`(getPublicUrl のフル URL)を使っている = Step1/2 と形式が違う(相対パス vs フル URL)。この不整合は既存。downstream がどちらを期待するか要確認(別タスク)。

### (2) 「次へ」が進まないときの案内(冨永社長指摘・2026-09-04)
- 旧: `!canProceed` で `toast.error('全ての動画をアップロードしてください')` のみ。何が足りないか不明・トーストは3秒で消える → 顧客がストレスで離脱。
- 新(Step1VideoPage):
  - 「次へ」を押して進めなかったら、カード群の上に**消えない警告ボックス**(琥珀色)を表示。「あと N 本」+ **不足している動画の名称リスト**(`VIDEO_KIND_LABELS[k].title`)+ 「下の該当カードでファイルを選ぶと開始します」。
  - 不足している必須カードは**枠を琥珀色で強調** + アイコンを警告に + 「この動画が未アップロードです」。
  - 状況別トースト: インソール種別未選択 / アップロード中(完了待ち) / 未アップロード(名称列挙)。
  - `triedNext` state で「一度押した後」だけ強調(初回表示から赤くしない)。全部揃えば警告は自動で消える。
- 巻き戻し: この commit を revert(DB 変更なしなので revert だけで戻る)

### (3) 「次へ」案内の横展開 STEP2〜STEP7(2026-09-04 冨永社長「横展開して」)
- 新規 `client/src/components/IncompleteNotice.tsx` = 共通バナー(琥珀色・消えない・不足項目を箇条書き)。
- 適用:
  - **Step2(写真)**: 不足を「足の写真」「靴の写真（<インソール名>）」で列挙。インソール未選択時の案内も。
  - **Step3(靴情報)**: 「靴のブランド（<名>）」「靴の表記サイズ（<名>）」「靴のフィット感（<名>）」「ルームシューズの色」を列挙。既存の赤字インライン表示は維持。入力開始でバナーは一旦消える。
  - **Step4(痛み)**: 単一項目だが一貫性のためバナー表示(「痛み・違和感の有無」)。
  - **Step5(目的)**: 「作製目的・重視する項目の選択」「プレイスタイルの選択」を列挙。
  - **Step7(配送先)**: 「インソール利用者のお名前/フリガナ」「配送先のお名前/電話番号/郵便番号」を列挙。フリガナ形式エラーも文言分岐。
  - いずれもトーストのメッセージも `未入力の項目があります:〇〇・〇〇` と具体名入りに変更。
- **対象外**: Step1 は既に個別実装済み(見た目は共通バナーと同一)。Step6(タコ)は必須項目なしでブロックなし。Step8 は「送信」で別処理。
- ビルド OK(`tsc` は既存の Home.tsx/streamdown エラーのみ、`vite build` 成功)。
- 巻き戻し: この commit を revert(DB 変更なし)

---

## 2026-09-04: アカウント情報のDB永続化 + 注文一覧(必要/中断/完了)をGreenに接続

- commit `ec7178b`(変更前 HEAD `c4319ac`)/ 本番 https://upload-center-murex.vercel.app / 新バンドル `index-IM71GEpx.js`(Ready 検証済)
- 変更: `lib/supabase.ts` / `contexts/UploadContext.tsx` / `pages/{AccountProfilePage,HomePage,Step1VideoPage,Step2PhotoPage}.tsx` / **新規** `pages/OrderListPage.tsx` / `App.tsx`。**DB スキーマ変更なし**(`public.users`/`orders`/`uploads` 既存カラムのみ)。

### アカウント情報
- 従来 `AccountProfilePage` は `setAccountProfile(form)` = React state のみ → リロード/再サインインで消失(冨永社長指摘)。
- `fetchMyProfile()`/`saveMyProfile()` を追加し `public.users`(氏名/カナ/電話/住所各列)に read/update。RLS `users_select_own`/`users_update_own`(migration 008)経由。
- `UploadContext` の auth 監視で `isLoggedIn`/`userEmail` をセッションから復元(従来はリロードでログアウト表示になっていた)+ サインイン時に `reloadAccountProfile()`。
- ⚠️ 氏名マッピング注意: AccountProfile `firstName`=姓 ↔ `users.last_name` / `lastName`=名 ↔ `users.first_name`(このアプリ独自命名。`profileToRow`/`rowToProfile` にコメント)。

### 注文一覧(決済↔アップロード連動の UI 配線)
- `fetchOrderDashboard()` = `orders`(`customer_email` = セッションメール、`status IN ('confirmed','processing','completed')`)を `uploads.status` で3分類:
  - needing = 完了アップロード無し / in-progress = `uploads.status='draft'` 行あり / completed = `submitted`|`done`。
- `HomePage` の4カードをハードコード(`count={2}`/`onClick={()=>{}}`)から実件数 + `OrderListPage` 遷移へ。「代理アップロードが必要な注文」カードは仕様外につき削除。
- `OrderListPage`(新規): モード別リスト。needing →「(insole1・insole2)のアップロードが必要です」+ `initUploadSession` でウィザード / in-progress →「続きから再開」/ completed →「内容の確認・修正」= 既存 `EditUploadPage`(改訂履歴 RPC `update_upload_with_history`/`replace_upload_file`・工程開始後ロック)。

### 途中から再開
- `UploadContext.resumeUploadSession(uploadId)` = `uploads` の JSON 各列 + `uploads_files(is_current)` を `UploadData` へ復元、既存 `uploadId` で `step1` へ。
- `Step1VideoPage`/`Step2PhotoPage` = 再開時 context のアップロード済みフラグから表示状態を `'success'` 初期化(カードが「済み」表示になる)。

### 未検証(冨永社長の実機テスト待ち・2026-09-04 時点)
- `orders` RLS の email 層で顧客が自分の注文を SELECT できるか(できないと注文一覧が全て0件)。
- `saveMyProfile` の `users` UPDATE が RLS で通るか。
- 再開時の Step3〜7(靴情報/痛み/目的/配送先)への JSON 復元の見え方。
- テスト用に E2E モック注文3件を冨永社長のサインインメールに紐付け済み(`ST-E2E-0001`=完了 / `EM-E2E-0001`=中断 / `NEEDS-E2E-0001`=必要)。`e2e_mock_customer_rollback.sql` で撤去可。
- 巻き戻し: この commit を revert(DB スキーマ変更なし。テスト注文は上記 rollback)

---

## 2026-09-04: HomePage 整理(ヒーローバナー/インソール種別選択を削除・決済起点に統一)

- commit `54bf2b1`(変更前 HEAD `ec7178b`)/ 本番 https://upload-center-murex.vercel.app
- 冨永社長指示: トップの「データアップロード」ピンクヒーローバナー(+「アップロードを開始」ボタン)と「インソール種別の選択」パネルを HomePage から削除。
  - 理由: このシステムはアップロード = 決済に紐付いた注文が前提。決済に紐付かないアップロードは「ゲストアップロード」に集約。
  - インソール種別選択の UI(`InsoleSelector`)は既に `GuestUploadPage` の `insole-select` ステップに実装済み(移設は不要、HomePage から消すだけ)。
- 新しいトップの並び: アカウント → アップロードが必要な注文 → 中断した注文 → 完了した注文 → クイックアクション(決済完了IDでアップロード / ゲストアップロード) → 注意書き。
- ログインしていない場合は「注文一覧」セクション非表示 → アカウント(サインイン誘導) → クイックアクション → 注意書き。
- 未使用化した import/handler/state を除去(`InsoleSelector`/`PreShootingDialog`/`handleStartUpload`/`handlePreShootingConfirm`/`handleConfirmInsoleAndStart`/`handleInsoleChange`/`showInsoleSelector`/`showPreShootingDialog`)。
- ビルド OK。DB 変更なし。巻き戻し = revert `54bf2b1`。
