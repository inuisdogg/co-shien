/**
 * CSV一括アップロードパネル
 * 4ステップウィザード: テンプレートDL→プレビュー→確認→結果
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Mail,
  Loader2,
} from 'lucide-react';
import {
  parseStaffCSV,
  validateCSVRows,
  downloadCSVTemplate,
  downloadImportResultCSV,
} from '@/utils/csvBulkImportService';
import type {
  ParsedCSVRow,
  ValidationResult,
  BulkImportResult,
} from '@/types/bulkImport';
import { useToast } from '@/components/ui/Toast';

interface CSVBulkUploadPanelProps {
  onImport: (
    rows: ParsedCSVRow[],
    importType: 'full' | 'minimal',
    sendEmails: boolean
  ) => Promise<BulkImportResult | null>;
  loading?: boolean;
}

type Step = 'upload' | 'preview' | 'confirm' | 'result';

const CSVBulkUploadPanel: React.FC<CSVBulkUploadPanelProps> = ({
  onImport,
  loading = false,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [mode, setMode] = useState<'full' | 'minimal'>('full');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイル選択/ドロップ処理
  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.warning('CSVファイルを選択してください');
      return;
    }

    setFile(selectedFile);

    try {
      const { rows, detectedMode } = await parseStaffCSV(selectedFile);
      setMode(detectedMode);
      setParsedRows(rows);

      const result = validateCSVRows(rows, detectedMode);
      setValidation(result);
      setStep('preview');
    } catch (err: any) {
      toast.error(err.message || 'CSVの解析に失敗しました');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  }, [handleFile]);

  // インポート実行
  const handleExecuteImport = useCallback(async () => {
    if (!validation) return;
    setIsImporting(true);
    try {
      const result = await onImport(validation.validRows, mode, sendEmails);
      if (result) {
        setImportResult(result);
        setStep('result');
      }
    } finally {
      setIsImporting(false);
    }
  }, [validation, mode, sendEmails, onImport]);

  // URL一括コピー
  const handleCopyAllUrls = useCallback(async () => {
    if (!importResult) return;
    const urls = importResult.results
      .filter(r => r.success && r.activationUrl)
      .map(r => `${r.name}: ${r.activationUrl}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(urls);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [importResult]);

  // リセット
  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setValidation(null);
    setImportResult(null);
    setCopiedAll(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ---- Step 1: アップロード ----
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        {/* モード選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">登録モード</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('full')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                mode === 'full'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">フル登録</div>
              <div className="text-xs text-gray-500 mt-1">全項目を一括登録（15列）</div>
            </button>
            <button
              onClick={() => setMode('minimal')}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                mode === 'minimal'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">簡易 + 招待</div>
              <div className="text-xs text-gray-500 mt-1">名前+メールのみ（3列）</div>
            </button>
          </div>
        </div>

        {/* テンプレートDL */}
        <button
          onClick={() => downloadCSVTemplate(mode)}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark"
        >
          <Download size={16} />
          {mode === 'full' ? 'フル版' : '簡易版'}テンプレートCSVをダウンロード
        </button>

        {/* ファイルアップロード */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Upload size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">
            CSVファイルをドラッグ&ドロップ
          </p>
          <p className="text-xs text-gray-500 mt-1">
            またはクリックしてファイルを選択
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  // ---- Step 2: プレビュー + バリデーション ----
  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary" />
            <span className="text-sm font-medium text-gray-700">
              {file?.name} — {parsedRows.length}件
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              mode === 'full' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {mode === 'full' ? 'フル' : '簡易'}
            </span>
          </div>
          <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-700">
            やり直す
          </button>
        </div>

        {/* バリデーションサマリー */}
        {validation && (
          <div className={`p-3 rounded-lg ${
            validation.isValid
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <AlertTriangle size={16} className="text-yellow-600" />
              )}
              <span className="text-sm font-medium">
                有効: {validation.validRows.length}件
                {validation.errors.length > 0 && (
                  <span className="text-yellow-700 ml-2">
                    エラー: {validation.errors.length}件
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* プレビューテーブル */}
        <div className="max-h-[300px] overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">行</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">姓</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">名</th>
                {mode === 'full' && (
                  <>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">セイ</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">メイ</th>
                  </>
                )}
                <th className="px-3 py-2 text-left text-gray-600 font-medium">メール</th>
                {mode === 'full' && (
                  <>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">雇用</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">入職日</th>
                  </>
                )}
                <th className="px-3 py-2 text-left text-gray-600 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((row) => {
                const rowErrors = validation?.errors.filter(e => e.rowIndex === row.rowIndex) || [];
                const hasError = rowErrors.length > 0;
                return (
                  <tr
                    key={row.rowIndex}
                    className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                    <td className="px-3 py-2">{row.lastName}</td>
                    <td className="px-3 py-2">{row.firstName}</td>
                    {mode === 'full' && (
                      <>
                        <td className="px-3 py-2 text-gray-500">{row.lastNameKana || '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.firstNameKana || '-'}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-gray-500">{row.email || '-'}</td>
                    {mode === 'full' && (
                      <>
                        <td className="px-3 py-2 text-gray-500">{row.employmentType || '常勤'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.startDate || '-'}</td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      {hasError ? (
                        <span className="text-red-600" title={rowErrors.map(e => `${e.field}: ${e.message}`).join(', ')}>
                          <XCircle size={14} className="inline" /> {rowErrors[0].message}
                        </span>
                      ) : (
                        <span className="text-green-600"><CheckCircle size={14} className="inline" /> OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ナビゲーション */}
        <div className="flex justify-between pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={16} /> 戻る
          </button>
          <button
            onClick={() => setStep('confirm')}
            disabled={!validation || validation.validRows.length === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            次へ <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 3: 確認 ----
  if (step === 'confirm') {
    return (
      <div className="space-y-6">
        <div className="text-center py-2">
          <h3 className="text-lg font-bold text-gray-800">インポート内容の確認</h3>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">登録モード</span>
            <span className="font-medium">{mode === 'full' ? 'フル登録' : '簡易 + 招待'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">登録件数</span>
            <span className="font-medium">{validation?.validRows.length || 0}件</span>
          </div>
          {validation && validation.errors.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600">スキップ（エラー）</span>
              <span className="font-medium text-yellow-700">
                {parsedRows.length - validation.validRows.length}件
              </span>
            </div>
          )}
        </div>

        {/* メール送信オプション */}
        <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmails}
            onChange={(e) => setSendEmails(e.target.checked)}
            className="w-4 h-4 text-primary rounded"
          />
          <div>
            <div className="flex items-center gap-1 text-sm font-medium text-blue-800">
              <Mail size={14} />
              招待メールを送信する
            </div>
            <p className="text-xs text-blue-600 mt-0.5">
              メールアドレスが入力されているスタッフに招待メールを送信します
            </p>
          </div>
        </label>

        {/* ナビゲーション */}
        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep('preview')}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={16} /> 戻る
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={isImporting || loading}
            className="flex items-center gap-2 px-6 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 font-medium"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                インポート中...
              </>
            ) : (
              <>
                <Upload size={16} />
                一括登録を実行
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 4: 結果 ----
  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        {importResult && importResult.errorCount === 0 ? (
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-green-600" />
          </div>
        ) : (
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={28} className="text-yellow-600" />
          </div>
        )}
        <h3 className="text-lg font-bold text-gray-800">インポート完了</h3>
      </div>

      {/* サマリー */}
      {importResult && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{importResult.totalRows}</div>
            <div className="text-xs text-gray-500">合計</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
            <div className="text-xs text-green-600">成功</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{importResult.errorCount}</div>
            <div className="text-xs text-red-600">エラー</div>
          </div>
        </div>
      )}

      {/* URL一括コピー / CSVダウンロード */}
      {importResult && importResult.successCount > 0 && (
        <div className="flex gap-2">
          <button
            onClick={handleCopyAllUrls}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              copiedAll
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copiedAll ? <Check size={14} /> : <Copy size={14} />}
            {copiedAll ? 'コピー済み' : 'URL一括コピー'}
          </button>
          <button
            onClick={() => importResult && downloadImportResultCSV(importResult.results)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm"
          >
            <Download size={14} />
            結果CSVダウンロード
          </button>
        </div>
      )}

      {/* 結果リスト */}
      {importResult && (
        <div className="max-h-[200px] overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600">名前</th>
                <th className="px-3 py-2 text-left text-gray-600">メール</th>
                <th className="px-3 py-2 text-left text-gray-600">結果</th>
              </tr>
            </thead>
            <tbody>
              {importResult.results.map((r, i) => (
                <tr key={i} className={r.success ? '' : 'bg-red-50'}>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-gray-500">{r.email || '-'}</td>
                  <td className="px-3 py-2">
                    {r.success ? (
                      <span className="text-green-600"><CheckCircle size={12} className="inline" /> 成功</span>
                    ) : (
                      <span className="text-red-600"><XCircle size={12} className="inline" /> {r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={handleReset}
          className="w-full px-4 py-2 text-sm text-primary hover:text-primary-dark font-medium"
        >
          新しい一括登録を開始
        </button>
      </div>
    </div>
  );
};

export default CSVBulkUploadPanel;
