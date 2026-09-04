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

const LOGO_URL = '/oios-logo.svg'; // 正式な OIOS 画像を client/public/oios-logo.(svg|png) に差し替え可

const PINK = '#D62598';
const PINK_BG = '#FCE4F4';

type Tone = 'primary' | 'default' | 'muted';

interface OrderCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count?: number;
  tone?: Tone;
  onClick: () => void;
}

function OrderCard({ icon, title, subtitle, count, tone = 'default', onClick }: OrderCardProps) {
  const primary = tone === 'primary';
  const muted = tone === 'muted';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 rounded-2xl shadow-sm border text-left transition-all duration-150 hover:shadow-md active:scale-[0.98] ${primary ? 'p-5' : 'p-4'}`}
      style={
        primary
          ? { backgroundColor: '#FFF0F9', borderColor: PINK, borderWidth: 2 }
          : { backgroundColor: 'white', borderColor: '#F3F4F6' }
      }
    >
      <div
        className={`rounded-xl flex items-center justify-center flex-shrink-0 ${primary ? 'w-14 h-14' : 'w-12 h-12'}`}
        style={{ backgroundColor: muted ? '#F3F4F6' : PINK_BG }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-gray-800 ${primary ? 'text-base' : 'text-sm font-semibold'}`}>{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && count > 0 && (
        muted ? (
          // 完了: 目立たせない。灰色の数字のみ
          <span className="text-sm font-bold text-gray-400 flex-shrink-0 tabular-nums">{count}</span>
        ) : (
          // 必要 / 中断: アップロードを促す = ピンクの丸 + 数字
          <span
            className={`font-bold text-white rounded-full flex items-center justify-center flex-shrink-0 ${primary ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs'}`}
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
      {/* ── ヘッダー: ロゴ(中央) / タイトル(中央) / アカウント・サインアウト ── */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex flex-col items-center gap-1.5 px-4 pt-3 pb-2.5">
          <img src={LOGO_URL} alt="OIOS" className="h-7 object-contain" />
          <span className="text-base font-bold text-gray-800 tracking-wide">アップロードセンター</span>

          <div className="flex items-center gap-2 mt-0.5">
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

            {/* 最上部・目立たせる: アップロードが必要な注文 */}
            <OrderCard
              tone="primary"
              icon={<Upload className="w-6 h-6" style={{ color: PINK }} />}
              title="アップロードが必要な注文"
              subtitle={counts ? `決済済みで未アップロードの注文 ${counts.needing} 件` : '読み込み中…'}
              count={counts?.needing}
              onClick={() => openOrderList('needing')}
            />

            {/* 従属: 中断した注文(ピンクの丸で促す) */}
            <OrderCard
              tone="default"
              icon={<PauseCircle className="w-5 h-5" style={{ color: PINK }} />}
              title="アップロードを中断した注文"
              subtitle={counts ? `途中で保存された注文 ${counts.inProgress} 件` : '読み込み中…'}
              count={counts?.inProgress}
              onClick={() => openOrderList('in-progress')}
            />

            {/* 従属: 完了した注文(灰色の数字のみ)+ 保証・サービス */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => openOrderList('completed')}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                  <Shield className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">アップロードが完了した注文</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {counts ? `内容の確認・修正ができます` : '読み込み中…'}
                  </p>
                </div>
                {counts && (
                  <span className="text-sm font-bold text-gray-400 flex-shrink-0 tabular-nums">{counts.completed}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
              <div className="border-t border-gray-100 mx-4" />
              <button
                onClick={() => openOrderList('completed')}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                  <Shield className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">保証・サービス</p>
                  <p className="text-xs text-gray-400 mt-0.5">完了済み注文の保証内容を確認</p>
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
