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
// SignInPage: 「メール」または「電話番号」を選び、確認コードの2ステップで本人確認する。
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

// 電話番号ログインの表示スイッチ。
// Vercel 環境変数 VITE_PHONE_LOGIN_ENABLED='true' のときだけ「メール/電話」タブを出す。
// 目的: コードを本番 push しても、Twilio Verify + Cloudflare Turnstile(不正SMS送信対策)の
//       設定が完了するまで顧客に電話タブを見せない(見切り発車で SMS ポンピングの的にしない)。
// 設定が揃ったら Vercel でこの env を 'true' にして即日有効化する。
const PHONE_LOGIN_ENABLED = import.meta.env.VITE_PHONE_LOGIN_ENABLED === 'true';

type Method = 'email' | 'phone';
type Step = 'input' | 'otp';

export default function SignInPage() {
  const { setCurrentPage, setIsLoggedIn, setUserEmail } = useUpload();
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sentPhoneE164, setSentPhoneE164] = useState(''); // 送信時に確定した +81… を verify で使い回す
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

  const switchMethod = (m: Method) => {
    if (!PHONE_LOGIN_ENABLED) return; // フラグ OFF の間はメール固定
    if (m === method) return;
    setMethod(m);
    setStep('input');
    setOtpCode('');
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    resetMessages();
  };

  // ---- ステップ1: 確認コードを送信 ----
  const handleSend = async () => {
    layoutRef.current?.scrollToTop();
    resetMessages();

    if (turnstileEnabled && !captchaToken) {
      setError('「私はロボットではありません」の確認を完了してください');
      return;
    }
    const captchaOpt = captchaToken ? { captchaToken } : {};

    if (method === 'email') {
      if (!email || !email.includes('@')) {
        setError('正しいメールアドレスを入力してください');
        setFieldError(true);
        return;
      }
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
          ...captchaOpt,
        },
      });
      setLoading(false);
      if (otpError) {
        setError(`メール送信に失敗しました: ${otpError.message}`);
        setCaptchaKey((k) => k + 1);
        setCaptchaToken(null);
        return;
      }
      setUserEmail(email);
      setStep('otp');
      return;
    }

    // method === 'phone'
    const e164 = toE164JP(phone);
    if (!e164) {
      setError('携帯電話番号を正しく入力してください(例:090-1234-5678)');
      setFieldError(true);
      return;
    }
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: {
        shouldCreateUser: true,
        ...captchaOpt,
      },
    });
    setLoading(false);
    if (otpError) {
      setError(`SMS送信に失敗しました: ${otpError.message}`);
      setCaptchaKey((k) => k + 1);
      setCaptchaToken(null);
      return;
    }
    setSentPhoneE164(e164);
    setStep('otp');
  };

  // ---- ステップ2: 確認コードを検証 ----
  const handleVerifyOtp = async () => {
    layoutRef.current?.scrollToTop();
    resetMessages();
    if (!otpCode || otpCode.length < OTP_MIN_LEN || otpCode.length > OTP_MAX_LEN) {
      setError('届いた確認コードを入力してください');
      setFieldError(true);
      return;
    }
    setLoading(true);
    const { error: verifyError } =
      method === 'email'
        ? await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: sentPhoneE164, token: otpCode, type: 'sms' });
    setLoading(false);
    if (verifyError) {
      setError(`確認できませんでした: ${verifyError.message}`);
      setFieldError(true);
      return;
    }
    setIsLoggedIn(true);
    setCurrentPage('home');
  };

  const destinationLabel =
    method === 'email' ? email : sentPhoneE164 ? formatJPForDisplay(sentPhoneE164) : '';

  return (
    <AppLayout
      ref={layoutRef}
      title="サインイン"
      showBack
      onBack={() => setCurrentPage('home')}
    >
      <div className="space-y-6">
        {/* Icon header */}
        <div className="flex flex-col items-center py-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: '#DBEAFE' }}
          >
            {method === 'email' ? (
              <Mail className="w-8 h-8" style={{ color: '#2563EB' }} />
            ) : (
              <Phone className="w-8 h-8" style={{ color: '#2563EB' }} />
            )}
          </div>
          {step === 'input' ? (
            <>
              <h2 className="text-lg font-bold text-gray-800">
                {method === 'email' ? 'メールアドレスを入力' : '電話番号を入力'}
              </h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                {method === 'email'
                  ? 'ご登録のメールアドレスに確認コードをお送りします'
                  : '入力した携帯電話にSMSで確認コードをお送りします'}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-800">確認コードを入力</h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                {destinationLabel} に届いた確認コードを、この画面に入力してください
                {method === 'email' && '（メール内のリンクは使わないでください）'}
              </p>
            </>
          )}
        </div>

        {step === 'input' ? (
          <div className="space-y-4">
            {/* メール / 電話番号 切替タブ(VITE_PHONE_LOGIN_ENABLED='true' のときだけ表示)*/}
            {PHONE_LOGIN_ENABLED && (
              <div className="flex rounded-xl bg-gray-100 p-1">
                {(['email', 'phone'] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMethod(m)}
                    className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${
                      method === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    {m === 'email' ? 'メール' : '電話番号'}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {method === 'email' ? 'メールアドレス' : '携帯電話番号'}
              </label>
              <div className="relative">
                {method === 'email' ? (
                  <>
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        resetMessages();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                      placeholder="例）taro-suzuki@example.com"
                      className="w-full h-12 pl-10 pr-4 rounded-xl border-2 text-sm bg-white focus:outline-none transition-all"
                      style={{
                        borderColor: fieldError ? ERROR_BORDER : '#E5E7EB',
                        backgroundColor: fieldError ? ERROR_BG : 'white',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#2563EB')}
                      onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                    />
                  </>
                ) : (
                  <>
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        resetMessages();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                      placeholder="例）090-1234-5678"
                      className="w-full h-12 pl-10 pr-4 rounded-xl border-2 text-sm bg-white focus:outline-none transition-all"
                      style={{
                        borderColor: fieldError ? ERROR_BORDER : '#E5E7EB',
                        backgroundColor: fieldError ? ERROR_BG : 'white',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#2563EB')}
                      onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                    />
                  </>
                )}
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
                {method === 'email'
                  ? '入力したメールアドレスに確認コードが届きます。次の画面でそのコードを入力してください'
                  : '入力した携帯電話にSMSで確認コードが届きます。次の画面でそのコードを入力してください'}
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
                onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#2563EB')}
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
              onClick={() => {
                setStep('input');
                setOtpCode('');
                setCaptchaToken(null);
                setCaptchaKey((k) => k + 1);
                resetMessages();
              }}
            >
              {method === 'email' ? 'メールアドレスを変更する' : '電話番号を変更する'}
            </button>
            <div className="text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                {method === 'email'
                  ? 'コードが届かない場合は、迷惑メールフォルダをご確認ください'
                  : 'コードが届かない場合は、電話番号をご確認のうえもう一度お試しください'}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
