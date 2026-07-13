/**
 * PaymentIdUploadPage.tsx
 * 決済完了IDによるアップロード画面
 * Design: Dart UIに準拠（カード型モーダル風レイアウト）
 */
import { useState, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

// ダミーの決済完了IDリスト（本番ではAPIで照合）
const DUMMY_VALID_IDS = ['FY72P02', 'AB12C34', 'XZ99Y01'];

export default function PaymentIdUploadPage() {
  const { setCurrentPage } = useUpload();
  const [paymentId, setPaymentId] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ name: string; insoleType: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    window.scrollTo({ top: 0 });
  };

  const handleVerify = () => {
    scrollToTop();
    setError('');
    setFieldError(false);
    const trimmed = paymentId.trim().toUpperCase();
    if (!trimmed) {
      setError('決済完了IDを入力してください。');
      setFieldError(true);
      return;
    }
    // ダミー照合（本番ではAPIで照合）
    if (DUMMY_VALID_IDS.includes(trimmed)) {
      setOrderInfo({ name: '山田 太郎', insoleType: 'スタンダード' });
      setIsConfirmed(true);
    } else {
      setError('入力されたIDに一致する注文が見つかりませんでした。\nIDをご確認の上、再度お試しください。');
    }
  };

  const handleStartUpload = () => {
    scrollToTop();
    setCurrentPage('step1');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCurrentPage('home')}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">決済完了IDによるアップロード</h1>
      </div>

      {/* コンテンツ */}
      <div ref={containerRef} data-scroll-container className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">
        {!isConfirmed ? (
          /* ID入力フォーム */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
            <p className="text-sm font-semibold text-center text-gray-700 mb-6 leading-relaxed">
              決済完了後に送られてくる<br />
              Email上部に記載されている<br />
              「決済完了ID」を入力してください
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="payment-id" className="text-sm font-medium text-gray-700 mb-1 block">
                  決済完了ID
                </Label>
                <Input
                  id="payment-id"
                  value={paymentId}
                  onChange={(e) => {
                    setPaymentId(e.target.value);
                    setError('');
                    setFieldError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="例）FY72P02"
                  className="text-base"
                  autoFocus
                  style={{ borderColor: fieldError ? ERROR_BORDER : undefined, backgroundColor: fieldError ? ERROR_BG : undefined }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 whitespace-pre-line">{error}</p>
                </div>
              )}

              <Button
                onClick={handleVerify}
                className="w-full font-semibold"
                style={{ backgroundColor: '#D62598' }}
                disabled={!paymentId.trim()}
              >
                IDを確認する
              </Button>
            </div>

            {/* 注意書き */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 leading-relaxed">
                ※ 決済完了IDはご注文後に登録されたメールアドレスへ送信されます。<br />
                ※ メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
            </div>
          </div>
        ) : (
          /* 照合成功 */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
            <div className="flex flex-col items-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <h2 className="text-base font-bold text-gray-800">注文が確認できました</h2>
            </div>

            {orderInfo && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">お客様名</span>
                  <span className="font-semibold text-gray-800">{orderInfo.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">インソール種別</span>
                  <span className="font-semibold text-gray-800">{orderInfo.insoleType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">決済完了ID</span>
                  <span className="font-semibold text-gray-800">{paymentId.trim().toUpperCase()}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
              アップロードを開始します。<br />
              事前に必要な動画・画像の撮影を行ってください。
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleStartUpload}
                className="w-full font-semibold"
                style={{ backgroundColor: '#D62598' }}
              >
                アップロードを開始する
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmed(false);
                  setPaymentId('');
                  setOrderInfo(null);
                }}
                className="w-full"
              >
                別のIDで確認する
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
