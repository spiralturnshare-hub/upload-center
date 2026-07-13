// ============================================================
// Design: ビビッド・フォーム
// insoleConfig.ts: インソール種別の定義とrequirements_upload_files相当のハードコード設定
//
// 元のDartシステムでは Supabase の requirements_upload_files テーブルから
// 動的に取得していた設定をここにハードコードしています。
// DB連携時はこのファイルをAPI呼び出しに置き換えてください。
//
// ※ 2025-05 修正済みExcel（insole_type_list修正.xlsx）に基づいて更新
//   - sports（汎用）/ kids / kids_thin を削除
//   - 各種別の動画要件を正確に反映
// ============================================================

/** インソール種別（insole_type_list.type の値） */
export type InsoleKind =
  | 'walk'        // 歩き用（フルインソール）
  | 'walk_thin'   // 歩き用（極薄ハーフインソール）
  | 'room'        // ルーム用
  | 'beauty'      // ビューティー用
  | 'golf'        // ゴルフ用
  | 'running'     // ランニング用
  | 'tennis'      // テニス用
  | 'badminton'   // バドミントン用
  | 'football'    // サッカー用
  | 'baseball'    // 野球用
  | 'basketball'  // バスケットボール用
  | 'volleyball'  // バレーボール用
  | 'handball'    // ハンドボール用
  | 'tabletennis' // 卓球用
  | 'snowboard'   // スノーボード用
  | 'training'    // トレーニング用
  | 'combat'      // 格闘技用
  | 'climb';      // 登山用

/** 動画種別 */
export type VideoKind = 'walk' | 'oneleg' | 'sidejump' | 'running' | 'swing';

/** 画像種別 */
export type ImageKind = 'foot' | 'shoes';

/** 質問種別 */
export type QuestionKind = 'daily' | 'normal' | 'sports' | 'golf' | 'beauty';

/** requirements_upload_files テーブルの1行に相当 */
export interface InsoleRequirement {
  kind: string;
  requiredVideoTypes: VideoKind[];
  requiredImageTypes: ImageKind[];
  requiredPurposeQuestionTypes: QuestionKind[];
}

/**
 * requirements_upload_files テーブルのハードコード版
 *
 * 修正済みExcelに基づく正確な設定：
 *
 * | 種別                | 動画                        | 写真          | 質問            |
 * |---------------------|-----------------------------|---------------|-----------------|
 * | walk / walk_thin    | walk + oneleg               | foot + shoes  | daily + normal  |
 * | room                | walk + oneleg               | foot のみ     | daily + normal  |
 * | beauty              | walk + oneleg               | foot + shoes  | beauty          |
 * | golf                | walk + swing                | foot + shoes  | golf            |
 * | running             | walk + running              | foot + shoes  | sports          |
 * | tennis/badminton/   |                             |               |                 |
 * |   football/baseball/|                             |               |                 |
 * |   basketball/       |                             |               |                 |
 * |   volleyball/       |                             |               |                 |
 * |   handball/         |                             |               |                 |
 * |   tabletennis/      | walk + sidejump             | foot + shoes  | sports          |
 * |   snowboard         |                             |               |                 |
 * | training/combat/    | walk + oneleg               | foot + shoes  | sports          |
 * |   climb             |                             |               |                 |
 */
