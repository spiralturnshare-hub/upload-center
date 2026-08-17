// ============================================================
// SPIRAL TURN - Make アップロード完了通知
//
// Make の `upload_completed` シナリオへ、アップロード完了を通知する。
// このシナリオは次の処理を担っている。
//   - 顧客および取扱店へのアップロード完了メール送信
//   - Slack 社内通知
//
// 送信先は環境変数 VITE_MAKE_UPLOAD_COMPLETED_WEBHOOK_URL で指定する。
// 未設定の場合は送信しない（Blue 稼働中の二重通知を防ぐための措置）。
//   Green: https://hook.eu1.make.com/38ajycmiheco14939dz4edlvcfqfpplf
//
// 設計方針：
//   取扱店向けメールは Make 側のフィルタで
//     type = "completed" かつ agency_flg = "true" かつ organization_email ≠ 空
//   を要求する。Green の upload_completed シナリオは Supabase 取得モジュールを
//   持たないため、これらは UI 側が注文から取得して送る。
//
// 通知の失敗はアップロード自体を失敗させない。Supabase への保存は
// 既に完了しているため、通知が届かなくてもデータ欠損は起きない。
// ============================================================

const WEBHOOK_URL: string =
  import.meta.env.VITE_MAKE_UPLOAD_COMPLETED_WEBHOOK_URL || '';

/** Make `upload_completed` シナリオへ渡すペイロード */
export interface UploadCompletedPayload {
  /** ディスパッチ用の固定値。Make 側のルータ条件と一致させる */
  target: 'upload';
  /** ディスパッチ用の固定値。Make 側のルータ条件と一致させる */
  type: 'completed';
  /** uploads テーブルの主キー */
  id: string;
  /** orders テーブルの主キー */
  order_id: string;
  /** 決済完了ID */
  order_name: string;
  /** 顧客の宛先メールアドレス */
  email: string;
  /** インソール使用者名 */
  name: string;
  /** インソール使用者名（カナ） */
  name_kana: string;
  /** 選択されたインソール種別（1〜2件） */
  insoles: string[];
  /** ゲストアップロードかどうか */
  guest: boolean;
  /** ログイン中の利用者ID。ゲストの場合は空文字 */
  upload_user_id: string;
  /**
   * 取扱店経由の注文かどうか。
   * Make のフィルタが text:equal で "true" と比較しているため、
   * 真偽値ではなく文字列で送る必要がある。
   */
  agency_flg: 'true' | 'false';
  /** 取扱店の連絡先メールアドレス。空文字の場合は取扱店向けメールは送信されない */
  organization_email: string;
  /** 取扱店（またはブランド）の会社名。メール本文に差し込まれる */
  company: string;
  /** Make 側がインソール種別として参照する（1件目） */
  item_1: string;
  /** Make 側がインソール種別として参照する（2件目）。無い場合は空文字 */
  item_2: string;
}

/** 送信先が設定されているかどうか */
export function isUploadCompletedNotifyEnabled(): boolean {
  return WEBHOOK_URL.length > 0;
}

/**
 * アップロード完了を Make へ通知する。
 *
 * 環境変数が未設定の場合は何もせず false を返す。
 * 送信に失敗した場合も例外を投げず false を返す。
 * 呼び出し側はこの戻り値で画面遷移を止めてはならない。
 */
export async function notifyUploadCompleted(
  payload: UploadCompletedPayload
): Promise<boolean> {
  if (!WEBHOOK_URL) return false;

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[makeNotify] upload_completed 通知が失敗しました: ${res.status}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[makeNotify] upload_completed 通知で例外が発生しました', err);
    return false;
  }
}
