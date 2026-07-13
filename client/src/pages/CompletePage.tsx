import React from 'react';
import { CheckCircle2, ArrowRight, Home } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import PinkButton from '@/components/PinkButton';

// ============================================================
// Design: ビビッド・フォーム
// CompletePage: アップロード完了画面（STEP 9）
// ============================================================

const LOGO_URL = '/manus-storage/oios_logo_1158292d.png';

export default function CompletePage() {
  const { setCurrentPage } = useUpload();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-center px-4 h-14">
          <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain mr-2" />
          <span className="text-base font-bold text-gray-800">アップロードセンター</span>
        </div>
        {/* Full progress bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #D62598, #e84db5)' }} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Success animation */}
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #D62598, #a81b77)',
              boxShadow: '0 8px 32px rgba(214, 37, 152, 0.3)',
            }}
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              アップロード完了 🎉
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              データのアップロードが完了しました
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#D62598' }}
              />
            ))}
          </div>

          {/* Info cards */}
          <div className="w-full space-y-3 mt-2">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#FCE4F4' }}
                >
                  <ArrowRight className="w-3 h-3" style={{ color: '#D62598' }} />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">今後の流れについて</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                これよりスタッフがデータを確認し、お客様に合わせたオーダーメイドインソールを作製いたします。
                完成までしばらくお待ちください。
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#FCE4F4' }}
                >
                  <ArrowRight className="w-3 h-3" style={{ color: '#D62598' }} />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">ルーム用インソールについて</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                ルーム用は、アップロード頂いたデータを元にお客様の足サイズを計測し、最適なインソールをお作りします。
              </p>
            </div>
          </div>

          {/* Back to home */}
          <PinkButton
            fullWidth
            size="lg"
            onClick={() => setCurrentPage('home')}
          >
            <Home className="w-4 h-4" />
            ホームに戻る
          </PinkButton>
        </div>
      </main>
    </div>
  );
}
