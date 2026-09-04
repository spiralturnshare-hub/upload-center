import React, { useState, useEffect } from 'react';
import { Upload, PauseCircle, Shield, LogOut, User, ChevronRight, QrCode } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import type { OrderListMode } from '@/contexts/UploadContext';
import { fetchOrderDashboard, supabase } from '@/lib/supabase';

// ============================================================
// Design: ビビッド・フォーム
// HomePage: アップロードセンター ホーム画面
// Primary: PANTONE Pink C (#D62598)
//
// 2026-09-04 冨永社長指示で整理:
//   ヘッダー = ロゴ(中央) / 「アップロードセンター」(中央) / アカウント情報 + サインアウト(小)
//   本文 = 注文一覧(アップロードが必要な注文を最上部・目立たせる / 中断・完了は従属)
//          → その他のアップロード(決済完了IDでアップロード / ゲストアップロード)
//          → お知らせ
//   ・ピンクの丸+数字は「アップロードを促す」= 必要 / 中断 のみ。
//     完了は目立たせず、灰色の数字で件数だけ分かるようにする。
//   ・アカウントはヘッダーに移動(本文の大きなバナーは廃止)。
// ============================================================

// ヘッダーはロゴ画像を出さない。このアップロードアプリは自社(スパイラルターン)だけでなく
// OEM 各社も同じものを使うため、特定ロゴを出すと発行元が分からなくなる。
// 代わりに「オーダーメイドインソール / アップロードセンター」の2段テキスト(同じフォント・同じサイズ)。

const PINK = '#D62598';
const PINK_DARK = '#a81b77';
const PINK_BG = '#FCE4F4';
// 中間トーン: 中断 / 完了 / 保証 の背景。白カード(その他のアップロード)との差をつける
const BEIGE_BG = '#FAF6EE';
const BEIGE_BORDER = '#ECE3D3';

