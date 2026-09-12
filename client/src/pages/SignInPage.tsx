import React, { useState, useRef } from 'react';
import { Mail, Phone } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { supabase } from '@/lib/supabase';
import { toE164JP, formatJPForDisplay } from '@/lib/phone';
import Turnstile, { turnstileEnabled } from '@/components/Turnstile';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// SignInPage: 入力欄は1つ。「メールアドレス または 携帯電話番号」を受け取り、
//   `@` を含めばメール、そうでなく日本の電話番号として解釈できれば SMS、と自動で振り分ける。
//   その後、確認コードの2ステップで本人確認する。
//
// 【なぜ入力欄1つか (2026-09-10 冨永社長)】
//   「メール/電話」をタブで選ばせると顧客の手間になる。Slack 等と同じく
//   「決済時のメールか電話番号をそのまま入れてもらう」方式にする。判別はシステム側で行う。
//
// 【メール方式 / 過去の失敗と対策 (2026-08-28)】
//   メールの「マジックリンク」をモバイルでタップする方式は使わない。
//     (1) メールアプリ(Gmail/LINE等)のアプリ内ブラウザで開くと、セッションがその WebView の
//         隔離 localStorage に入り、普段使う Safari/Chrome には共有されない → 本体は未ログインのまま。
//     (2) Gmail 等がメール内 URL を安全スキャンで先読みし、使い捨てトークンを消費する(otp_expired)。
//   → 対策: メール記載の「確認コード」を本体ブラウザで直接入力させ、verifyOtp({type:'email'}) で
//     入力したブラウザにそのままセッションを張る。
//   ※ Supabase の「Magic link or OTP」テンプレートに {{ .Token }}(コード)を表示させておくこと。
//
// 【電話番号方式 / 追加理由 (2026-09-09)】
//   日本の携帯キャリアメール(docomo/au/softbank)は SPF/DKIM が正しくても既定ブロックされることがあり、
//   メールが届かず顧客がログインできない。SMS はキャリアのメールフィルタを経由しないため確実に届く。
//   フロー: signInWithOtp({ phone }) → SMS で確認コード → verifyOtp({ phone, type:'sms' })。
//   名寄せ(電話ログインで作られる auth ユーザーを既存の顧客レコードに束ねる)は DB 側で処理する:
//     spiralturn-green-integration/supabase/migrations/034_users_phone_login.sql
//   ※ 公開アプリなので送信ボタンはボットに乱打されうる(SMSポンピング)。Cloudflare Turnstile の
//     トークンを添付し、Supabase Auth 側の Captcha protection(Turnstile)で無トークン要求を拒否する。
//
// 確認コードの許容桁数は Supabase の OTP Length 設定に追従(既定6、最大10)。
// ============================================================

const OTP_MIN_LEN = 4;
const OTP_MAX_LEN = 10;

// 電話番号ログインの有効スイッチ。
// Vercel 環境変数 VITE_PHONE_LOGIN_ENABLED='true' のときだけ、入力欄が電話番号も受け付ける。
// 目的: Twilio Verify + Cloudflare Turnstile(不正SMS送信対策)の設定が完了するまで、
//       本番の入力欄をメール専用にしておく(見切り発車で SMS ポンピングの的にしない)。
const PHONE_LOGIN_ENABLED = import.meta.env.VITE_PHONE_LOGIN_ENABLED === 'true';

type SentTarget = { kind: 'email'; value: string } | { kind: 'phone'; value: string }; // value: phone は E.164(+81…)
type Step = 'input' | 'otp';

/**
 * 入力文字列がメールか電話番号かを判定する。
 * - `@` を含む → メール(そのまま)
 * - フラグ ON かつ 日本の電話番号として正規化できる → 電話(E.164)
 * - どちらでもない → null(呼び出し側でエラー表示)
 */
function detectIdentifier(raw: string): SentTarget | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.includes('@')) return { kind: 'email', value: s };
  if (PHONE_LOGIN_ENABLED) {
    const e164 = toE164JP(s);
    if (e164) return { kind: 'phone', value: e164 };
  }
  return null;
}

