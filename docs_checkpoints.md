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

---

## 2026-09-04: HomePage ヘッダー刷新 + 注文一覧の見せ方調整(冨永社長指示)

- commit は次の push で確定。変更前 HEAD `54bf2b1`(相当)。本番 https://upload-center-murex.vercel.app
- **ヘッダー**: 縦積み・中央揃えに。ロゴ(中央) → 「アップロードセンター」(中央) → 行: [アカウント情報](ピンク枠ボタン・未登録なら小さいドット) + [サインアウト](小・灰)。従来は左に「ロゴ+アップロードセンター」、右に大きめサインアウト。
- **ロゴ画像**: 旧 `/manus-storage/oios_logo_1158292d.png`(Manus 期の死んだパス・?表示)を廃止。`client/public/oios-logo.svg`(仮 OIOS ロゴ・ピンクの円環+「OIOS」ワードマーク)を新設し `LOGO_URL='/oios-logo.svg'` に。**正式な OIOS 画像を同じパス(`.svg` か `.png`)に置けば差し替わる**(コード変更不要。png なら `LOGO_URL` の拡張子だけ変更)。CompletePage/Step3/Step6 も旧パス参照が残っている(別途)。
- **本文からアカウントバナー削除**(ヘッダーに移動)。
- **注文一覧の並びと強調**:
  - 「アップロードが必要な注文」を最上部・`tone="primary"`(ピンク枠2px + 薄ピンク背景 `#FFF0F9` + 一回り大きい + ピンクの丸+数字)。
  - 「アップロードを中断した注文」= 通常カード + ピンクの丸+数字(アップロードを促す対象)。
  - 「アップロードが完了した注文」= 目立たせない。アイコン灰・**ピンクの丸をやめ灰色の数字のみ**で件数表示。保証・サービス行も灰トーンに。
- **セクション名変更**: 「クイックアクション」→ **「その他のアップロード」**。
- ビルド OK。DB 変更なし。巻き戻し = 次コミットを revert。

## 2026-09-04: 注文一覧を3トーン配色に (commit `f7f5b0e`, 変更前 `c161e42`)

