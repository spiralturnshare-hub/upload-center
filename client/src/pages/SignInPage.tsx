import React, { useState, useRef } from 'react';
import { Mail } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import AppLayout from '@/components/AppLayout';
import type { AppLayoutHandle } from '@/components/AppLayout';
import PinkButton from '@/components/PinkButton';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ============================================================
// Design: ビビッド・フォーム
// SignInPage: メールアドレス入力のみのサインイン画面
// ※ 開発中: OTP認証は省略。本番環境移行前にOTP認証を有効化すること。
// ============================================================

export default function SignInPage() {
  const { setCurrentPage, setIsLoggedIn, setUserEmail } = useUpload();
  const [email, setEmail] = useState('');
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
    // ※ 開発中: OTP認証省略。本番環境移行前に要対応。
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    setUserEmail(email);
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
          <h2 className="text-lg font-bold text-gray-800">メールアドレスを入力</h2>
          <p className="text-xs text-gray-400 text-center mt-1 leading-relaxed">
            ご注文に利用されたメールアドレスを入力してください
          </p>
        </div>

        {/* Email input */}
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

          <PinkButton
            fullWidth
            size="lg"
            loading={loading}
            onClick={handleSignIn}
          >
            サインイン
          </PinkButton>

          <div className="text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              ※ ゲストアップロードの場合は、任意のメールアドレスでサインインしてください
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
