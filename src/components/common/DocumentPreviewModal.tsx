'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, Image, File, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Storage path (file_url or file_path column) */
  filePath: string;
  /** Original file name for download */
  fileName: string;
  /** MIME type (optional, auto-detected from extension if missing) */
  mimeType?: string | null;
  /** Document title to display */
  title?: string;
  /** Supabase storage bucket name */
  bucket: 'documents' | 'child-documents';
  /** Callback when document is viewed (e.g., mark as read) */
  onViewed?: () => void;
}

function getMimeFromFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] || 'application/octet-stream';
}

function getFileCategory(mime: string): 'pdf' | 'image' | 'office' | 'other' {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (
    mime.includes('msword') ||
    mime.includes('wordprocessingml') ||
    mime.includes('ms-excel') ||
    mime.includes('spreadsheetml')
  ) return 'office';
  return 'other';
}

function FileIcon({ category }: { category: ReturnType<typeof getFileCategory> }) {
  switch (category) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'image':
      return <Image className="w-5 h-5 text-blue-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  filePath,
  fileName,
  mimeType,
  title,
  bucket,
  onViewed,
}: DocumentPreviewModalProps) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize mimeType: handle short values like "pdf" from DB as well as proper MIME strings
  const normalizedMime = (() => {
    if (!mimeType) return getMimeFromFileName(fileName);
    // If mimeType looks like a proper MIME (contains "/"), use as-is
    if (mimeType.includes('/')) return mimeType;
    // Otherwise treat it as a file extension and resolve
    const extMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return extMap[mimeType.toLowerCase()] || getMimeFromFileName(fileName);
  })();
  const category = getFileCategory(normalizedMime);

  const loadPreview = useCallback(async () => {
    if (!filePath) {
      setError('ファイルパスが見つかりません');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (category === 'pdf' || category === 'image') {
        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

        // Download as blob and create object URL for reliable iframe rendering
        // (signed URLs can fail in iframes due to CORS/CSP restrictions)
        const { data, error: dlError } = await supabase.storage
          .from(bucket)
          .download(cleanPath);

        if (dlError) throw new Error(dlError.message);
        if (!data) throw new Error('ファイルの取得に失敗しました');

        const blobUrl = URL.createObjectURL(data);
        setPreviewUrl(blobUrl);
      }

      onViewed?.();
    } catch (err: any) {
      console.error('Preview load error:', err);
      setError(err.message || 'プレビューの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [filePath, bucket, category, onViewed]);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    } else {
      // Clean up blob URL to prevent memory leaks
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setError(null);
    }
  }, [isOpen, loadPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanFilePath = filePath?.startsWith('/') ? filePath.slice(1) : (filePath || '');

  const handleDownload = async () => {
    try {
      const { data, error: dlError } = await supabase.storage
        .from(bucket)
        .download(cleanFilePath);

      if (dlError) throw dlError;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('ダウンロードに失敗しました');
    }
  };

  const handleOpenInNewTab = async () => {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanFilePath, 300, { download: false });
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex flex-col z-[9999]" role="dialog" aria-modal="true">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 text-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon category={category} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {title || fileName}
            </p>
            {title && title !== fileName && (
              <p className="text-xs text-gray-400 truncate">{fileName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOpenInNewTab}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="別タブで開く"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            ダウンロード
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">読み込み中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-white max-w-sm text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm">{error}</p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm mt-2"
            >
              <Download className="w-4 h-4" />
              ダウンロードして確認
            </button>
          </div>
        ) : category === 'pdf' && previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full bg-white"
            title={title || fileName}
          />
        ) : category === 'image' && previewUrl ? (
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={previewUrl}
              alt={title || fileName}
              className="max-w-full max-h-full object-contain rounded shadow-lg"
            />
          </div>
        ) : (
          /* Office docs / other files - download only */
          <div className="flex flex-col items-center gap-4 text-white max-w-sm text-center">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <FileIcon category={category} />
            </div>
            <div>
              <p className="font-medium">{fileName}</p>
              <p className="text-sm text-gray-400 mt-1">
                このファイル形式はブラウザ内でプレビューできません
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-lg transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              ダウンロードして開く
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
