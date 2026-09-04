// ============================================================
// SPIRAL TURN - Supabase クライアント設定（upload-center）
// Green Supabase: fhamrkmsxidxayaoexso
// ============================================================
import { createClient } from '@supabase/supabase-js';
import type { AccountProfile } from '@/contexts/UploadContext';

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
  guest_tf: boolean | null;
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

/** upload ID で直接取得(注文に紐付かないゲストアップロード等の確認・修正用) */
export async function fetchUploadById(uploadId: string): Promise<UploadFullRecord | null> {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .maybeSingle();
  if (error) return null;
  return data as UploadFullRecord | null;
}

/**
 * 修正可否の判定。production_workflows の measure_done / analy_done / design_done の
 * いずれかが立っていれば「作製(計測・動作分析・設計)が開始済み」とみなし、
 * 顧客側の修正・差し替えを禁止する(2026-09-04 冨永社長: 設計開始も含める)。
 * 工程レコードが無ければ未着手として修正可。
 */
export async function canCustomerEditUpload(uploadId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('production_workflows')
    .select('measure_done, analy_done, design_done')
    .eq('upload_id', uploadId)
    .maybeSingle();
  if (error || !data) return true;
  return !(data.measure_done || data.analy_done || data.design_done);
}

/**
 * uploads_files.url を「表示できる URL」に解決する。
 *   - すでに http(s):// なら そのまま
 *   - それ以外(Storage の相対パス)は upsys バケットの署名付き URL(1時間)。
 *     署名に失敗したらバケット公開 URL にフォールバック。
 */
export async function getUploadFileUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  try {
    const { data, error } = await supabase.storage.from('upsys').createSignedUrl(pathOrUrl, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch { /* fallthrough */ }
  const pub = supabase.storage.from('upsys').getPublicUrl(pathOrUrl);
  return pub.data.publicUrl ?? null;
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
  // PostgrestError は素のオブジェクトで instanceof Error が false。
  // そのまま throw すると呼び出し側の汎用メッセージに潰れて原因が分からなくなる。
  if (error) {
    throw new Error(
      `replace_upload_file 失敗 [${error.code ?? '?'}] ${error.message}` +
      `${error.details ? ` / ${error.details}` : ''}` +
      `${error.hint ? ` / hint: ${error.hint}` : ''}`,
    );
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
// アカウント情報(public.users)の永続化
//   AccountProfilePage の入力を React state だけでなく public.users に保存し、
//   再サインイン時に復元できるようにする(2026-09-04 冨永社長指摘)。
//   保存先 = ログインユーザーの public.users 行(migration 008 の同期トリガーで必ず存在)。
//   RLS: users_select_own / users_update_own(auth.uid() = auth_user_id)経由。
//
//   ⚠️ 氏名の対応に注意: AccountProfile の firstName ラベルは「姓」、lastName は「名」
//   (このアプリ独自の命名)。public.users は last_name=姓 / first_name=名。
//   → firstName↔last_name / lastName↔first_name で入れ替えてマップする。
// ============================================================

/** ログインセッションの email を返す(注文照合キー) */
export async function getSessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

const PROFILE_USER_COLUMNS =
  'last_name, first_name, last_name_kana, first_name_kana, phone, is_overseas, ' +
  'postal_code, prefecture, city, address_line1, address_line2, ' +
  'country, overseas_zip, overseas_state, overseas_city, overseas_address';

/** public.users の行 → AccountProfile 形へ */
function rowToProfile(r: Record<string, unknown>): AccountProfile {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    firstName: s(r.last_name),          // 姓
    lastName: s(r.first_name),          // 名
    firstNameKana: s(r.last_name_kana), // 姓カナ
    lastNameKana: s(r.first_name_kana), // 名カナ
    phone: s(r.phone),
    isOverseas: Boolean(r.is_overseas),
    postalCode: s(r.postal_code),
    prefecture: s(r.prefecture),
    city: s(r.city),
    address: s(r.address_line1),
    building: s(r.address_line2),
    country: s(r.country),
    overseasZip: s(r.overseas_zip),
    overseasState: s(r.overseas_state),
    overseasCity: s(r.overseas_city),
    overseasAddress: s(r.overseas_address),
  };
}

/** AccountProfile → public.users の更新用オブジェクトへ */
function profileToRow(p: AccountProfile): Record<string, unknown> {
  return {
    last_name: p.firstName,
    first_name: p.lastName,
    last_name_kana: p.firstNameKana,
    first_name_kana: p.lastNameKana,
    phone: p.phone,
    is_overseas: p.isOverseas,
    postal_code: p.postalCode,
    prefecture: p.prefecture,
    city: p.city,
    address_line1: p.address,
    address_line2: p.building,
    country: p.country,
    overseas_zip: p.overseasZip,
    overseas_state: p.overseasState,
    overseas_city: p.overseasCity,
    overseas_address: p.overseasAddress,
    updated_at: new Date().toISOString(),
  };
}

/** ログインユーザーのアカウント情報を public.users から読む。未登録(氏名空)なら null */
export async function fetchMyProfile(): Promise<AccountProfile | null> {
  const { data: sess } = await supabase.auth.getSession();
  const authUid = sess.session?.user?.id;
  if (!authUid) return null;
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_USER_COLUMNS)
    .eq('auth_user_id', authUid)
    .maybeSingle();
  if (error || !data) return null;
  const prof = rowToProfile(data as unknown as Record<string, unknown>);
  // 姓も名も空 = まだ登録していない扱い(HomePage の「未登録」バッジ用)
  if (!prof.firstName && !prof.lastName) return null;
  return prof;
}

/** ログインユーザーのアカウント情報を public.users に保存(UPDATE。行は 008 トリガーで必ずある) */
export async function saveMyProfile(profile: AccountProfile): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const authUid = sess.session?.user?.id;
  if (!authUid) throw new Error('サインインが必要です');
  const { error } = await supabase
    .from('users')
    .update(profileToRow(profile))
    .eq('auth_user_id', authUid);
  if (error) {
    throw new Error(`アカウント情報の保存に失敗 [${error.code ?? '?'}] ${error.message}`);
  }
}