- アップロードが必要な注文 = ビビットピンク グラデ(#D62598→#a81b77)+ 半透明円の柄 + 白文字 + 枠 #F062B8
- 中断/完了/保証 = 薄いベージュ #FAF6EE(枠 #ECE3D3)
- その他のアップロード(決済完了IDでアップロード / ゲストアップロード)= 白のまま
- 意図: ピンク柄>ベージュ>白 の3段で視線を下へ流し、白の2ボタンを見つけやすく(「ゲスト/決済完了IDのアップロードがどこか分からない」の解消)
- ビルド OK。DB 変更なし。巻き戻し = revert f7f5b0e

## 2026-09-04: ヘッダーのロゴ画像を廃止 → 2段テキストに

- 冨永社長指示: このアップロードアプリは自社(スパイラルターン)だけでなく OEM 各社も共用するため、OIOS 等の特定ロゴを出すと発行元が分からなくなる。
- ヘッダーの `<img>`(仮 OIOS ロゴ)を削除。`client/public/oios-logo.svg` も削除。
- 代わりに「オーダーメイドインソール」/「アップロードセンター」の**2段テキスト**(中央揃え・同フォント・同サイズ text-base font-bold)。
- commit は次 push。ビルド OK。DB 変更なし。

## 2026-09-04: 「必要な注文」に中断を内包 + その他のアップロードのアイコン修正

- commit は次 push。冨永社長指示:
  - 「アップロードを中断した注文」はトップ画面から独立カードを廃止し、「アップロードが必要な注文」に内包。
    トップのピンクカードの数字 = 新規(needing)+ 中断(inProgress)の合計。
    ピンクカードをタップ → `OrderListPage` の needing モードが **2セクション**(新規/中断)を表示し選ばせる。
  - トップの並び: アップロードが必要な注文 → 完了した注文 → 保証・サービス → その他のアップロード(決済完了IDでアップロード / ゲストアップロード)。縦を短く。
  - その他のアップロード: 2ボタンを `flex flex-col`+`items-start` で高さ揃え。
    決済完了IDでアップロード = ピンク枠の中に「ID」の文字アイコン。
    ゲストアップロード = `UserRound`(人物)アイコン(旧 QrCode をやめる)。
- 未使用の `OrderCard` コンポーネント削除。ビルド OK。DB 変更なし。

## 2026-09-04: HomePage 微調整の連続(commits b3ba2b6 → 5f61b14)

- b3ba2b6: 完了アイコン Shield→漢字「完」/ その他アップロードに「?」ヘルプボタン / 補足文言(ID=「アップロードのお手伝い時に便利。」、ゲスト=「アップロード手段に悩んだらこれ。」)。カードを button→div(role=button)化。
- 92b756f: ヘルプ本文を冨永社長支給の確定文言に(各3段落・行間 leading-7・space-y-3.5・13px)。「?」タップ時のみ表示、X + 閉じるボタンの2箇所で閉じる。
- 7ef42ce: 見出し「注文一覧」→「通常アップロード」。一番下のピンク注意書き(※決済完了なら…)を削除。
- 01c3836: ヘルプ本文「決済した本人以外の方が」→「決済したご本人様以外の方が」。
- 5f61b14: 「その他のアップロード」セクションに pt-5 追加し、保証・サービスとの縦間隔を約2倍に。
- すべてビルド OK・DB 変更なし。Vercel が当日混雑で反映遅延。巻き戻しは各 commit revert。

## 2026-09-04: 注文に紐付かないアップロード(ゲスト等)を注文一覧に表示

- 症状: ゲストアップロードを完了しても「アップロードが完了した注文」に出ない。
- 原因: `fetchOrderDashboard` が `orders`(決済済み)起点で `uploads` を突合していたため、
  `order_id IS NULL` のアップロード(ゲスト / ホームから開始)がどのバケットにも入らなかった。
- 修正:
  - `lib/supabase.ts` `fetchOrderDashboard`: セクションB を追加。`uploads` を
    `user_id = 自分 AND order_id IS NULL` で取得し、status で completed / inProgress に振り分け。
    `DashboardOrder` に `orderId: string|null`(実注文ID)と `isGuest` を追加。
  - `fetchUploadById(uploadId)` を新設。`UploadFullRecord` に `guest_tf` 追加。
  - `UploadContext`: `editUploadId`(注文ではなく upload ID で EditUploadPage を開く)を追加。
  - `EditUploadPage`: `editUploadId` があれば `fetchUploadById` で直接ロード(なければ従来どおり注文IDから)。
    ヘッダー表記を「注文番号: X」/「ゲストアップロード」/「注文番号なし」に。
  - `OrderListPage`: `openEdit` は実注文なら `setOrderId`、注文なしなら `setEditUploadId(uploadId)`。
    `startNew`/`resume` は `o.orderId`(null 可)を渡すよう修正(旧: `o.id` を注文IDとして誤用)。
    カード表記に「ゲストアップロード」を追加。
- ビルド OK。DB 変更なし。

## 2026-09-04: テーマカラーをピンク→鮮やかなブルーに(OEM 共用のため)

- 冨永社長指示: このアップロードセンターは OEM 各社も使うため、当社ブランド色の PANTONE Pink C(#D62598)をやめ、中立で当たり障りのない鮮やかなブルーに全面変更。
- 置換(client/src 全 93ファイル + index.css を sed 一括):
  #D62598→#2563EB / #A81B77・#C01F88→#1D4ED8 / #FCE4F4→#DBEAFE / #FFF0F9→#EFF6FF /
  #F062B8→#60A5FA / #F0A0D0・#F0A8D8・#E8A0D4→#93C5FD / #E84DB5→#3B82F6 /
  Tailwind `-pink-`→`-blue-` / index.css の oklch hue 335→264(--primary/--ring/--chart 等)。
- **維持**: 完了した注文・保証サービスの薄いベージュ(#FAF6EE/#ECE3D3/#EFEAE0)、
  警告オレンジ(#E8890C 等)、成功グリーン(#F0FDF4 等)、グレー。
- **例外復元**: Step3 ルームシューズの色選択の `pink` スウォッチは実際のピンクに戻す(#DB4C97 / bg #FCE4F4)。テーマではなく商品の色名のため。
- token 名 `--color-pink-brand`・component 名 `PinkButton`・const `PINK` は据え置き(値はブルー、コメントで明記)。将来リネームは別タスク。
- ビルド OK。DB 変更なし。

## 2026-09-04: 注文一覧の各カードに日時を表示(冨永社長ルール化)

- ルール: アップロード関連の一覧・カードには日時を必ず出す。→ Bacon_Brain/20_技術・システム/顧客データ改訂ポリシー.md 2026-09-04追記。
- `fetchOrderDashboard`: `uploads.created_at`(開始)/ `uploads.updated_at`(中断・完了)を取得し
  `DashboardInProgress.{uploadStartedAt,interruptedAt}` / `DashboardCompleted.{uploadStartedAt,completedAt}` を追加。
- `OrderListPage`: `DateRows` コンポーネント + `fmtDT`(2026/09/04 15:30 形式)を新設。
  新規=注文日 / 中断=アップロード開始・中断日時 / 完了=アップロード開始・完了日時 を各カードに表示。
- ビルド OK。DB 変更なし。

## 2026-09-04: EditUploadPage — 写真動画プレビュー + 日本語ラベル + 保存ボタン3箇所 + 差し替えゲート

- 冨永社長指示:
  - アップロード済みの写真/動画が表示されていなかった → `getUploadFileUrl`(upsys の署名付きURL・http はそのまま)で解決し、`<img>`/`<video controls>` でプレビュー表示。
  - kind の英語表記をやめ日本語に: walk=歩きの動画 / oneleg=片足立ち動画 / swing=スイングの動画 / foot=足の写真 / shoes=靴の写真 ほか(`KIND_LABEL_JP`)。
  - 「差し替え」ボタンを各メディアのヘッダー右に配置。
  - 差し替え可否 = `canCustomerEditUpload` に `design_done` を追加(計測・動作分析・**設計**の開始前まで)。開始後は差し替えボタンを灰色の「差し替え不可(鍵)」にし「すでに作成が始まっています。データの差し替えはできません。」を表示。上部バナー文言も更新。
  - 「修正内容を保存する」ボタンを上・中央・下の3箇所に(`renderSave`)。
- ビルド OK。DB 変更なし。
  ⚠️ upsys バケットの storage SELECT ポリシー次第で署名付きURLが 403 になる可能性 → その場合はプレビューが出ないが差し替えは可能。要実機確認。

## 2026-09-04: 写真/動画の差し替えを実際に機能させた(migration 028-030 + EditUploadPage 改修)

- 症状: 「アップロードが完了した注文」→ 内容の確認・修正 で写真/動画の「差し替え」を押しても反映されない。
- 判明: `replace_upload_file` RPC(003 由来)が 003 以来一度も動いていなかった。旧の汎用 catch がエラーを隠していた。
  原因3つ: (1) 非 SECURITY DEFINER で顧客 RLS が関数内 DML に効き、uploads_files に UPDATE ポリシーが無く旧行退避が 0 行。
  (2) `WHERE kind = p_kind` が enum=text で `[42883]`。(3) INSERT の `p_file_type`/`p_kind` が enum 列に代入キャストされず `[42804]`。
- migration 028(SECDEF + 所有者/スタッフチェック + user_id を upload 行から継承)/ 029(`kind::text = p_kind`)/ 030(`::file_type` `::file_kind`)を Green に適用。実機で動画差し替え成功。
- クライアント側(commit 350d160 ほか): 差し替え失敗時に実 PostgREST エラーを表示、`uploadFileToStorage` の返り値を path に統一。
- EditUploadPage: メディアプレビュー(`getUploadFileUrl` で upsys 署名付きURL、`<img>`/`<video controls>`)、kind の日本語ラベル、差し替えボタンを各メディアヘッダーに、外周を濃い灰の枠、保存ボタン上中下3箇所、`canCustomerEditUpload` に design_done 追加。
- 上書きなしで旧データ保持: `uploads_files.is_current=false` + `upload_revisions` 追記(顧客データ改訂ポリシー通り)。
