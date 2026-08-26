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
