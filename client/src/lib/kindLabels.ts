// uploads_files.kind → 顧客に見せる日本語ラベル(英語では出さない・冨永社長 2026-09-04)
// EditUploadPage の修正UI と OrderListPage の修正履歴表示で共有する。
export const KIND_LABEL_JP: Record<string, string> = {
  walk: '歩きの動画',
  oneleg: '片足立ち動画',
  sidejump: 'サイドジャンプ動画',
  running: 'ランニング動画',
  swing: 'スイングの動画',
  foot: '足の写真',
  shoes: '靴の写真',
  pain_photo: '痛み・違和感の写真',
  tako_photo: 'タコ・魚の目の写真',
  other: 'その他のデータ',
};

export const kindLabel = (kind: string | null | undefined): string =>
  kind ? KIND_LABEL_JP[kind] ?? kind : 'データ';
