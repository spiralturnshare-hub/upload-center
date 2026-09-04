import { useEffect, useState, type ReactNode } from 'react';
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

const PINK = '#2563EB';

// ============================================================
// OrderListPage: ホーム「注文一覧」から開く3種のリスト
//   needing     … 決済済みだが未アップロード → その注文でアップロード開始
//   in-progress … 途中離脱(uploads.status='draft') → 続きから再開
//   completed   … 完了 → 内容の確認・修正(EditUploadPage)
// 決済内容(insole1_kind/insole2_kind)と紐づけて
// 「歩き用・ルーム用のアップロードが必要です」のように表示する。
// ============================================================

// 'needing' は「新規 + 中断」の2セクションを内包する(冨永社長 2026-09-04)。
// トップ画面のピンクカードから来る。ここで新規/中断を選ぶ。
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
    setOrderId, setOrderName, setEditUploadId,
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

  // 'needing' = 新規(data.needing) + 中断(data.inProgress)を両方表示。
  // 'in-progress' = 中断のみ。'completed' = 完了のみ。
  const showNew = orderListMode === 'needing';
  const showResume = orderListMode === 'needing' || orderListMode === 'in-progress';
  const showCompleted = orderListMode === 'completed';
  const newRows = showNew ? data.needing : [];
  const resumeRows = showResume ? data.inProgress : [];
  const completedRows = showCompleted ? data.completed : [];
  const totalRows = newRows.length + resumeRows.length + completedRows.length;

  // --- 各モードのアクション ---
  const startNew = async (o: DashboardOrder) => {
    setBusyId(o.id);
    try {
      await initUploadSession({
        orderId: o.orderId ?? undefined,
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
      await resumeUploadSession(o.uploadId, {
        orderId: o.orderId ?? undefined,
        orderName: o.orderName ?? undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '再開できませんでした');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (o: DashboardCompleted) => {
    if (o.orderId) {
      // 実注文: 注文IDで開く
      setEditUploadId(null);
      setOrderId(o.orderId);
      setOrderName(o.orderName ?? '');
    } else {
      // 注文に紐付かない(ゲスト等): upload ID で直接開く
      setEditUploadId(o.uploadId);
      setOrderName('');
    }
    setCurrentPage('edit-upload');
  };

  // 1注文カードの共通枠
  const OrderRow = ({ o, children }: { o: DashboardOrder; children: ReactNode }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-800">
          {insoleLabel(o.insoleKinds)}
          {o.roomShoes ? '（＋ルームシューズ）' : ''}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {o.orderName ? `注文番号: ${o.orderName}` : o.isGuest ? 'ゲストアップロード' : '注文番号なし'}
        </p>
      </div>
      {children}
    </div>
  );

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

        {!loading && !error && totalRows === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <PackageOpen className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500">{meta.empty}</p>
            <button onClick={() => setCurrentPage('home')} className="text-sm" style={{ color: PINK }}>ホームに戻る</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 新規でアップロードが必要な注文 */}
            {showNew && newRows.length > 0 && (
              <div className="space-y-3">
                {(showResume) && (
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 pt-1 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" style={{ color: PINK }} />
                    新規でアップロードが必要な注文（{newRows.length}）
                  </h2>
                )}
                {newRows.map((o) => (
                  <OrderRow key={o.id} o={o}>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold" style={{ color: PINK }}>{insoleLabel(o.insoleKinds)}</span>
                      {' '}のアップロードが必要です。
                    </p>
                    <PinkButton size="md" className="w-full" disabled={busyId === o.id} onClick={() => startNew(o)}>
                      {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      この注文のアップロードを開始
                    </PinkButton>
                  </OrderRow>
                ))}
              </div>
            )}

            {/* アップロードを中断した注文 */}
            {showResume && resumeRows.length > 0 && (
              <div className="space-y-3 pt-1">
                {(showNew) && (
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 pt-2 flex items-center gap-1.5">
                    <PlayCircle className="w-3.5 h-3.5" style={{ color: PINK }} />
                    アップロードを中断した注文（{resumeRows.length}）
                  </h2>
                )}
                {resumeRows.map((o) => (
                  <OrderRow key={o.id} o={o}>
                    <p className="text-sm text-gray-700">
                      アップロード途中です（{o.uploadedKinds.length} 件のデータを保存済み）。続きから再開できます。
                    </p>
                    <PinkButton size="md" className="w-full" disabled={busyId === o.id} onClick={() => resume(o)}>
                      {busyId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                      続きから再開する
                    </PinkButton>
                  </OrderRow>
                ))}
              </div>
            )}

            {/* 完了した注文 */}
            {showCompleted && completedRows.map((o) => (
              <OrderRow key={o.id} o={o}>
                <PinkButton size="md" variant="outline" className="w-full" onClick={() => openEdit(o)}>
                  <CheckCircle2 className="w-4 h-4" />
                  アップロード内容の確認・修正
                </PinkButton>
              </OrderRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
