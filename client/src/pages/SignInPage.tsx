import React, { useState, useRef } from 'react';
import { Mail } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';
import { supabase } from '@/lib/supabase';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// SignInPage: メールアドレス入力 → OTPコード確認の2ステップ認証
// Supabase Email OTP による本人確認。
//
// 【重要 / 過去の失敗と対策 (2026-08-28)】
//   メールに含まれる「マジックリンク」をモバイルでタップする方式は使わない。理由:
//     (1) メールアプリ(Gmail/LINE等)のアプリ内ブラウザでリンクが開くと、
//         セッションはそのWebViewの隔離localStorageに保存され、ユーザーが普段使う
//         Safari/Chrome には決して共有されない → 本体ブラウザでは未ログインのまま。
//     (2) Gmail等がメール内URLを安全スキャンで先読みし、使い捨てトークンを
//         本人のタップ前に消費してしまう(otp_expired)。
//   → 対策: 常に「メール記載の確認コード」を本体ブラウザで直接入力させる。
//     verifyOtp({type:'email'}) は入力したブラウザにそのままセッションを張るため、
//     リダイレクト・URLハッシュ・アプリ内ブラウザを一切経由しない。
//   ※ Supabase 側の「Magic Link」メールテンプレートに {{ .Token }}(コード)を
//      表示させておくこと。テンプレートがリンクのみだとユーザーがコードを得られない。
//   ※ コード桁数は Supabase の Email OTP Length 設定に追従(既定6、最大10まで許容)。
// ============================================================

// 確認コードの許容桁数(Supabase Auth の Email OTP Length 設定に合わせる。既定=6)
const OTP_MIN_LEN = 4;
const OTP_MAX_LEN = 10;

export default function SignInPage() {
  const { setCurrentPage, setIsLoggedIn, setUserEmail } = useUpload();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(false);
  const layoutRef = useRef<AppLayoutHandle>(null);

  const handleSignIn = async () => {
    layoutRef.current?.scrollToTop();
    if (!email || !email.includes('@')) {
      setError('正しいメールアドレスを入力してください');
      setFieldError(true);
      return;
    }
    setError('');
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // OTP メールに含まれるリンクを踏んだ場合の戻り先。未指定だと Supabase 共通の
        // Site URL(別アプリ)に飛ぶため明示する。コード入力フローでは使われないが保険。
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (otpError) {
      // 実際の失敗理由を出す(例: "email rate limit exceeded" = Supabase Auth の送信上限)
      setError(`メール送信に失敗しました: ${otpError.message}`);
      return;
    }
    setUserEmail(email);
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    layoutRef.current?.scrollToTop();
    if (!otpCode || otpCode.length < OTP_MIN_LEN || otpCode.length > OTP_MAX_LEN) {
      setError('メールに記載された確認コードを入力してください');
      setFieldError(true);
      return;
    }
    setError('');
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });
    setLoading(false);
    if (verifyError) {
      // 実際の理由を出す(expired = 期限切れ / invalid = コード誤り など)
      setError(`確認できませんでした: ${verifyError.message}`);
      setFieldError(true);
      return;
    }
    setIsLoggedIn(true);
    setCurrentPage('home');
  };

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
            <Mail className="w-8 h-8" style={{ color: '#2563EB' }} />
          </div>
          {step === 'email' ? (
            <>
              <h2 className="text-lg font-bold text-gray-800">メールアドレスを入力</h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                ご注文に利用されたメールアドレスを入力してください
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-800">確認コードを入力</h2>
              <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
                {email} に届いたメールに記載の確認コードを、この画面に入力してください
                （メール内のリンクは使わないでください）
              </p>
            </>
          )}
        </div>

        {step === 'email' ? (
          /* Email入力ステップ */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">メールアドレス</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldError(false); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn(); }}
                  placeholder="例）taro-suzuki@example.com"
                  className="w-full h-12 pl-10 pr-4 rounded-xl border-2 text-sm bg-white focus:outline-none transition-all"
                  style={{ borderColor: fieldError ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldError ? ERROR_BG : 'white' }}
                  onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#2563EB')}
                  onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <PinkButton fullWidth size="lg" loading={loading} onClick={handleSignIn}>
              確認コードを送信
            </PinkButton>
            <div className="text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                入力したメールアドレスに確認コードが届きます。次の画面でそのコードを入力してください
              </p>
            </div>
          </div>
        ) : (
          /* OTPコード入力ステップ */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">確認コード（メール記載）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={OTP_MAX_LEN}
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setFieldError(false); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                placeholder="123456"
                className="w-full h-14 px-4 rounded-xl border-2 text-xl text-center font-mono tracking-widest bg-white focus:outline-none transition-all"
                style={{ borderColor: fieldError ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldError ? ERROR_BG : 'white' }}
                onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#2563EB')}
                onBlur={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#E5E7EB')}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <PinkButton fullWidth size="lg" loading={loading} onClick={handleVerifyOtp}>
              確認してサインイン
            </PinkButton>
            <button
              type="button"
              className="w-full text-xs text-gray-400 underline text-center py-1"
              onClick={() => { setStep('email'); setOtpCode(''); setError(''); setFieldError(false); }}
            >
              メールアドレスを変更する
            </button>
            <div className="text-center">
              <p className="text-xs text-gray-400 leading-relaxed">
                コードが届かない場合は、迷惑メールフォルダをご確認ください
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
