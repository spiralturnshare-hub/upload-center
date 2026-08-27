/**
 * PaymentIdUploadPage.tsx
 * 決済完了IDによるアップロード画面（Supabase接続）
 */
import { useState, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { fetchUploadByOrderId } from '@/lib/supabase';
import { toast } from 'sonner';
import type { InsoleKind } from '@/lib/insoleConfig';

const ERROR_BORDER = '#F97316';
const ERROR_BG = '#FFF7ED';

export default function PaymentIdUploadPage() {
  const { setCurrentPage, setOrderId, setOrderName, initUploadSession } = useUpload();
  const [paymentId, setPaymentId] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ name: string; insoleType: string } | null>(null);
  const [hasExistingUpload, setHasExistingUpload] = useState(false);
  // 照合できた注文の情報(アップロード開始時に uploads 行へ渡す)
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: string; name: string; insoles: InsoleKind[] } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    window.scrollTo({ top: 0 });
  };

  const handleVerify = async () => {
    scrollToTop();
    setError('');
    setFieldError(false);
    const trimmed = paymentId.trim().toUpperCase();
    if (!trimmed) {
      setError('決済完了IDを入力してください。');
      setFieldError(true);
      return;
    }
    setLoading(true);
    try {
      // Supabase orders テーブルで照合
      const { data, error: dbError } = await supabase
        .from('orders')
        .select('id, order_name, status, customer_last_name, customer_first_name, insole1_kind, insole2_kind')
        .eq('order_name', trimmed)
        .single();

      if (dbError || !data) {
        setError('入力されたIDに一致する注文が見つかりませんでした。\nIDをご確認の上、再度お試しください。');
        setFieldError(true);
      } else {
        const name = `${data.customer_last_name ?? ''}${data.customer_first_name ?? ''}`;
        const insoleKinds = [data.insole1_kind, data.insole2_kind].filter(Boolean) as InsoleKind[];
        const insoleType = insoleKinds.join(' + ') || '未設定';
        setOrderInfo({ name: name || '（名前未設定）', insoleType });
        setConfirmedOrder({ id: data.id, name: data.order_name ?? trimmed, insoles: insoleKinds });
        if (setOrderId) setOrderId(data.id);
        if (setOrderName) setOrderName(data.order_name ?? trimmed);
        // 既にアップロード済みデータがあるか確認(あれば「修正する」導線に切り替える)
        const existing = await fetchUploadByOrderId(data.id);
        setHasExistingUpload(!!existing);
        setIsConfirmed(true);
      }
    } catch {
      setError('照合中にエラーが発生しました。しばらく後に再試行してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleStartUpload = async () => {
    scrollToTop();
    if (hasExistingUpload) {
      setCurrentPage('edit-upload');
      return;
    }
    try {
      // 新規アップロード: uploadId 生成 + uploads 行を draft で先に作成(FK対策)
      await initUploadSession({
        orderId: confirmedOrder?.id,
        orderName: confirmedOrder?.name,
        selectedInsoles: confirmedOrder?.insoles ?? [],
      });
      setCurrentPage('step1');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'アップロードの開始に失敗しました。再ログインしてお試しください。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setCurrentPage('home')} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">決済完了IDによるアップロード</h1>
      </div>
      {/* コンテンツ */}
      <div ref={containerRef} data-scroll-container className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">
        {!isConfirmed ? (
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
                  onChange={e => setPaymentId(e.target.value.toUpperCase())}
                  placeholder="例: ST5217"
                  disabled={loading}
                  style={fieldError ? { borderColor: ERROR_BORDER, backgroundColor: ERROR_BG } : {}}
                  className="uppercase font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-orange-600 text-sm bg-orange-50 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="whitespace-pre-line">{error}</p>
                </div>
              )}
              <Button onClick={handleVerify} disabled={loading} className="w-full" style={{ backgroundColor: '#D62598' }}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />照合中...</> : '注文を確認する'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4 space-y-4">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <h2 className="text-base font-bold text-gray-800">注文が確認できました</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">お名前</span>
                <span className="font-medium text-gray-800">{orderInfo?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">インソール</span>
                <span className="font-medium text-gray-800">{orderInfo?.insoleType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">注文ID</span>
                <span className="font-mono text-gray-800">{paymentId}</span>
              </div>
            </div>
            <Button onClick={handleStartUpload} className="w-full" style={{ backgroundColor: '#D62598' }}>
              {hasExistingUpload ? 'アップロード内容を確認・修正する' : 'アップロードを開始する'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