// 中間トーンのカード(背景ベージュ)。count=有 → ピンクの丸+数字 / muted → 灰色の数字のみ
function OrderCard({
  icon, title, subtitle, count, muted = false, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count?: number;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-2xl p-4 shadow-sm border text-left transition-all duration-150 hover:shadow-md active:scale-[0.98]"
      style={{ backgroundColor: BEIGE_BG, borderColor: BEIGE_BORDER }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: muted ? '#EFEAE0' : PINK_BG }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && count > 0 && (
        muted ? (
          <span className="text-sm font-bold text-gray-400 flex-shrink-0 tabular-nums">{count}</span>
        ) : (
          <span
            className="w-6 h-6 text-xs font-bold text-white rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: PINK }}
          >
            {count}
          </span>
        )
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </button>
  );
}

export default function HomePage() {
  const { isLoggedIn, setIsLoggedIn, setCurrentPage, isProfileRegistered, setOrderListMode } = useUpload();

  // 注文一覧の件数(決済済み注文 × アップロード状態の突合)
  const [counts, setCounts] = useState<{ needing: number; inProgress: number; completed: number } | null>(null);
  useEffect(() => {
    if (!isLoggedIn) { setCounts(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchOrderDashboard();
        if (!cancelled) setCounts({ needing: d.needing.length, inProgress: d.inProgress.length, completed: d.completed.length });
      } catch {
        if (!cancelled) setCounts({ needing: 0, inProgress: 0, completed: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  const openOrderList = (mode: OrderListMode) => {
    setOrderListMode(mode);
    setCurrentPage('order-list');
  };

  const handleSignIn = () => setCurrentPage('signin');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* ── ヘッダー: 2段タイトル(中央) / アカウント・サインアウト ── */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex flex-col items-center gap-1.5 px-4 pt-3 pb-2.5">
          {/* ロゴ画像は出さない(OEM 各社共用のため)。2段テキストは同フォント・同サイズ */}
          <div className="flex flex-col items-center leading-tight">
            <span className="text-base font-bold text-gray-800 tracking-wide">オーダーメイドインソール</span>
            <span className="text-base font-bold text-gray-800 tracking-wide">アップロードセンター</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setCurrentPage('account-profile')}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-pink-50"
                  style={{ borderColor: PINK, color: PINK }}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>アカウント情報</span>
                  {!isProfileRegistered && (
                    <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PINK }} />
                  )}
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>サインアウト</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ borderColor: PINK, color: PINK }}
              >
                <User className="w-3.5 h-3.5" />
                <span>サインイン / 新規登録</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 space-y-5 pb-8">

        {/* ── 注文一覧(ログイン時のみ) ── */}
        {isLoggedIn && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              注文一覧
            </h3>

            {/* 最上部・最も目立たせる: アップロードが必要な注文(ビビットピンクのグラデ + 柄) */}
            <button
              onClick={() => openOrderList('needing')}
              className="relative w-full overflow-hidden rounded-2xl p-5 text-left shadow-sm border-2 transition-all duration-150 hover:shadow-md active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DARK} 100%)`, borderColor: '#F062B8' }}
            >
              {/* 装飾の柄(半透明の円) */}
              <div className="pointer-events-none absolute -right-8 -top-10 w-32 h-32 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <div className="pointer-events-none absolute -right-2 -bottom-14 w-40 h-40 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
              <div className="pointer-events-none absolute left-16 -bottom-16 w-28 h-28 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />

              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white">アップロードが必要な注文</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {counts ? `決済済みで未アップロードの注文 ${counts.needing} 件` : '読み込み中…'}
                  </p>
                </div>
                {counts !== null && counts.needing > 0 && (
                  <span className="w-7 h-7 text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0 bg-white" style={{ color: PINK }}>
                    {counts.needing}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }} />
              </div>
            </button>

            {/* 中間トーン(背景ベージュ): 中断した注文 = ピンクの丸で促す */}
            <OrderCard
              icon={<PauseCircle className="w-5 h-5" style={{ color: PINK }} />}
              title="アップロードを中断した注文"
              subtitle={counts ? `途中で保存された注文 ${counts.inProgress} 件` : '読み込み中…'}
              count={counts?.inProgress}
              onClick={() => openOrderList('in-progress')}
            />

            {/* 中間トーン(背景ベージュ): 完了した注文(灰色の数字のみ)+ 保証・サービス */}
            <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: BEIGE_BG, borderColor: BEIGE_BORDER }}>
              <button
                onClick={() => openOrderList('completed')}
                className="w-full flex items-center gap-4 p-4 hover:bg-black/[0.03] active:scale-[0.98] transition-all duration-150 text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFEAE0' }}>
                  <Shield className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">アップロードが完了した注文</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {counts ? `内容の確認・修正ができます` : '読み込み中…'}
                  </p>
                </div>
                {counts && (
                  <span className="text-sm font-bold text-gray-400 flex-shrink-0 tabular-nums">{counts.completed}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
              <div className="border-t mx-4" style={{ borderColor: BEIGE_BORDER }} />
              <button
                onClick={() => openOrderList('completed')}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-black/[0.03] active:scale-[0.98] transition-all duration-150 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFEAE0' }}>
                  <Shield className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">保証・サービス</p>
                  <p className="text-xs text-gray-500 mt-0.5">完了済み注文の保証内容を確認</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ── その他のアップロード ── */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            その他のアップロード
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCurrentPage('payment-id-upload')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: PINK_BG }}>
                <Upload className="w-5 h-5" style={{ color: PINK }} />
              </div>
              <p className="text-sm font-semibold text-gray-800">決済完了IDで<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1">決済後にEmailで送られてくるIDが必要です。</p>
            </button>
            <button
              onClick={() => setCurrentPage('guest-upload')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: PINK_BG }}>
                <QrCode className="w-5 h-5" style={{ color: PINK }} />
              </div>
              <p className="text-sm font-semibold text-gray-800">ゲスト<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1">決済IDが無い場合はこちら。</p>
            </button>
          </div>
        </div>

        {/* ── お知らせ ── */}
        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ backgroundColor: PINK_BG, color: '#a81b77' }}
        >
          ※ 決済が完了している場合、「決済完了IDでアップロード」からデータのアップロードを行ってください。
        </div>
      </main>
    </div>
  );
}
