import React, { useState } from 'react';
import { Upload, CheckCircle2, Clock, PauseCircle, Shield, LogOut, User, ChevronRight, QrCode, Settings2 } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import PinkButton from '@/components/PinkButton';
import InsoleSelector from '@/components/InsoleSelector';
import PreShootingDialog from '@/components/PreShootingDialog';
import type { InsoleKind } from '@/lib/insoleConfig';
import { INSOLE_DISPLAY_NAMES } from '@/lib/insoleConfig';

// ============================================================
// Design: ビビッド・フォーム
// HomePage: アップロードセンター ホーム画面
// Primary: PANTONE Pink C (#D62598)
// Layout order:
//   1. アカウント（最上部）
//   2. データアップロード（ヒーローバナー）
//   3. インソール種別選択
//   4. 注文一覧（ログイン時）
//   5. 決済完了IDでアップロード / ゲストアップロード（注文一覧の下）
//   6. サービス
//   7. お知らせ
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
  const { isLoggedIn, setIsLoggedIn, setCurrentPage, uploadData, updateUploadData, accountProfile, isProfileRegistered, initUploadSession } = useUpload();
  const [showInsoleSelector, setShowInsoleSelector] = useState(false);
  const [showPreShootingDialog, setShowPreShootingDialog] = useState(false);

  const handleInsoleChange = (insoles: InsoleKind[]) => {
    updateUploadData({ selectedInsoles: insoles });
  };

  const handleStartUpload = () => {
    if (uploadData.selectedInsoles.length === 0) {
      setShowInsoleSelector(true);
      return;
    }
    setShowPreShootingDialog(true);
  };

  const handlePreShootingConfirm = () => {
    setShowPreShootingDialog(false);
    initUploadSession();
    setCurrentPage('step1');
  };

  const handleGuestUpload = () => {
    setCurrentPage('signin');
  };

  const handleSignIn = () => {
    setCurrentPage('signin');
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
  };

  const handleConfirmInsoleAndStart = () => {
    if (uploadData.selectedInsoles.length > 0) {
      setShowInsoleSelector(false);
      setShowPreShootingDialog(true);
    }
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

        {/* ② データアップロード ヒーローバナー */}
        <div
          className="rounded-2xl p-5 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #D62598 0%, #a81b77 100%)' }}
        >
          <div className="relative z-10">
            <p className="text-xs font-medium opacity-80 mb-1">オーダーメイドインソール注文システム</p>
            <h2 className="text-xl font-bold leading-tight mb-2">
              データアップロード
            </h2>
            <p className="text-xs opacity-80 leading-relaxed mb-4">
              ご注文のインソール作製に必要な<br />
              データをアップロードしてください
            </p>
            <PinkButton
              variant="primary"
              size="sm"
              onClick={handleStartUpload}
              className="bg-white text-[#D62598] hover:bg-gray-50"
              style={{ background: 'white', color: '#D62598' }}
            >
              <Upload className="w-4 h-4" />
              アップロードを開始
            </PinkButton>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20" style={{ backgroundColor: 'white' }} />
          <div className="absolute -right-4 -bottom-12 w-40 h-40 rounded-full opacity-10" style={{ backgroundColor: 'white' }} />
        </div>

        {/* ③ インソール種別選択パネル */}
        <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: '#D62598' }}>
          <button
            onClick={() => setShowInsoleSelector(!showInsoleSelector)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <Settings2 className="w-4 h-4" style={{ color: '#D62598' }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">インソール種別の選択</p>
                <p className="text-xs text-gray-400">
                  {uploadData.selectedInsoles.length === 0
                    ? '種別を選択してください（必須）'
                    : uploadData.selectedInsoles.map(k => INSOLE_DISPLAY_NAMES[k]).join(' + ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {uploadData.selectedInsoles.length > 0 && (
                <span
                  className="text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ backgroundColor: '#D62598' }}
                >
                  {uploadData.selectedInsoles.length}
                </span>
              )}
              <ChevronRight
                className="w-4 h-4 text-gray-400 transition-transform duration-200"
                style={{ transform: showInsoleSelector ? 'rotate(90deg)' : 'rotate(0deg)' }}
              />
            </div>
          </button>

          {showInsoleSelector && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
              <div className="pt-3">
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  ご注文のインソール種別を選択してください。<br />
                  2種類セットの場合は2つ選択できます。
                </p>
                <InsoleSelector
                  value={uploadData.selectedInsoles}
                  onChange={handleInsoleChange}
                  maxCount={2}
                />
              </div>
              {uploadData.selectedInsoles.length > 0 && (
                <PinkButton
                  size="md"
                  onClick={handleConfirmInsoleAndStart}
                  className="w-full"
                >
                  <Upload className="w-4 h-4" />
                  この種別でアップロードを開始
                </PinkButton>
              )}
            </div>
          )}
        </div>

        {/* ④ 注文一覧（ログイン時のみ） */}
        {isLoggedIn && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              注文一覧
            </h3>
            <div className="space-y-2">
              <OrderCard
                icon={<Upload className="w-5 h-5" style={{ color: '#D62598' }} />}
                title="アップロードが必要な注文"
                subtitle=""
                count={2}
                onClick={() => {}}
              />
              <OrderCard
                icon={<PauseCircle className="w-5 h-5" style={{ color: '#D62598' }} />}
                title="アップロードを中断した注文"
                subtitle=""
                onClick={() => {}}
              />
              {/* アップロード完了 + 保証サービス 抱き合わせカード */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => {}}
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
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
                <div className="border-t border-gray-100 mx-4" />
                <button
                  onClick={() => {}}
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
              <OrderCard
                icon={<Clock className="w-5 h-5" style={{ color: '#D62598' }} />}
                title="代理アップロードが必要な注文"
                subtitle="利用者に代わってアップロードをお手伝いできます"
                onClick={() => {}}
              />
            </div>
          </div>
        )}

        {/* ⑤ 決済完了IDでアップロード / ゲストアップロード（注文一覧の下） */}
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



        {/* ⑦ お知らせ */}
        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ backgroundColor: '#FCE4F4', color: '#a81b77' }}
        >
          ※ 決済が完了している場合、「決済完了IDでアップロード」からデータのアップロードを行ってください。
        </div>
      </main>

      {/* 事前撮影確認ダイアログ */}
      <PreShootingDialog
        open={showPreShootingDialog}
        onClose={() => setShowPreShootingDialog(false)}
        onConfirm={handlePreShootingConfirm}
      />
    </div>
  );
}
