import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Upload, PlayCircle, CheckCircle2, PackageOpen } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import PinkButton from '@/components/PinkButton';
import { INSOLE_DISPLAY_NAMES } from '@/lib/insoleConfig';
import type { InsoleKind } from '@/lib/insoleConfig';
import {
  fetchOrderDashboard,
  type OrderDashboard,
  type DashboardOrder,
  type DashboardInProgress,
  type DashboardCompleted,
} from '@/lib/supabase';
import { toast } from 'sonner';

const PINK = '#D62598';

// ============================================================
// OrderListPage: ホーム「注文一覧」から開く3種のリスト
//   needing     … 決済済みだが未アップロード → その注文でアップロード開始
//   in-progress … 途中離脱(uploads.status='draft') → 続きから再開
//   completed   … 完了 → 内容の確認・修正(EditUploadPage)
// 決済内容(insole1_kind/insole2_kind)と紐づけて
// 「歩き用・ルーム用のアップロードが必要です」のように表示する。
// ============================================================

const MODE_META = {
  needing: {
    title: 'アップロードが必要な注文',
    icon: <Upload className="w-5 h-5" style={{ color: PINK }} />,
    empty: 'アップロードが必要な注文はありません。',
  },
  'in-progress': {
    title: 'アップロードを中断した注文',
    icon: <PlayCircle className="w-5 h-5" style={{ color: PINK }} />,
    empty: '中断中のアップロードはありません。',
  },
  completed: {
    title: 'アップロードが完了した注文',
    icon: <CheckCircle2 className="w-5 h-5" style={{ color: PINK }} />,
    empty: 'アップロードが完了した注文はまだありません。',
  },
} as const;

function insoleLabel(kinds: string[]): string {
  if (kinds.length === 0) return 'インソール';
  return kinds.map(k => INSOLE_DISPLAY_NAMES[k as InsoleKind] ?? k).join('・');
}

export default function OrderListPage() {
  const {
    orderListMode, setCurrentPage,
    initUploadSession, resumeUploadSession,
    setOrderId, setOrderName,
  } = useUpload();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<OrderDashboard>({ needing: [], inProgress: [], completed: [] });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const d = await fetchOrderDashboard();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '注文の読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const meta = MODE_META[orderListMode];
  const rows: (DashboardOrder | DashboardInProgress | DashboardCompleted)[] =
    orderListMode === 'needing' ? data.needing
      : orderListMode === 'in-progress' ? data.inProgress
        : data.completed;

  // --- 各モードのアクション ---
  const startNew = async (o: DashboardOrder) => {
    setBusyId(o.id);
    try {
      await initUploadSession({
        orderId: o.id,
        orderName: o.orderName ?? undefined,
        selectedInsoles: o.insoleKinds as InsoleKind[],
      });
      setCurrentPage('step1');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'アップロードを開始できませんでした');
    } finally {
      setBusyId(null);
    }
  };

  const resume = async (o: DashboardInProgress) => {
    setBusyId(o.id);
    try {
      await resumeUploadSession(o.uploadId, { orderId: o.id, orderName: o.orderName ?? undefined });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '再開できませんでした');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (o: DashboardCompleted) => {
    setOrderId(o.id);
    setOrderName(o.orderName ?? '');
    setCurrentPage('edit-upload');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setCurrentPage('home')} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          {meta.icon}
          <h1 className="text-base font-semibold text-gray-800">{meta.title}</h1>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border-2 p-4 text-sm" style={{ borderColor: '#F5A623', backgroundColor: '#FFF8EC' }}>
            <p className="font-bold text-gray-800">読み込みに失敗しました</p>
            <p className="text-gray-600 mt-1 break-all">{error}</p>
            <button onClick={() => setCurrentPage('home')} className="text-sm mt-2" style={{ color: PINK }}>ホームに戻る</button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <PackageOpen className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">{meta.empty}</p>
            <button onClick={() => setCurrentPage('home')} className="text-sm" style={{ color: PINK }}>ホームに戻る</button>
          </div>
        )}

        {!loading && !error && rows.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-800">
                {insoleLabel(o.insoleKinds)}
                {o.roomShoes ? '（＋ルームシューズ）' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">注文番号: {o.orderName ?? '—'}</p>
            </div>

            {orderListMode === 'needing' && (
              <>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold" style={{ color: PINK }}>{insoleLabel(o.insoleKinds)}</span>
                  {' '}のアップロードが必要です。
                </p>
                <PinkButton size="md" className="w-full" disabled={busyId === o.id} onClick={() => startNew(o)}>
                  {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  この注文のアップロードを開始
                </PinkButton>
              </>
            )}

            {orderListMode === 'in-progress' && 'uploadedKinds' in o && (
              <>
                <p className="text-sm text-gray-700">
                  アップロード途中です（{(o as DashboardInProgress).uploadedKinds.length} 件のデータを保存済み）。
                  続きから再開できます。
                </p>
                <PinkButton size="md" className="w-full" disabled={busyId === o.id} onClick={() => resume(o as DashboardInProgress)}>
                  {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  続きから再開する
                </PinkButton>
              </>
            )}

            {orderListMode === 'completed' && (
              <PinkButton size="md" variant="outline" className="w-full" onClick={() => openEdit(o as DashboardCompleted)}>
                <CheckCircle2 className="w-4 h-4" />
                アップロード内容の確認・修正
              </PinkButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
