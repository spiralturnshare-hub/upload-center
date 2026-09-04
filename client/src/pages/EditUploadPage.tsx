/**
 * EditUploadPage.tsx
 * 顧客によるアップロード済みデータの確認・修正画面
 *
 * 方針(spiralturn-green-integration/docs/10-customer-mgmt-console-vision-and-data-revision-policy.md):
 * - 作製アクション(計測・動作分析)が開始される前までは、顧客が自由に修正・追加できる
 * - 開始後は修正不可(スタッフ側=customer-mgmt-consoleのみ修正可能)
 * - 上書き・削除はせず、update_upload_with_history/replace_upload_file(RPC)経由で
 *   変更前の状態を必ず履歴として残してから更新する
 *
 * 注意(スコープ): 顧客情報・配送先・作製目的・靴情報は項目ごとに編集できるが、
 * 痛み・タコ(構造が複雑なため)は現状の内容を表示した上で、
 * 「修正・追加のご要望」欄への自由記述という形で対応する(将来、専用フォームへ拡張予定)。
 */
import { useEffect, useState } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import PinkButton from '@/components/PinkButton';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Lock, Upload, CheckCircle2 } from 'lucide-react';
import {
  fetchUploadByOrderId,
  fetchUploadById,
  canCustomerEditUpload,
  fetchCurrentUploadFiles,
  updateUploadAsCustomer,
  replaceUploadFileAsCustomer,
  uploadFileToStorage,
  type UploadFullRecord,
} from '@/lib/supabase';

