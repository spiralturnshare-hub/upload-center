// ============================================================
// SPIRAL TURN - Supabase クライアント設定（upload-center）
// Green Supabase: fhamrkmsxidxayaoexso
// ============================================================
import { createClient } from '@supabase/supabase-js';

// 2026-09-04: Legacy anon JWT のハードコード fallback を撤去(docs/35 WS-B / docs/36 §2)。
//   Green の Legacy JWT Secret 露出の是正で新 API キー体系へ移行。旧 anon JWT をソース・git 履歴に残さない。
//   env 未設定なら即エラー(静かに旧キーで動くより気づける)。VITE_SUPABASE_ANON_KEY = 新 publishable キー。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を環境変数(Vercel)に設定してください。' +
      'VITE_SUPABASE_ANON_KEY = 新 publishable キー(sb_publishable_...)。',
  );
}

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

// ============================================================
// 顧客ID(public.users.id)をセッションから解決する
//   uploads.user_id / uploads_files 系の FK は public.users.id を指す(auth.uid() ではない)。
//   migration 008 のトリガーで、ログイン済みユーザーには必ず public.users 行が存在する。
//   RLS users_select_own(auth.uid() = auth_user_id)で自分の行だけ引ける。
//
// 【過去の失敗と対策 (2026-08-28)】
//   ログイン直後に「アップロードの開始に失敗しました」が出ていた。原因は、
//   Context の customerId がセッション監視の非同期解決待ちで null のまま、
//   利用者が「アップロードを開始」を先にタップしていたこと(競合)。
//   対策として本関数を「呼び出し時に必ず解決を試みる」堅牢版にし、
//   initUploadSession からは毎回これを await するようにした(state に依存しない)。
//   - getSession()(ローカル読み)で取れなければ getUser()(サーバ確認)にフォールバック
//   - 直後は稀に users 行の可視化が遅れるため 1 回だけ短いリトライ
// ============================================================
// 直近の解決失敗理由(initUploadSession のエラーメッセージに載せて原因を可視化する)
export let lastCustomerIdDiag = '';

export async function fetchMyCustomerId(): Promise<string | null> {
  // (1) authUid をローカルセッション → サーバ確認 の順で得る
  let authUid: string | undefined;
  const { data: sess } = await supabase.auth.getSession();
  authUid = sess.session?.user?.id;
  if (!authUid) {
    const { data: usr } = await supabase.auth.getUser();
    authUid = usr.user?.id;
  }
  if (!authUid) {
    lastCustomerIdDiag = 'authUid なし(getSession/getUser ともに空。セッション未確立)';
    return null;
  }

  // (2) public.users.id を引く。取れなければ 1 回だけリトライ
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUid)
      .maybeSingle();
    if (error) {
      lastCustomerIdDiag = `users参照エラー [${error.code ?? '?'}] ${error.message} (authUid=${authUid})`;
      console.error('public.users 解決エラー:', error);
      return null;
    }
    if (data?.id) { lastCustomerIdDiag = ''; return data.id; }
    if (attempt === 0) await new Promise(r => setTimeout(r, 400));
  }
  lastCustomerIdDiag = `users に auth_user_id=${authUid} の行が無い(008トリガー/バックフィル未反映?)`;
  return null;
}