export const INSOLE_REQUIREMENTS: Record<string, InsoleRequirement> = {
  // ---- 歩き用 ----
  walk: {
    kind: 'walk',
    requiredVideoTypes: ['walk', 'oneleg'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['daily', 'normal'],
  },
  // ---- ルーム用 ----
  room: {
    kind: 'room',
    requiredVideoTypes: ['walk', 'oneleg'],
    requiredImageTypes: ['foot'],
    requiredPurposeQuestionTypes: ['daily', 'normal'],
  },
  // ---- ビューティー用 ----
  beauty: {
    kind: 'beauty',
    requiredVideoTypes: ['walk', 'oneleg'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['beauty'],
  },
  // ---- ゴルフ用 ----
  golf: {
    kind: 'golf',
    requiredVideoTypes: ['walk', 'swing'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['golf'],
  },
  // ---- ランニング用 ----
  running: {
    kind: 'running',
    requiredVideoTypes: ['walk', 'running'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['sports'],
  },
  // ---- sidejump系スポーツ（テニス・バドミントン・サッカー・野球・バスケ・バレー・ハンドボール・卓球・スノーボード） ----
  sidejump_sports: {
    kind: 'sidejump_sports',
    requiredVideoTypes: ['walk', 'sidejump'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['sports'],
  },
  // ---- oneleg系スポーツ（トレーニング・格闘技・登山） ----
  oneleg_sports: {
    kind: 'oneleg_sports',
    requiredVideoTypes: ['walk', 'oneleg'],
    requiredImageTypes: ['foot', 'shoes'],
    requiredPurposeQuestionTypes: ['sports'],
  },
};

/**
 * InsoleKind → requirements_upload_files.kind への変換
 * 修正済みExcelに基づく正確なマッピング
 */
export function insoleTypeToRequirementKind(insoleType: InsoleKind): string {
  switch (insoleType) {
    case 'walk':
    case 'walk_thin':
      return 'walk';
    case 'room':
      return 'room';
    case 'beauty':
      return 'beauty';
    case 'golf':
      return 'golf';
    case 'running':
      return 'running';
    // sidejump系スポーツ
    case 'tennis':
    case 'badminton':
    case 'football':
    case 'baseball':
    case 'basketball':
    case 'volleyball':
    case 'handball':
    case 'tabletennis':
    case 'snowboard':
      return 'sidejump_sports';
    // oneleg系スポーツ
    case 'training':
    case 'combat':
    case 'climb':
      return 'oneleg_sports';
    default:
      return 'walk';
  }
}

/** 選択されたインソール種別リストから必要な動画種別を取得（重複除去・順序保持） */
export function getRequiredVideoTypes(selectedInsoles: InsoleKind[]): VideoKind[] {
  const ORDER: VideoKind[] = ['walk', 'oneleg', 'sidejump', 'running', 'swing'];
  const set = new Set<VideoKind>();
  for (const insole of selectedInsoles) {
    const kind = insoleTypeToRequirementKind(insole);
    const req = INSOLE_REQUIREMENTS[kind];
    if (req) req.requiredVideoTypes.forEach(v => set.add(v));
  }
  return ORDER.filter(v => set.has(v));
}

/** 選択されたインソール種別リストから必要な画像種別を取得（重複除去） */
export function getRequiredImageTypes(selectedInsoles: InsoleKind[]): ImageKind[] {
  const set = new Set<ImageKind>();
  for (const insole of selectedInsoles) {
    const kind = insoleTypeToRequirementKind(insole);
    const req = INSOLE_REQUIREMENTS[kind];
    if (req) req.requiredImageTypes.forEach(v => set.add(v));
  }
  return Array.from(set);
}

/** 選択されたインソール種別リストから必要な質問種別を取得（重複除去） */
export function getRequiredQuestionTypes(selectedInsoles: InsoleKind[]): QuestionKind[] {
  const set = new Set<QuestionKind>();
  for (const insole of selectedInsoles) {
    const kind = insoleTypeToRequirementKind(insole);
    const req = INSOLE_REQUIREMENTS[kind];
    if (req) req.requiredPurposeQuestionTypes.forEach(v => set.add(v));
  }
  return Array.from(set);
}

/** インソール種別の表示名 */
export const INSOLE_DISPLAY_NAMES: Record<InsoleKind, string> = {
  walk:        '歩き用（フルインソール）',
  walk_thin:   '歩き用（極薄ハーフインソール）',
  room:        'ルーム用',
  beauty:      'ビューティー用',
  golf:        'ゴルフ用',
  running:     'ランニング用',
  tennis:      'テニス用',
  badminton:   'バドミントン用',
  football:    'サッカー用',
  baseball:    '野球用',
  basketball:  'バスケットボール用',
  volleyball:  'バレーボール用',
  handball:    'ハンドボール用',
  tabletennis: '卓球用',
  snowboard:   'スノーボード用',
  training:    'トレーニング用',
  combat:      '格闘技用',
  climb:       '登山用',
};

/** 動画種別の表示名・説明 */
export const VIDEO_KIND_LABELS: Record<VideoKind, { title: string; description: string }> = {
  walk: {
    title: '歩き方動画',
    description: '壁に沿って歩く様子を真上から撮影してください',
  },
  oneleg: {
    title: '片足立ち動画',
    description: '片足で立った状態を正面から撮影してください',
  },
  sidejump: {
    title: '横方向ジャンプ動画',
    description: '横方向にジャンプする様子を正面から撮影してください',
  },
  running: {
    title: 'ランニング動画',
    description: '走る様子を後方から撮影してください',
  },
  swing: {
    title: 'スイング動画',
    description: 'ゴルフスイングを正面・後方から撮影してください',
  },
};

/** ルーム用シューズの色選択肢 */
export const ROOM_SHOE_COLORS = [
  { value: 'pink', label: 'ピンク' },
  { value: 'light_gray', label: 'ライトグレー' },
  { value: 'navy', label: 'ネイビー' },
];

/** インソール選択UIで表示するグループ */
export const INSOLE_GROUPS: { label: string; items: InsoleKind[] }[] = [
  {
    label: '歩き用・日常',
    items: ['walk', 'walk_thin', 'room', 'beauty'],
  },
  {
    label: 'スポーツ用',
    items: [
      'golf',
      'running',
      'tennis',
      'badminton',
      'football',
      'baseball',
      'basketball',
      'volleyball',
      'handball',
      'tabletennis',
      'snowboard',
      'training',
      'combat',
      'climb',
    ],
  },
];
