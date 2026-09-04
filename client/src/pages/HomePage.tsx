import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, PauseCircle, Shield, LogOut, User, ChevronRight, QrCode } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import type { OrderListMode } from '@/contexts/UploadContext';
import { fetchOrderDashboard, supabase } from '@/lib/supabase';

// ============================================================
// Design: ビビッド・フォーム
// HomePage: アップロードセンター ホーム画面
// Primary: PANTONE Pink C (#D62598)
// Layout order（2026-09-04 冨永社長指示で整理）:
//   1. アカウント（最上部）
//   2. アップロードが必要な注文（ログイン時）
//   3. アップロードを中断した注文
//   4. アップロードが完了した注文
//   5. クイックアクション（決済完了IDでアップロード / ゲストアップロード）
//   6. お知らせ
// ※ 旧「データアップロード」ヒーローバナーと「インソール種別の選択」は削除。
//   このシステムは原則「決済に紐付いた注文」からアップロードする。決済に
//   紐付かないアップロードは「ゲストアップロード」に集約し、インソール種別
//   選択もゲストアップロードのフロー内で行う（GuestUploadPage の insole-select）。
// ============================================================

const LOGO_URL = '/manus-storage/oios_logo_1158292d.png';

interface OrderCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count?: number;
  onClick: () => void;
}

function OrderCard({ icon, title, subtitle, count, onClick }: OrderCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: '#FCE4F4' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span
          className="text-xs font-bold text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#D62598' }}
        >
          {count}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </button>
  );
}

export default function HomePage() {
  const { isLoggedIn, setIsLoggedIn, setCurrentPage, accountProfile, isProfileRegistered, setOrderListMode } = useUpload();

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

  const handleSignIn = () => {
    setCurrentPage('signin');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-gray-800">アップロードセンター</span>
          </div>
          {isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>サインアウト</span>
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: '#D62598' }}
            >
              <User className="w-4 h-4" />
              <span>サインイン</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5 space-y-5 pb-8">

        {/* ① アカウント（最上部） */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            アカウント
          </h3>
          {isLoggedIn ? (
            <button
              onClick={() => setCurrentPage('account-profile')}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <User className="w-5 h-5" style={{ color: '#D62598' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">
                  {isProfileRegistered
                    ? `${accountProfile!.firstName}　${accountProfile!.lastName}`
                    : 'アカウント情報を登録する'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isProfileRegistered
                    ? '住所・電話番号などを編集'
                    : '配送先として自動入力されて便利'}
                </p>
              </div>
              {!isProfileRegistered && (
                <span
                  className="text-xs font-bold text-white rounded-full px-2 py-0.5 flex-shrink-0"
                  style={{ backgroundColor: '#D62598' }}
                >
                  未登録
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <User className="w-5 h-5" style={{ color: '#D62598' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">サインイン / 新規登録</p>
                <p className="text-xs text-gray-400 mt-0.5">注文履歴の確認・管理</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          )}
        </div>

        {/* ② 注文一覧（ログイン時のみ） */}
        {isLoggedIn && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              注文一覧
            </h3>
            <div className="space-y-2">
              <OrderCard
                icon={<Upload className="w-5 h-5" style={{ color: '#D62598' }} />}
                title="アップロードが必要な注文"
                subtitle={counts ? `決済済みで未アップロードの注文 ${counts.needing} 件` : '読み込み中…'}
                count={counts?.needing}
                onClick={() => openOrderList('needing')}
              />
              <OrderCard
                icon={<PauseCircle className="w-5 h-5" style={{ color: '#D62598' }} />}
                title="アップロードを中断した注文"
                subtitle={counts ? `途中で保存された注文 ${counts.inProgress} 件` : '読み込み中…'}
                count={counts?.inProgress}
                onClick={() => openOrderList('in-progress')}
              />
              {/* アップロード完了 + 保証サービス 抱き合わせカード */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => openOrderList('completed')}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 text-left"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#FCE4F4' }}
                  >
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#D62598' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">アップロードが完了した注文</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {counts ? `${counts.completed} 件 ・ 内容の確認と修正ができます` : '読み込み中…'}
                    </p>
                  </div>
                  {counts && counts.completed > 0 && (
                    <span
                      className="text-xs font-bold text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#D62598' }}
                    >
                      {counts.completed}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
                <div className="border-t border-gray-100 mx-4" />
                <button
                  onClick={() => openOrderList('completed')}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#FCE4F4' }}
                  >
                    <Shield className="w-4 h-4" style={{ color: '#D62598' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">保証・サービス</p>
                    <p className="text-xs text-gray-400 mt-0.5">完了済み注文の保証内容を確認</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ③ クイックアクション（決済完了IDでアップロード / ゲストアップロード） */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            クイックアクション
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCurrentPage('payment-id-upload')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <Upload className="w-5 h-5" style={{ color: '#D62598' }} />
              </div>
              <p className="text-sm font-semibold text-gray-800">決済完了IDで<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1">決済後にEmailで送られてくるIDが必要です。</p>
            </button>
            <button
              onClick={() => setCurrentPage('guest-upload')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <QrCode className="w-5 h-5" style={{ color: '#D62598' }} />
              </div>
              <p className="text-sm font-semibold text-gray-800">ゲスト<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1"></p>
            </button>
          </div>
        </div>



        {/* ④ お知らせ */}
        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ backgroundColor: '#FCE4F4', color: '#a81b77' }}
        >
          ※ 決済が完了している場合、「決済完了IDでアップロード」からデータのアップロードを行ってください。
        </div>
      </main>
    </div>
  );
}