// ============================================================
// アップロード開始時に uploads 行を draft で先に作る
//   従来は Step8 でしか作っておらず、Step1〜7 の uploads_files INSERT が
//   FK(uploads_files.upload_id → uploads.id)違反で全て失敗していた。
//   RLS uploads_insert_own が user_id ∈ 自分の public.users.id を要求するため、
//   customerId(= public.users.id)を必ず入れる。
//   冪等: 同じ id で再実行しても upsert で重複を作らない。
// ============================================================
export async function ensureUploadRow(params: {
  uploadId: string;
  customerId: string | null;
  orderId: string | null;
  orderName: string | null;
  selectedInsoles: string[];
  isGuest: boolean;
}) {
  const { uploadId, customerId, orderId, orderName, selectedInsoles, isGuest } = params;
  if (!customerId) {
    throw new Error('顧客ID未取得: public.users 行が引けませんでした（セッションは有効な可能性）。再ログインしてください。');
  }
  const { error } = await supabase
    .from('uploads')
    .upsert(
      {
        id: uploadId,
        user_id: customerId,
        // 空文字が来ても uuid 列に渡さない(呼び出し側で正規化済みだが二重防御)
        order_id: orderId || null,
        order_name: orderName || null,
        selected_insoles: selectedInsoles ?? [],
        guest_tf: isGuest,
        status: 'draft',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  // Supabase の error は PostgrestError(素のオブジェクト)で instanceof Error が false。
  // そのまま throw すると呼び出し側の `e instanceof Error` 判定を通らず、
  // 汎用メッセージに潰れて原因が分からなくなる → 実コード/詳細を Error にして投げる。
  if (error) {
    throw new Error(
      `uploads作成失敗 [${error.code ?? '?'}] ${error.message}` +
      `${error.details ? ` / ${error.details}` : ''}` +
      `${error.hint ? ` / hint: ${error.hint}` : ''}` +
      ` (user_id=${customerId})`,
    );
  }
}

// uploads 行の本更新(Step8 の確定時。従来 insertUpload していたのを update へ)
export async function updateUpload(id: string, fields: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('uploads')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
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
// 顧客によるデータ修正・追加(改訂履歴ポリシー対応)
// 方針: docs/10-customer-mgmt-console-vision-and-data-revision-policy.md (spiralturn-green-integration)
// 顧客は「作製アクション(計測・動作分析)が開始される前」までのみ修正可能。
// 開始後はcustomer-mgmt-console側(スタッフ)のみ修正可能。
// 上書き・削除はせず、update_upload_with_history/replace_upload_file(RPC)経由で
// 変更前スナップショットを必ず残してから更新する。
// ============================================================
export interface UploadFullRecord {
  id: string;
  order_id: string | null;
  user_id: string | null;
  organization_id: string | null;
  order_name: string | null;
  selected_insoles: string[] | null;
  status: string | null;
  insole_user_name: string | null;
  insole_user_kana: string | null;
  room_color: string | null;
  shoe_infos: Record<string, unknown> | null;
  pain_info: Record<string, unknown> | null;
  purpose_info: Record<string, unknown> | null;
  tako_info: Record<string, unknown> | null;
  customer_info: Record<string, unknown> | null;
}

/** 注文IDに紐づく既存のアップロードを取得(無ければnull。初回アップロードかどうかの判定に使う) */
export async function fetchUploadByOrderId(orderId: string): Promise<UploadFullRecord | null> {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) return null;
  return data as UploadFullRecord | null;
}

/**
 * 修正可否の判定。production_workflowsのmeasure_doneまたはanaly_doneが
 * 立っていれば「作製アクション開始済み」とみなし、顧客側の修正を禁止する。
 */
export async function canCustomerEditUpload(uploadId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('production_workflows')
    .select('measure_done, analy_done')
    .eq('upload_id', uploadId)
    .maybeSingle();
  if (error || !data) return true; // 工程レコードが無ければ未着手なので修正可
  return !(data.measure_done || data.analy_done);
}

export async function fetchCurrentUploadFiles(uploadId: string): Promise<
  { id: string; kind: string | null; file_type: string | null; url: string | null; updated_at: string | null }[]
> {
  const { data, error } = await supabase
    .from('uploads_files')
    .select('id, kind, file_type, url, updated_at')
    .eq('upload_id', uploadId)
    .eq('is_current', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** uploadsを顧客として更新する唯一の正式な経路(RPC経由、変更前スナップショットを自動保存) */
export async function updateUploadAsCustomer(
  uploadId: string,
  patch: Partial<
    Pick<UploadFullRecord, 'insole_user_name' | 'insole_user_kana' | 'room_color' | 'shoe_infos' | 'pain_info' | 'purpose_info' | 'tako_info' | 'customer_info'>
  >,
  userId: string | null,
  reason?: string
): Promise<UploadFullRecord> {
  const { data, error } = await supabase.rpc('update_upload_with_history', {
    p_upload_id: uploadId,
    p_patch: patch,
    p_changed_by_type: 'customer',
    p_changed_by_id: userId,
    p_change_reason: reason ?? null,
  });
  if (error) throw error;
  return data as UploadFullRecord;
}

/** 写真・動画を顧客として差し替える唯一の正式な経路(RPC経由、旧ファイルはis_current=falseで保持) */
export async function replaceUploadFileAsCustomer(params: {
  uploadId: string;
  orderId: string | null;
  userId: string | null;
  kind: string;
  fileType: string;
  url: string;
}): Promise<void> {
  const { error } = await supabase.rpc('replace_upload_file', {
    p_upload_id: params.uploadId,
    p_order_id: params.orderId,
    p_user_id: params.userId,
    p_kind: params.kind,
    p_file_type: params.fileType,
    p_url: params.url,
    p_changed_by_type: 'customer',
    p_changed_by_id: params.userId,
  });
  if (error) throw error;
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
  user_id?: string | null;   // 使わない(下記コメント参照)。互換のため受けるだけ
  file_type: string;         // 'video' | 'image'
  kind: string;              // file_kind enum: foot/walk/oneleg/sidejump/running/swing/shoes/... (008で拡張済み)
  url: string;
  insole_sku?: string | null; // 靴の画像などインソール種別に紐づく場合(uploads_files.insole_sku)
  status?: string;
}) {
  // uploads_files.user_id は public.users.id への FK。auth.uid() は users.id ではないので
  // ここに入れると FK 違反になる。親 uploads 行が user_id を保持しているので null で良い
  // (RLS「authenticated can select own uploads_files」も user_id IS NULL を許容している)。
  const { data, error } = await supabase
    .from('uploads_files')
    .insert({
      upload_id: record.upload_id,
      order_id: record.order_id,
      user_id: null,
      file_type: record.file_type,
      kind: record.kind,
      url: record.url,
      insole_sku: record.insole_sku ?? null,
      status: record.status ?? 'uploaded',  // 従来値を維持(text列。enum ではない)
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}
