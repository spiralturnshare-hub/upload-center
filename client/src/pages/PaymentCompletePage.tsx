/**
 * PaymentCompletePage.tsx
 * 対面販売(dealer-insole-order の QR決済)完了/中断後、Stripe Checkout から
 * upload-center へリダイレクトされた顧客が最初に見る画面。
 * URL: `?payment=success` / `?payment=canceled`(App起動時に UploadContext が読み取って
 * この画面へ遷移させる。詳細は UploadContext.tsx の currentPage 初期化コメント参照)。
 *
 * 注文詳細は表示しない: 決済完了IDが記載されたメールが既に顧客(および場合により取扱店)へ
 * 送信される仕様のため、この画面はアップロードセンターへの導線を示すだけでよい(冨永社長 2026-09-05)。
 */
import { useUpload } from '@/contexts/UploadContext';
import PinkButton from '@/components/PinkButton';
import { CheckCircle2, XCircle } from 'lucide-react';

const PINK = '#2563EB';

export default function PaymentCompletePage({ status }: { status: 'success' | 'canceled' }) {
  const { setCurrentPage } = useUpload();

  const goHome = () => {
    // URL のクエリを残したままだと再読み込みでこの画面に戻ってしまうため、履歴も揃えておく
    window.history.replaceState(null, '', window.location.pathname);
    setCurrentPage('home');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-5">
      {status === 'success' ? (
        <>
          <CheckCircle2 className="w-14 h-14" style={{ color: PINK }} />
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-gray-800">ご決済ありがとうございました</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              決済完了IDを記載したメールをお送りしています。<br />
              続けて、下のボタンからアップロードセンターへお進みください。
            </p>
          </div>
        </>
      ) : (
        <>
          <XCircle className="w-14 h-14 text-gray-400" />
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-gray-800">決済が中断されました</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              お手続きは完了していません。決済を再度お試しになるか、<br />
              取扱店までお問い合わせください。
            </p>
          </div>
        </>
      )}
      <PinkButton size="lg" onClick={goHome} className="mt-2">
        アップロードセンターへ
      </PinkButton>
    </div>
  );
}
