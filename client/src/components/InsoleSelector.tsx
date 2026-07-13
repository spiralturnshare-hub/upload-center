import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Plus, Minus } from 'lucide-react';
import type { InsoleKind } from '@/lib/insoleConfig';
import { INSOLE_DISPLAY_NAMES, INSOLE_GROUPS } from '@/lib/insoleConfig';

// ============================================================
// Design: ビビッド・フォーム
// InsoleSelector: インソール種別選択コンポーネント（最大2つ・同一種別2つも可）
// Primary: PANTONE Pink C (#D62598)
//
// 選択ロジック：
//   - 各種別は 0〜2 個まで選択可能
//   - 合計が maxCount（デフォルト2）を超えない範囲で追加できる
//   - 同じ種別を2つ選ぶことも可能（例：歩き用×2）
//   - value は InsoleKind の配列（重複あり）で管理
//     例：['walk', 'walk'] や ['golf', 'walk']
// ============================================================

interface InsoleSelectorProps {
  value: InsoleKind[];
  onChange: (insoles: InsoleKind[]) => void;
  maxCount?: number;
}

export default function InsoleSelector({ value, onChange, maxCount = 2 }: InsoleSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '歩き用・日常': true,
    'スポーツ用': false,
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  /** 指定種別の現在の選択数（0〜2） */
  const countOf = (kind: InsoleKind): number =>
    value.filter(k => k === kind).length;

  /** 指定種別を1つ追加 */
  const addInsole = (kind: InsoleKind) => {
    if (value.length >= maxCount) return;
    onChange([...value, kind]);
  };

  /** 指定種別を1つ減らす */
  const removeOne = (kind: InsoleKind) => {
    const idx = value.lastIndexOf(kind);
    if (idx === -1) return;
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  /** 選択済みバッジから1つ削除（インデックス指定） */
  const removeByIndex = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const totalSelected = value.length;
  const canAddMore = totalSelected < maxCount;

  return (
    <div className="space-y-3">
      {/* ── 選択済みバッジ ── */}
      <div className="min-h-[40px]">
        {value.length === 0 ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 border-dashed w-fit"
            style={{ borderColor: '#D62598', color: '#D62598' }}
          >
            <span>種別を選択してください（必須）</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.map((kind, idx) => (
              <div
                key={`${kind}-${idx}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: '#D62598' }}
              >
                <span
                  className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] font-bold"
                  style={{ color: '#D62598' }}
                >
                  {idx + 1}
                </span>
                <span>{INSOLE_DISPLAY_NAMES[kind]}</span>
                <button
                  onClick={() => removeByIndex(idx)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                  aria-label="削除"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {canAddMore && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 border-dashed"
                style={{ borderColor: '#D62598', color: '#D62598' }}
              >
                <span>+ {maxCount - totalSelected}つ目を選択（任意）</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── グループ別選択リスト ── */}
      <div className="space-y-2">
        {INSOLE_GROUPS.map(group => {
          const groupSelectedCount = group.items.reduce((sum, k) => sum + countOf(k), 0);
          return (
            <div key={group.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* グループヘッダー */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">{group.label}</span>
                <div className="flex items-center gap-2">
                  {groupSelectedCount > 0 && (
                    <span
                      className="text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: '#D62598' }}
                    >
                      {groupSelectedCount}
                    </span>
                  )}
                  {expandedGroups[group.label]
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </button>

              {/* グループ内アイテム */}
              {expandedGroups[group.label] && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                  {group.items.map(kind => {
                    const count = countOf(kind);
                    const isSelected = count > 0;
                    const canAdd = canAddMore;
                    const canAddThis = canAdd || count === 0 ? canAdd : false;

                    return (
                      <div
                        key={kind}
                        className="relative rounded-xl border-2 transition-all duration-150 overflow-hidden"
                        style={{
                          borderColor: isSelected ? '#D62598' : '#E5E7EB',
                          backgroundColor: isSelected ? '#FCE4F4' : 'white',
                        }}
                      >
                        {count === 0 ? (
                          /* 未選択：タップで1つ追加 */
                          <button
                            onClick={() => addInsole(kind)}
                            disabled={!canAddMore}
                            className="w-full h-12 px-3 text-xs font-medium text-left transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: '#374151' }}
                          >
                            {INSOLE_DISPLAY_NAMES[kind]}
                          </button>
                        ) : (
                          /* 選択済み：カウンター表示 */
                          <div className="h-12 px-2 flex items-center justify-between gap-1">
                            <span
                              className="text-xs font-semibold flex-1 leading-tight"
                              style={{ color: '#D62598' }}
                            >
                              {INSOLE_DISPLAY_NAMES[kind]}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* 減らすボタン */}
                              <button
                                onClick={() => removeOne(kind)}
                                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors active:scale-90"
                                style={{ backgroundColor: '#D62598' }}
                                aria-label="1つ減らす"
                              >
                                <Minus className="w-3 h-3 text-white" />
                              </button>
                              {/* カウント表示 */}
                              <span
                                className="w-5 text-center text-sm font-bold"
                                style={{ color: '#D62598' }}
                              >
                                {count}
                              </span>
                              {/* 増やすボタン */}
                              <button
                                onClick={() => addInsole(kind)}
                                disabled={!canAddMore || count >= maxCount}
                                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#D62598' }}
                                aria-label="1つ増やす"
                              >
                                <Plus className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 選択数の案内 */}
      <p className="text-xs text-gray-400 text-center">
        最大{maxCount}つまで選択できます（同じ種別を2つも可）　現在 {totalSelected}/{maxCount}
      </p>
    </div>
  );
}