const PINK = '#D62598';
const inputClass = 'w-full h-11 px-3 rounded-xl border-2 border-gray-200 text-sm focus:outline-none transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 mb-3">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function EditUploadPage() {
  const { setCurrentPage, orderId, orderName, userId, editUploadId } = useUpload();

  const [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState<UploadFullRecord | null>(null);
  const [editable, setEditable] = useState(true);
  const [files, setFiles] = useState<{ id: string; kind: string | null; file_type: string | null; url: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [replacingKind, setReplacingKind] = useState<string | null>(null);

  // 編集用ドラフト
  const [insoleUserName, setInsoleUserName] = useState('');
  const [insoleUserKana, setInsoleUserKana] = useState('');
  const [customerInfo, setCustomerInfo] = useState<Record<string, unknown>>({});
  const [purposeInfo, setPurposeInfo] = useState<Record<string, unknown>>({});
  const [shoeInfos, setShoeInfos] = useState<Record<string, Record<string, unknown>>>({});
  const [painNote, setPainNote] = useState('');
  const [takoNote, setTakoNote] = useState('');

  useEffect(() => {
    if (!orderId && !editUploadId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      // editUploadId が指定されていれば upload ID で直接(注文なしのゲストアップロード等)、
      // なければ従来どおり注文IDから引く。
      const rec = editUploadId
        ? await fetchUploadById(editUploadId)
        : await fetchUploadByOrderId(orderId);
      if (!rec) {
        if (!cancelled) { setUpload(null); setLoading(false); }
        return;
      }
      const [canEdit, fileList] = await Promise.all([
        canCustomerEditUpload(rec.id),
        fetchCurrentUploadFiles(rec.id),
      ]);
      if (cancelled) return;
      setUpload(rec);
      setEditable(canEdit);
      setFiles(fileList);
      setInsoleUserName(rec.insole_user_name ?? '');
      setInsoleUserKana(rec.insole_user_kana ?? '');
      setCustomerInfo(rec.customer_info ?? {});
      setPurposeInfo(rec.purpose_info ?? {});
      setShoeInfos((rec.shoe_infos as Record<string, Record<string, unknown>>) ?? {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId, editUploadId]);

  function ci(key: string): string {
    const v = customerInfo[key];
    return typeof v === 'string' ? v : '';
  }
  function pi(key: string): string {
    const v = purposeInfo[key];
    if (Array.isArray(v)) return v.join(', ');
    return typeof v === 'string' ? v : '';
  }
  function shoeField(insoleKind: string, key: string): string {
    const v = shoeInfos[insoleKind]?.[key];
    return typeof v === 'string' ? v : '';
  }

  async function handleSave() {
    if (!upload) return;
    setSaving(true);
    try {
      const updated = await updateUploadAsCustomer(
        upload.id,
        {
          insole_user_name: insoleUserName,
          insole_user_kana: insoleUserKana,
          customer_info: customerInfo,
          purpose_info: purposeInfo,
          shoe_infos: shoeInfos,
          ...(painNote ? { pain_info: { ...(upload.pain_info ?? {}), customer_edit_note: painNote } } : {}),
          ...(takoNote ? { tako_info: { ...(upload.tako_info ?? {}), customer_edit_note: takoNote } } : {}),
        },
        userId,
        '顧客本人による修正'
      );
      setUpload(updated);
      setPainNote('');
      setTakoNote('');
      toast.success('修正内容を保存しました');
    } catch (e) {
      toast.error('保存に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSaving(false);
    }
  }

  async function handleReplaceFile(kind: string, fileType: string, newFile: File) {
    if (!upload) return;
    setReplacingKind(kind);
    try {
      const fileId = crypto.randomUUID();
      const { url } = await uploadFileToStorage(newFile, upload.id, kind, fileId, userId);
      await replaceUploadFileAsCustomer({
        uploadId: upload.id,
        orderId: upload.order_id,
        userId,
        kind,
        fileType,
        url,
      });
      const fileList = await fetchCurrentUploadFiles(upload.id);
      setFiles(fileList);
      toast.success('ファイルを差し替えました');
    } catch (e) {
      toast.error('ファイルの差し替えに失敗しました');
    } finally {
      setReplacingKind(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-gray-500">まだアップロードデータがありません。</p>
        <button onClick={() => setCurrentPage('home')} className="text-sm" style={{ color: PINK }}>
          ホームに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setCurrentPage('home')} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">アップロード内容の確認・修正</h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <p className="text-xs text-gray-400">
          {orderName || upload.order_name
            ? `注文番号: ${orderName || upload.order_name}`
            : upload.guest_tf ? 'ゲストアップロード' : '注文番号なし'}
        </p>

        {!editable && (
          <div className="flex items-start gap-2 text-sm bg-orange-50 text-orange-700 rounded-xl p-4">
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              作製がすでに開始されているため、このページからの修正はできません。
              内容の変更が必要な場合は、サポートまでご連絡ください。
            </p>
          </div>
        )}

        {/* 顧客情報 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">お客様情報</h3>
          <Field label="インソール利用者名">
            <input className={inputClass} value={insoleUserName} disabled={!editable} onChange={(e) => setInsoleUserName(e.target.value)} />
          </Field>
          <Field label="ふりがな">
            <input className={inputClass} value={insoleUserKana} disabled={!editable} onChange={(e) => setInsoleUserKana(e.target.value)} />
          </Field>
          <Field label="電話番号">
            <input className={inputClass} value={ci('phone')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, phone: e.target.value }))} />
          </Field>
        </div>

        {/* 配送先情報 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">配送先情報</h3>
          <Field label="郵便番号">
            <input className={inputClass} value={ci('postalCode')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, postalCode: e.target.value }))} />
          </Field>
          <Field label="都道府県">
            <input className={inputClass} value={ci('prefecture')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, prefecture: e.target.value }))} />
          </Field>
          <Field label="市区町村">
            <input className={inputClass} value={ci('city')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, city: e.target.value }))} />
          </Field>
          <Field label="住所">
            <input className={inputClass} value={ci('address')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, address: e.target.value }))} />
          </Field>
          <Field label="建物名">
            <input className={inputClass} value={ci('building')} disabled={!editable} onChange={(e) => setCustomerInfo((c) => ({ ...c, building: e.target.value }))} />
          </Field>
        </div>

        {/* 作製目的 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">作製目的</h3>
          <Field label="目的(カンマ区切り)">
            <input
              className={inputClass}
              value={pi('purposes')}
              disabled={!editable}
              onChange={(e) => setPurposeInfo((p) => ({ ...p, purposes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
            />
          </Field>
          <Field label="ライフスタイル">
            <input className={inputClass} value={pi('lifestyle')} disabled={!editable} onChange={(e) => setPurposeInfo((p) => ({ ...p, lifestyle: e.target.value }))} />
          </Field>
          <Field label="その他">
            <input className={inputClass} value={pi('otherPurpose')} disabled={!editable} onChange={(e) => setPurposeInfo((p) => ({ ...p, otherPurpose: e.target.value }))} />
          </Field>
        </div>

        {/* 靴情報(選択中のインソール種別ごと) */}
        {(upload.selected_insoles ?? []).map((insoleKind) => (
          <div key={insoleKind} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-3">靴情報({insoleKind})</h3>
            <Field label="ブランド">
              <input
                className={inputClass}
                value={shoeField(insoleKind, 'brand')}
                disabled={!editable}
                onChange={(e) => setShoeInfos((s) => ({ ...s, [insoleKind]: { ...s[insoleKind], brand: e.target.value } }))}
              />
            </Field>
            <Field label="サイズ">
              <input
                className={inputClass}
                value={shoeField(insoleKind, 'size')}
                disabled={!editable}
                onChange={(e) => setShoeInfos((s) => ({ ...s, [insoleKind]: { ...s[insoleKind], size: e.target.value } }))}
              />
            </Field>
          </div>
        ))}

        {/* 痛み・タコ: 現状表示 + 修正要望の自由記述(暫定対応) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">痛み・タコ/魚の目について</h3>
          <p className="text-xs text-gray-400 mb-2">
            現在登録されている内容を変更したい場合は、下記に修正・追加内容をご記入ください。担当スタッフが確認のうえ反映いたします。
          </p>
          <Field label="修正・追加のご要望(痛み)">
            <textarea
              className="w-full rounded-xl border-2 border-gray-200 text-sm p-3 min-h-[80px]"
              disabled={!editable}
              value={painNote}
              onChange={(e) => setPainNote(e.target.value)}
            />
          </Field>
          <Field label="修正・追加のご要望(タコ・魚の目)">
            <textarea
              className="w-full rounded-xl border-2 border-gray-200 text-sm p-3 min-h-[80px]"
              disabled={!editable}
              value={takoNote}
              onChange={(e) => setTakoNote(e.target.value)}
            />
          </Field>
        </div>

        {/* 写真・動画の差し替え */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-3">アップロード済みの写真・動画</h3>
          {files.length === 0 ? (
            <p className="text-xs text-gray-400">ファイルがありません</p>
          ) : (
            files.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-600">{f.kind}</span>
                {editable && (
                  <label className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md cursor-pointer" style={{ color: PINK, border: `1px solid ${PINK}55` }}>
                    {replacingKind === f.kind ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                    差し替え
                    <input
                      type="file"
                      accept={f.file_type === 'video' ? 'video/*' : 'image/*'}
                      className="hidden"
                      onChange={(e) => {
                        const nf = e.target.files?.[0];
                        e.target.value = '';
                        if (nf) handleReplaceFile(f.kind ?? 'unknown', f.file_type ?? 'image', nf);
                      }}
                    />
                  </label>
                )}
              </div>
            ))
          )}
        </div>

        {editable && (
          <PinkButton fullWidth size="lg" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            修正内容を保存する
          </PinkButton>
        )}
      </div>
    </div>
  );
}
