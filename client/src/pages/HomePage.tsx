import React, { useState, useEffect } from 'react';
import { Upload, Shield, LogOut, User, UserRound, ChevronRight, HelpCircle, X } from 'lucide-react';
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

const HELP_TEXT: Record<'id' | 'guest', { title: string; paragraphs: string[] }> = {
  id: {
    title: '決済完了IDでアップロードとは？',
    paragraphs: [
      '決済したご本人様以外の方が、代わりにデータをアップロードできる機能です。',
      '決済後に届くメールの「決済完了ID」を入力するだけで、決済情報に紐づけてアップロードできます。',
      'スマホ操作が苦手な方や、取扱店による代行アップロードに便利です。',
    ],
  },
  guest: {
    title: 'ゲストアップロードとは？',
    paragraphs: [
      '通常のアップロードができない場合に使用する緊急用のアップロード機能です。',
      '決済済みの場合は、必ず「通常アップロード」または「決済完了IDでアップロード」を優先してください。',
      'ゲストアップロードでは決済情報との紐づけに時間がかかり、納期が遅れる場合があります。',
    ],
  },
};

export default function HomePage() {
  const { isLoggedIn, setIsLoggedIn, setCurrentPage, isProfileRegistered, setOrderListMode } = useUpload();
  const [help, setHelp] = useState<'id' | 'guest' | null>(null);

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
      {/* ── ヘッダー: 2段タイトル(中央・ゆったり) / サインアウトは右上 / アカウント情報は中央 ── */}
      <header className="relative bg-white shadow-sm sticky top-0 z-20">
        {/* サインアウトは右上に固定(ログイン時のみ) */}
        {isLoggedIn && (
          <button
            onClick={handleSignOut}
            className="absolute top-2.5 right-3 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>サインアウト</span>
          </button>
        )}

        <div className="flex flex-col items-center gap-2.5 px-4 pt-6 pb-4">
          {/* ロゴ画像は出さない(OEM 各社共用のため)。2段テキストは同フォント・同サイズ */}
          <div className="flex flex-col items-center leading-snug">
            <span className="text-base font-bold text-gray-800 tracking-wide">オーダーメイドインソール</span>
            <span className="text-base font-bold text-gray-800 tracking-wide">アップロードセンター</span>
          </div>

          {isLoggedIn ? (
            <button
              onClick={() => setCurrentPage('account-profile')}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-pink-50"
              style={{ borderColor: PINK, color: PINK }}
            >
              <User className="w-3.5 h-3.5" />
              <span>アカウント情報</span>
              {!isProfileRegistered && (
                <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PINK }} />
              )}
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: PINK, color: PINK }}
            >
              <User className="w-3.5 h-3.5" />
              <span>サインイン / 新規登録</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5 space-y-5 pb-8">

        {/* ── 通常アップロード(ログイン時のみ) ── */}
        {isLoggedIn && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              通常アップロード
            </h3>

            {/* 最上部・最も目立たせる: アップロードが必要な注文(新規+中断を包含。ビビットピンクのグラデ + 柄) */}
            {(() => {
              const needTotal = counts ? counts.needing + counts.inProgress : null;
              return (
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
                        {needTotal !== null ? `新規・中断あわせて ${needTotal} 件` : '読み込み中…'}
                      </p>
                    </div>
                    {needTotal !== null && needTotal > 0 && (
                      <span className="w-7 h-7 text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0 bg-white" style={{ color: PINK }}>
                        {needTotal}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }} />
                  </div>
                </button>
              );
            })()}

            {/* 中間トーン(背景ベージュ): 完了した注文(灰色の数字のみ)+ 保証・サービス */}
            <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: BEIGE_BG, borderColor: BEIGE_BORDER }}>
              <button
                onClick={() => openOrderList('completed')}
                className="w-full flex items-center gap-4 p-4 hover:bg-black/[0.03] active:scale-[0.98] transition-all duration-150 text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFEAE0' }}>
                  <span className="text-lg font-bold text-gray-400 leading-none">完</span>
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

        {/* ── その他のアップロード ── (通常アップロード/保証・サービスとの間隔を2倍に) */}
        <div className="space-y-2 pt-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            その他のアップロード
          </h3>
          <div className="grid grid-cols-2 gap-3 items-start">
            {/* 決済完了IDでアップロード */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCurrentPage('payment-id-upload')}
              onKeyDown={(e) => { if (e.key === 'Enter') setCurrentPage('payment-id-upload'); }}
              className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-10 h-10 rounded-xl border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: PINK }}>
                  <span className="text-xs font-extrabold tracking-wide" style={{ color: PINK }}>ID</span>
                </div>
                <button
                  type="button"
                  aria-label="決済完了IDとは"
                  onClick={(e) => { e.stopPropagation(); setHelp('id'); }}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-800">決済完了IDで<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1">アップロードのお手伝い時に便利。</p>
            </div>

            {/* ゲストアップロード */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCurrentPage('guest-upload')}
              onKeyDown={(e) => { if (e.key === 'Enter') setCurrentPage('guest-upload'); }}
              className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all duration-150 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: PINK_BG }}>
                  <UserRound className="w-5 h-5" style={{ color: PINK }} />
                </div>
                <button
                  type="button"
                  aria-label="ゲストアップロードとは"
                  onClick={(e) => { e.stopPropagation(); setHelp('guest'); }}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-800">ゲスト<br />アップロード</p>
              <p className="text-xs text-gray-400 mt-1">アップロード手段に悩んだらこれ。</p>
            </div>
          </div>
        </div>

      </main>

      {/* ヘルプのポップアップ(「?」タップ時のみ・閉じるで元の画面へ) */}
      {help && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={() => setHelp(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[15px] font-bold text-gray-900 leading-snug">{HELP_TEXT[help].title}</h4>
              <button
                onClick={() => setHelp(null)}
                className="flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 space-y-3.5">
              {HELP_TEXT[help].paragraphs.map((para, i) => (
                <p key={i} className="text-[13px] leading-7 text-gray-600">{para}</p>
              ))}
            </div>

            <button
              onClick={() => setHelp(null)}
              className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: PINK }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