// ============================================================
// ホームの「注文一覧」= 決済済み注文とアップロード状態の突合
//   仕様(Bacon_Brain/20_技術・システム/決済とアップロードの連動.md / docs/28):
//   dealer/customer-insole-order で発注 + Stripe 決済完了 → orders に行ができ、
//   決済メール(orders.customer_email)がサインインユーザーと一致する注文を、
//   uploads の有無・状態で3分類する。
//     - needing    : 決済済みだが完了アップロードが無い(未着手)
//     - inProgress : uploads.status='draft' 行がある(途中離脱)
//     - completed  : uploads.status IN ('submitted','done')
//   「決済済み」= orders.status IN ('confirmed','processing','completed')
// ============================================================
export interface DashboardOrder {
  id: string;                   // React key。実注文なら注文ID、注文なし(ゲスト等)なら uploadId
  orderId: string | null;       // 実注文ID。注文に紐付かないアップロードは null
  orderName: string | null;
  status: string | null;
  createdAt: string | null;     // 注文日(orders.created_at)。needing カードで「注文日」として表示
  insoleKinds: string[];        // ['walk','room'] 等。表示は「歩き用・ルーム用のアップロードが必要です」
  roomShoes: boolean;
  isGuest: boolean;             // ゲストアップロード(uploads.guest_tf)
}
// ※ アップロード関連の一覧は必ず日付を表示する(冨永社長ルール・2026-09-04。
//    Bacon_Brain/20_技術・システム/顧客データ改訂ポリシー.md 参照)。
export interface DashboardInProgress extends DashboardOrder {
  uploadId: string;
  uploadedKinds: string[];      // これまでにアップロード済みのファイル種別(進捗表示用)
  uploadStartedAt: string | null;   // アップロード開始日時(uploads.created_at)
  interruptedAt: string | null;     // 中断日時 ≒ 最後に操作した日時(uploads.updated_at)
}
export interface DashboardCompleted extends DashboardOrder {
  uploadId: string;
  uploadStatus: string | null;
  uploadStartedAt: string | null;   // アップロード開始日時(uploads.created_at)
  completedAt: string | null;       // 完了日時 ≒ 提出時の更新日時(uploads.updated_at)
}
export interface OrderDashboard {
  needing: DashboardOrder[];
  inProgress: DashboardInProgress[];
  completed: DashboardCompleted[];
}

const PAID_STATUSES = ['confirmed', 'processing', 'completed'];

