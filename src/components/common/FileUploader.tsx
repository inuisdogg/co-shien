/**
 * FileUploader - ドラッグ&ドロップ対応ファイルアップロードコンポーネント
 * Supabase Storageを使用してファイルを保存
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FileUploaderProps {
  bucket: string; // Supabase Storage bucket name
  folder?: string; // Optional folder path within bucket
  onUpload: (url: string, fileName: string) => void;
  onError?: (error: string) => void;
  accept?: string; // e.g., ".pdf,.doc,.docx" or "image/*"
  maxSizeMB?: number;
  label?: string;
  currentFile?: { url: string; name: string } | null;
  onRemove?: () => void;
}

export default function FileUploader({
  bucket,
  folder = '',
  onUpload,
  onError,
  accept = '.pdf,.doc,.docx,.xls,.xlsx',
  maxSizeMB = 10,
  label = 'ファイルをアップロード',
  currentFile,
  onRemove,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `ファイルサイズは${maxSizeMB}MB以下にしてください`;
    }

    // Check file type if accept is specified
    if (accept && accept !== '*') {
      const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileMime = file.type.toLowerCase();

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExt === type;
        }
        if (type.endsWith('/*')) {
          return fileMime.startsWith(type.replace('/*', '/'));
        }
        return fileMime === type;
      });

      if (!isAccepted) {
        return `許可されていないファイル形式です。対応形式: ${accept}`;
      }
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = folder
        ? `${folder}/${timestamp}_${sanitizedName}`
        : `${timestamp}_${sanitizedName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        onUpload(urlData.publicUrl, file.name);
        setUploadProgress(100);
      } else {
        throw new Error('公開URLの取得に失敗しました');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.message || 'アップロードに失敗しました';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleRemove = () => {
    setError(null);
    setUploadProgress(0);
    onRemove?.();
  };

  // Show current file if exists
  if (currentFile) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getFileIcon(currentFile.name)}
            <div>
              <p className="font-medium text-gray-800 text-sm">{currentFile.name}</p>
              <a
                href={currentFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#00c4cc] hover:underline"
              >
                ファイルを開く
              </a>
            </div>
          </div>
          {onRemove && (
            <button
              onClick={handleRemove}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="削除"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-[#00c4cc] bg-[#00c4cc]/5'
            : 'border-gray-300 hover:border-[#00c4cc] hover:bg-gray-50'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-[#00c4cc] mx-auto animate-spin" />
            <p className="text-sm text-gray-600">アップロード中...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
              <div
                className="bg-[#00c4cc] h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className={`w-10 h-10 mx-auto ${isDragging ? 'text-[#00c4cc]' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-500">
              ドラッグ&ドロップ または クリックして選択
            </p>
            <p className="text-xs text-gray-400">
              対応形式: {accept} / 最大{maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
