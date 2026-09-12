import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { ChevronLeft, User } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import { useBrand } from '@/contexts/BrandContext';
import { INSOLE_DISPLAY_NAMES } from '@/lib/insoleConfig';

export interface AppLayoutHandle {
  scrollToTop: () => void;
}

// ============================================================
// Design: ビビッド・フォーム
// AppLayout: モバイルファーストのウィザードレイアウト
// Primary: テナントのブランドカラー(既定 #2563EB。dealer-mgmt-console の brand_color で上書き・docs/38)
//
// 顧客情報バー: ステップ画面の上部に顧客氏名＋インソール種別を常時表示
// 代行スタッフが「誰の・何のインソール」かを常に把握できるようにする
// ============================================================

interface AppLayoutProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  currentStep?: number;
  totalSteps?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
}

const AppLayout = forwardRef<AppLayoutHandle, AppLayoutProps>(function AppLayout({
  title,
  showBack = false,
  onBack,
  currentStep,
  totalSteps = 8,
  children,
  footer,
  headerRight,
}: AppLayoutProps, ref) {
  const mainRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (mainRef.current) mainRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    },
  }));

  const progress = currentStep ? (currentStep / totalSteps) * 100 : 0;
  const { uploadData, currentPage } = useUpload();
  const { customerInfo, selectedInsoles } = uploadData;
  // OEM テナントのロゴ(docs/38)。brand が無い(自社/解決前)なら常に null = 見た目は現状のまま。
  const { brand } = useBrand();
  const showHeaderLogo = brand?.companyLogo && (brand.logoPosition === 'header' || brand.logoPosition === 'both');
  const showFooterLogo = brand?.companyLogo && (brand.logoPosition === 'footer' || brand.logoPosition === 'both');

  // ページ（currentPage）が切り替わるたびにmain要素を最上部にスクロール
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [currentPage]);

  // 顧客氏名（未入力の場合はプレースホルダー）
  const customerName = customerInfo.userName.trim();
  // インソール種別の表示テキスト
  const insoleLabel = selectedInsoles.length > 0
    ? selectedInsoles.map(k => INSOLE_DISPLAY_NAMES[k]).join('・')
    : '種別未選択';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center h-14 px-4">
          {showBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="戻る"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {showHeaderLogo && (
            <img
              src={brand!.companyLogo!}
              alt={brand?.companyName ?? 'ブランドロゴ'}
              className="h-7 max-w-[120px] object-contain shrink-0"
            />
          )}
          {title && (
            <h1 className="flex-1 text-center text-base font-semibold text-gray-800 truncate px-2">
              {title}
            </h1>
          )}
          {headerRight && (
            <div className="ml-auto">{headerRight}</div>
          )}
          {!title && !headerRight && <div className="flex-1" />}
        </div>

        {/* Progress bar */}
        {currentStep !== undefined && (
          <div className="relative h-1 bg-gray-100">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
              }}
            />
          </div>
        )}
      </header>

      {/* ★ 顧客情報バー（全ステップで常時表示） */}
      {currentStep !== undefined && (
        <div
          className="sticky top-[57px] z-10 px-4 py-2 flex items-center gap-2 border-b"
          style={{ backgroundColor: 'var(--primary-tint)', borderColor: 'var(--primary-soft)' }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {customerName ? (
              <p className="text-xs font-bold truncate" style={{ color: '#8b1560' }}>
                <span className="font-extrabold">{customerName}</span>
                <span className="font-normal"> 様　</span>
                <span className="font-medium">{insoleLabel}</span>
              </p>
            ) : (
              <p className="text-xs truncate" style={{ color: '#8b1560' }}>
                <span className="opacity-60">（お客様名はSTEP 7で入力）　</span>
                <span className="font-medium">{insoleLabel}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step indicator */}
      {currentStep !== undefined && (
        <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400">
            STEP {currentStep} / {totalSteps}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor:
                    i + 1 <= currentStep
                      ? 'var(--primary)'
                      : '#E5E7EB',
                  opacity: i + 1 <= currentStep ? 1 : 0.4,
                  transform: i + 1 === currentStep ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main ref={mainRef} data-scroll-container className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 pb-32">
          {children}
          {/* OEM ブランドフッター(logo_position=footer/both のときのみ)。
              固定フッターではなくコンテンツ末尾に表示する軽量版(docs/38 の今回スコープ) */}
          {showFooterLogo && (
            <div className="flex justify-center pt-6">
              <img
                src={brand!.companyLogo!}
                alt={brand?.companyName ?? 'ブランドロゴ'}
                className="h-8 max-w-[160px] object-contain opacity-90"
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      {footer && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-4 py-3 shadow-lg z-20">
          {footer}
        </div>
      )}
    </div>
  );
});

export default AppLayout;