export async function fetchOrderDashboard(): Promise<OrderDashboard> {
  const empty: OrderDashboard = { needing: [], inProgress: [], completed: [] };
  const email = await getSessionEmail();
  const myCustomerId = await fetchMyCustomerId();
  if (!email && !myCustomerId) return empty;

  const out: OrderDashboard = { needing: [], inProgress: [], completed: [] };
  const kindsByUpload = new Map<string, Set<string>>();

  // draft の uploads のファイル種別を埋めるヘルパー(進捗表示用)
  const loadKinds = async (uploadIds: string[]) => {
    if (!uploadIds.length) return;
    const { data: ufs } = await supabase
      .from('uploads_files')
      .select('upload_id, kind')
      .in('upload_id', uploadIds)
      .eq('is_current', true);
    (ufs ?? []).forEach(f => {
      const set = kindsByUpload.get(f.upload_id) ?? new Set<string>();
      if (f.kind) set.add(f.kind);
      kindsByUpload.set(f.upload_id, set);
    });
  };

  // ========== A) 決済済み注文 × その uploads ==========
  let oq = supabase
    .from('orders')
    .select('id, order_name, insole1_kind, insole2_kind, room_shoes, status, created_at')
    .in('status', PAID_STATUSES)
    .order('created_at', { ascending: false });
  oq = email ? oq.eq('customer_email', email) : oq.eq('user_id', myCustomerId as string);
  const { data: orders, error: oErr } = await oq;
  if (oErr) throw oErr;
  const list = orders ?? [];

  if (list.length > 0) {
    const orderIds = list.map(o => o.id);
    const { data: ups } = await supabase
      .from('uploads')
      .select('id, order_id, status, guest_tf, created_at, updated_at')
      .in('order_id', orderIds);
    const upByOrder = new Map<string, { id: string; status: string | null; guest_tf: boolean | null; created_at: string | null; updated_at: string | null }[]>();
    (ups ?? []).forEach(u => {
      if (!u.order_id) return;
      const arr = upByOrder.get(u.order_id) ?? [];
      arr.push(u);
      upByOrder.set(u.order_id, arr);
    });
    await loadKinds((ups ?? []).filter(u => u.status === 'draft').map(u => u.id));

    for (const o of list) {
      const base: DashboardOrder = {
        id: o.id,
        orderId: o.id,
        orderName: o.order_name,
        status: o.status,
        createdAt: o.created_at,
        insoleKinds: [o.insole1_kind, o.insole2_kind].filter(Boolean) as string[],
        roomShoes: Boolean(o.room_shoes),
        isGuest: false,
      };
      const us = upByOrder.get(o.id) ?? [];
      const done = us.find(u => u.status === 'submitted' || u.status === 'done');
      const draft = us.find(u => u.status === 'draft');
      if (done) {
        out.completed.push({
          ...base, uploadId: done.id, uploadStatus: done.status,
          uploadStartedAt: done.created_at, completedAt: done.updated_at,
        });
      } else if (draft) {
        out.inProgress.push({
          ...base, uploadId: draft.id, uploadedKinds: Array.from(kindsByUpload.get(draft.id) ?? []),
          uploadStartedAt: draft.created_at, interruptedAt: draft.updated_at,
        });
      } else {
        out.needing.push(base);
      }
    }
  }

  // ========== B) 注文に紐付かない自分のアップロード(ゲスト / ホームから開始) ==========
  if (myCustomerId) {
    const { data: orphans } = await supabase
      .from('uploads')
      .select('id, order_name, selected_insoles, status, guest_tf, created_at, updated_at')
      .eq('user_id', myCustomerId)
      .is('order_id', null)
      .order('created_at', { ascending: false });
    await loadKinds((orphans ?? []).filter(u => u.status === 'draft').map(u => u.id));

    for (const u of orphans ?? []) {
      const base: DashboardOrder = {
        id: u.id,
        orderId: null,
        orderName: u.order_name ?? null,
        status: null,
        createdAt: u.created_at,
        insoleKinds: (u.selected_insoles ?? []) as string[],
        roomShoes: false,
        isGuest: Boolean(u.guest_tf),
      };
      if (u.status === 'submitted' || u.status === 'done') {
        out.completed.push({
          ...base, uploadId: u.id, uploadStatus: u.status,
          uploadStartedAt: u.created_at, completedAt: u.updated_at,
        });
      } else if (u.status === 'draft') {
        out.inProgress.push({
          ...base, uploadId: u.id, uploadedKinds: Array.from(kindsByUpload.get(u.id) ?? []),
          uploadStartedAt: u.created_at, interruptedAt: u.updated_at,
        });
      }
      // 注文なしの needing は概念上あり得ない(注文が無いのに「必要」とは言えない)ので無視
    }
  }

  // 3バケットとも「新しいもの順」に並べる(セクションA=注文, B=注文なし を合わせて日時でソート)
  const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
  out.needing.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  out.inProgress.sort(
    (a, b) => ts(b.interruptedAt ?? b.uploadStartedAt ?? b.createdAt) - ts(a.interruptedAt ?? a.uploadStartedAt ?? a.createdAt),
  );
  out.completed.sort(
    (a, b) => ts(b.completedAt ?? b.uploadStartedAt ?? b.createdAt) - ts(a.completedAt ?? a.uploadStartedAt ?? a.createdAt),
  );

  return out;
}

// ============================================================
// 途中まで進んだアップロードを「続きから」再開するためのロード
//   uploads 行の JSON 各列 + uploads_files(is_current)を返し、
//   UploadContext.resumeUploadSession が UploadData 形へ流し込む。
// ============================================================
export interface ResumeSnapshot {
  upload: UploadFullRecord;
  files: { id: string; kind: string | null; file_type: string | null; insole_sku: string | null; url: string | null }[];
}
export async function fetchUploadForResume(uploadId: string): Promise<ResumeSnapshot> {
  const { data: up, error } = await supabase.from('uploads').select('*').eq('id', uploadId).single();
  if (error) throw new Error(`アップロードの読み込みに失敗 [${error.code ?? '?'}] ${error.message}`);
  const { data: files } = await supabase
    .from('uploads_files')
    .select('id, kind, file_type, insole_sku, url')
    .eq('upload_id', uploadId)
    .eq('is_current', true);
  return { upload: up as UploadFullRecord, files: files ?? [] };
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
