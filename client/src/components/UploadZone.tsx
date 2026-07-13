import React, { useRef, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Film, Image } from 'lucide-react';

// ============================================================
// Design: ビビッド・フォーム
// UploadZone: ファイルアップロードエリア
// ============================================================

interface UploadZoneProps {
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  type?: 'video' | 'photo';
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  status?: 'idle' | 'uploading' | 'success' | 'error';
  uploadProgress?: number;
}

export default function UploadZone({
  accept,
  multiple = false,
  label,
  hint,
  type = 'photo',
  files = [],
  onFilesChange,
  status = 'idle',
  uploadProgress = 0,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // クリック時に毎回 input.value をクリアしてから開く
  // → 同じファイルを再選択しても onChange が必ず発火するようにする
  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    inputRef.current?.click();
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const arr = Array.from(newFiles);
    // 処理後も input.value をクリアして次回選択に備える
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    if (multiple) {
      onFilesChange?.([...files, ...arr]);
    } else {
      onFilesChange?.(arr);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    // ファイル削除後も input.value をクリアして再選択できるようにする
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFilesChange?.(files.filter((_, i) => i !== index));
  };

  const Icon = type === 'video' ? Film : Image;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-[#D62598] bg-[#FCE4F4]'
            : 'border-gray-200 bg-gray-50 hover:border-[#D62598] hover:bg-[#FCE4F4]/50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {status === 'uploading' ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#D62598' }} />
            <p className="text-sm font-medium text-gray-600">アップロード中...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, backgroundColor: '#D62598' }}
              />
            </div>
            <p className="text-xs text-gray-400">アップロードには時間がかかる場合があります</p>
          </div>
        ) : status === 'success' ? (
          <div className="flex flex-col items-center gap-2 rounded-xl px-6 py-4" style={{ backgroundColor: '#F0FDF4' }}>
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <p className="text-sm font-semibold text-green-600">アップロード完了</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2">
            <XCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm font-medium text-red-500">アップロードに失敗しました</p>
            <p className="text-xs text-gray-400 mt-1">タップして再試行</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#FCE4F4' }}
            >
              <Icon className="w-7 h-7" style={{ color: '#D62598' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {label || (type === 'video' ? '動画を選択' : '画像を選択')}
              </p>
              {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
              <p className="text-xs text-gray-400 mt-1">
                タップして{type === 'video' ? '動画' : '画像'}を選択
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FCE4F4' }}
              >
                <Icon className="w-4 h-4" style={{ color: '#D62598' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
