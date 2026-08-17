// ============================================================
// SPIRAL TURN - Supabase クライアント設定（upload-center）
// Green Supabase: fhamrkmsxidxayaoexso
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fhamrkmsxidxayaoexso.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1ya21zeGlkeGF5YW9leHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTcwMTMsImV4cCI6MjEwMDI3MzAxM30.7GRn0m2SO3BzNQLQAb8dbREpoC8ewSIMLU2gWMIHp5I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// uploads テーブル操作
// ============================================================
export async function fetchUploadByOrderName(orderName: string) {
  const { data, error } = await supabase
    .from('uploads')
    .select(`
      id, created_at, updated_at, order_id, user_id, organization_id,
      order_name, selected_insoles, status,
      insole_user_name, insole_user_kana,
      guest_tf, previous_design_tf, room_color
    `)
    .eq('order_name', orderName)
    .single();
  if (error) throw error;
  return data;
}

export async function insertUpload(upload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('uploads')
    .insert(upload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUploadStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('uploads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// orders テーブル（注文番号でユーザー認証）
// ============================================================
export async function verifyOrderByPaymentId(paymentId: string, email: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_name, status, customer_email, organization_id')
    .eq('order_name', paymentId)
    .eq('customer_email', email)
    .single();
  if (error) return null;
  return data;
}

// ============================================================
// 取扱店（OEM先）情報の取得
//
// Make の upload_completed シナリオは、取扱店向けメールを送るために
// 次の3項目を必要とする（フィルタ条件および本文で使用）。
//   agency_flg         … orders.agency_flg
//   organization_email … organization.customer_contact_email
//   company            … organization.company_name
//
// これらは UI の状態として保持していないため、通知の直前に取得する。
// 取得に失敗しても例外は投げない。顧客向けメールは送信されるべきなので、
// 通知処理そのものを中断させてはならない。
// ============================================================
export interface OrderAgencyInfo {
  /** 取扱店経由の注文かどうか */
  agencyFlg: boolean;
  /** 取扱店の連絡先メールアドレス。無い場合は空文字 */
  organizationEmail: string;
  /** 取扱店（またはブランド）の会社名。無い場合は空文字 */
  companyName: string;
}

/**
 * 注文IDから取扱店情報を取得する。
 * 失敗時は既定値（agencyFlg=false、他は空文字）を返す。
 */
export async function fetchOrderAgencyInfo(
  orderId: string
): Promise<OrderAgencyInfo> {
  const fallback: OrderAgencyInfo = {
    agencyFlg: false,
    organizationEmail: '',
    companyName: '',
  };
  if (!orderId) return fallback;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(
        'agency_flg, organization:organization_id (company_name, customer_contact_email)'
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error || !data) return fallback;

    // Supabase の外部キー展開はリレーションの形によりオブジェクトか配列で返る
    const row = data as Record<string, unknown>;
    const rawOrg = row.organization;
    const org = (Array.isArray(rawOrg) ? rawOrg[0] : rawOrg) as
      | { company_name?: string | null; customer_contact_email?: string | null }
      | null
      | undefined;

    return {
      agencyFlg: Boolean(row.agency_flg),
      organizationEmail: org?.customer_contact_email ?? '',
      companyName: org?.company_name ?? '',
    };
  } catch {
    return fallback;
  }
}

// ============================================================
// Storage: upsys バケットへのファイルアップロード
// パス形式: {userId}/live/{uploadId}/{kind}/{fileId}/{filename}
// ============================================================

/**
 * ファイルをupsysバケットにアップロードし、storageパスを返す
 * userId が null の場合（ゲスト）は "guest" を使用
 */
export async function uploadFileToStorage(
  file: File,
  uploadId: string,
  kind: string,
  fileId: string,
  userId: string | null
): Promise<{ path: string; url: string }> {
  const userSegment = userId ?? 'guest';
  const ext = file.name.split('.').pop() ?? '';
  const filename = ext ? `${fileId}.${ext}` : fileId;
  const storagePath = `${userSegment}/live/${uploadId}/${kind}/${fileId}/${filename}`;

  const { error } = await supabase.storage
    .from('upsys')
    .upload(storagePath, file, { upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('upsys')
    .getPublicUrl(storagePath);

  return { path: storagePath, url: urlData.publicUrl };
}

// ============================================================
// uploads_files テーブル: ファイルメタデータ INSERT
// ============================================================
export async function insertUploadFile(record: {
  upload_id: string;
  order_id: string | null;
  user_id: string | null;
  file_type: string;   // 'video' | 'image'
  kind: string;        // 'walk' | 'foot' | 'shoe' | etc.
  url: string;
  status?: string;
}) {
  const { data, error } = await supabase
    .from('uploads_files')
    .insert({
      ...record,
      status: record.status ?? 'uploaded',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}
