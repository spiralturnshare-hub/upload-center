// ============================================================
// 電話番号の正規化(日本前提)
// ============================================================
// 何をする / なぜ必要か:
//   ログイン画面で利用者が入力する電話番号(「090-1234-5678」「09012345678」
//   「+81 90 1234 5678」等の揺れ)を、Supabase Auth が要求する E.164 形式
//   (先頭 + 付き。例: +819012345678)に統一する。
//   Supabase 側は保存時に先頭 + を除いた digits(819012345678)で持つため、
//   DB 側の名寄せ(migration 034 の normalize_jp_phone)と桁を合わせておく。
//
// どこと繋がるか:
//   - SignInPage.tsx が signInWithOtp({ phone }) / verifyOtp({ phone, type:'sms' }) に渡す前に通す。
//   - DB 側の対応: spiralturn-green-integration/supabase/migrations/034_users_phone_login.sql
//     の public.normalize_jp_phone(text)。ロジックを一致させること(片方だけ直さない)。
//
// なぜこう作ったか:
//   国際化は現状不要(顧客は国内)。海外番号対応が必要になったら libphonenumber-js の
//   導入を検討する(バンドルサイズ増と引き換え)。今は依存を増やさず正規表現で処理する。
// ============================================================

/**
 * 入力文字列を日本の E.164(+81…)に正規化する。
 * 妥当な携帯/固定番号に見えなければ null を返す(呼び出し側でエラー表示)。
 */
export function toE164JP(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const compact = raw.replace(/[\s()-]/g, '');
  const hasPlus81 = /^\+81/.test(compact);

  let digits = compact.replace(/\D/g, '');

  if (hasPlus81) {
    digits = digits.replace(/^81/, ''); // +8190… → 90…
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1); // 09012345678 → 9012345678
  } else if (digits.startsWith('81') && digits.length >= 11) {
    digits = digits.slice(2); // 819012345678 → 9012345678
  }

  // 国内の「市外局番0を除いた番号」= 先頭は1-9、残り8〜9桁(合計9〜10桁)
  if (!/^[1-9]\d{8,9}$/.test(digits)) return null;

  return '+81' + digits;
}

/** 入力が日本の電話番号として正規化できるか(ボタンの活性判定などに使う) */
export function isLikelyJPPhone(input: string): boolean {
  return toE164JP(input) !== null;
}

/** E.164(+819012345678)を表示用(090-1234-5678)に戻す。携帯番号のみ整形、それ以外はそのまま返す。 */
export function formatJPForDisplay(e164: string): string {
  const m = /^\+81(\d{9,10})$/.exec(e164);
  if (!m) return e164;
  const national = '0' + m[1];
  if (national.length === 11) {
    return `${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
  }
  return national;
}
