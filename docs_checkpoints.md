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