export default function SignInPage() {
  const { setCurrentPage, setIsLoggedIn, setUserEmail } = useUpload();
  const [identifier, setIdentifier] = useState('');
  const [sentTarget, setSentTarget] = useState<SentTarget | null>(null); // 送信で確定した宛先。verify で使う
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0); // 送信のたびに Turnstile を再マウントして新しいチャレンジにする
  const layoutRef = useRef<AppLayoutHandle>(null);

  const resetMessages = () => {
    setError('');
    setFieldError(false);
  };

  const invalidInputMsg = PHONE_LOGIN_ENABLED
    ? 'メールアドレスまたは携帯電話番号を正しく入力してください'
    : '正しいメールアドレスを入力してください';

  // ---- ステップ1: 確認コードを送信 ----
  const handleSend = async () => {
    layoutRef.current?.scrollToTop();
    resetMessages();

    const target = detectIdentifier(identifier);
    if (!target) {
      setError(invalidInputMsg);
      setFieldError(true);
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError('「私はロボットではありません」の確認を完了してください');
      return;
    }
    const captchaOpt = captchaToken ? { captchaToken } : {};

    setLoading(true);
    const { error: otpError } =
      target.kind === 'email'
        ? await supabase.auth.signInWithOtp({
            email: target.value,
            options: { shouldCreateUser: true, emailRedirectTo: window.location.origin, ...captchaOpt },
          })
        : await supabase.auth.signInWithOtp({
            phone: target.value,
            options: { shouldCreateUser: true, ...captchaOpt },
          });
    setLoading(false);

    if (otpError) {
      const label = target.kind === 'email' ? 'メール送信に失敗しました' : 'SMS送信に失敗しました';
      setError(`${label}: ${otpError.message}`);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      return;
    }

    if (target.kind === 'email') setUserEmail(target.value);
    setSentTarget(target);
    setStep('otp');
  };

  // ---- ステップ2: 確認コードを検証 ----
  const handleVerifyOtp = async () => {
    layoutRef.current?.scrollToTop();
    resetMessages();
    if (!sentTarget) {
      setStep('input');
      return;
    }
    if (!otpCode || otpCode.length < OTP_MIN_LEN || otpCode.length > OTP_MAX_LEN) {
      setError('届いた確認コードを入力してください');
      setFieldError(true);
      return;
    }
    setLoading(true);
    const { error: verifyError } =
      sentTarget.kind === 'email'
        ? await supabase.auth.verifyOtp({ email: sentTarget.value, token: otpCode, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: sentTarget.value, token: otpCode, type: 'sms' });
    setLoading(false);
    if (verifyError) {
      setError(`確認できませんでした: ${verifyError.message}`);
      setFieldError(true);
      return;
    }
    setIsLoggedIn(true);
    setCurrentPage('home');
  };

  const backToInput = () => {
    setStep('input');
    setOtpCode('');
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    resetMessages();
  };

  const destinationLabel = !sentTarget
    ? ''
    : sentTarget.kind === 'email'
      ? sentTarget.value
      : formatJPForDisplay(sentTarget.value);

  const HeaderIcon = sentTarget?.kind === 'phone' ? Phone : Mail;

  return (
    <AppLayout ref={layoutRef} title="サインイン" showBack onBack={() => setCurrentPage('home')}>
      <div className="space-y-6">
        {/* Icon header */}
        <div className="flex flex-col items-center py-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: 'var(--primary-tint)' }}
          >
            <HeaderIcon className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          {step === 'input' ? (
            <>
              <h2 className="text-lg font-bold text-gray-800">
                {PHONE_LOGIN_ENABLED ? 'サインイン情報を入力' : 'メールアドレスを入力'}
              </h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                {PHONE_LOGIN_ENABLED
                  ? 'ご注文に利用されたメールアドレス、または携帯電話番号を入力してください'
                  : 'ご登録のメールアドレスに確認コードをお送りします'}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-800">確認コードを入力</h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                {destinationLabel} に届いた確認コードを、この画面に入力してください
                {sentTarget?.kind === 'email' && '（メール内のリンクは使わないでください）'}
              </p>
            </>
          )}
        </div>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {PHONE_LOGIN_ENABLED ? 'メールアドレス または 携帯電話番号' : 'メールアドレス'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  inputMode={PHONE_LOGIN_ENABLED ? 'email' : 'email'}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    resetMessages();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder={
                    PHONE_LOGIN_ENABLED ? '例）taro-suzuki@example.com / 090-1234-5678' : '例）taro-suzuki@example.com'
                  }
                  className="w-full h-12 pl-10 pr-4 rounded-xl border-2 text-sm bg-white focus:outline-none transition-all"
                  style={{
                    borderColor: fieldError ? ERROR_BORDER : '#E5E7EB',
                    backgroundColor: fieldError ? ERROR_BG : 'white',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : 'var(--primary)')}
                  onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                />
              </div>
            </div>

            {/* Turnstile(サイトキー未設定なら何も描画しない) */}
            <Turnstile key={captchaKey} onToken={setCaptchaToken} />

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <PinkButton fullWidth size="lg" loading={loading} onClick={handleSend}>
              確認コードを送信
            </PinkButton>
            <div className="text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                {PHONE_LOGIN_ENABLED
                  ? 'メールアドレスなら確認コードをメールで、携帯電話番号ならSMSでお送りします。次の画面でそのコードを入力してください'
                  : '入力したメールアドレスに確認コードが届きます。次の画面でそのコードを入力してください'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">確認コード</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={OTP_MAX_LEN}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ''));
                  resetMessages();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyOtp();
                }}
                placeholder="123456"
                className="w-full h-14 px-4 rounded-xl border-2 text-xl text-center font-mono tracking-widest bg-white focus:outline-none transition-all"
                style={{
                  borderColor: fieldError ? ERROR_BORDER : '#E5E7EB',
                  backgroundColor: fieldError ? ERROR_BG : 'white',
                }}
                onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <PinkButton fullWidth size="lg" loading={loading} onClick={handleVerifyOtp}>
              確認してサインイン
            </PinkButton>
            <button
              type="button"
              className="w-full text-xs text-gray-400 underline text-center py-1"
              onClick={backToInput}
            >
              入力し直す
            </button>
            <div className="text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                {sentTarget?.kind === 'phone'
                  ? 'コードが届かない場合は、電話番号をご確認のうえもう一度お試しください'
                  : 'コードが届かない場合は、迷惑メールフォルダをご確認ください'}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
