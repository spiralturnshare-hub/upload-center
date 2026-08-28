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
// Supabase Email OTP（6桁コード）による本人確認
// ============================================================

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
    if (!otpCode || otpCode.length !== 6) {
      setError('6桁の確認コードを入力してください');
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
      setError('確認コードが正しくありません。再度お試しください。');
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
            style={{ backgroundColor: '#FCE4F4' }}
          >
            <Mail className="w-8 h-8" style={{ color: '#D62598' }} />
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
                {email} に送信された6桁のコードを入力してください
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
                  onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#D62598')}
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
                入力したメールアドレスに6桁の確認コードが送信されます
              </p>
            </div>
          </div>
        ) : (
          /* OTPコード入力ステップ */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">確認コード（6桁）</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setFieldError(false); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                placeholder="123456"
                className="w-full h-14 px-4 rounded-xl border-2 text-xl text-center font-mono tracking-widest bg-white focus:outline-none transition-all"
                style={{ borderColor: fieldError ? ERROR_BORDER : '#E5E7EB', backgroundColor: fieldError ? ERROR_BG : 'white' }}
                onFocus={(e) => (e.target.style.borderColor = fieldError ? ERROR_BORDER : '#D62598')}
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
