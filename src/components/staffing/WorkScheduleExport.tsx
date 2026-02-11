/**
 * 勤務体制一覧表出力
 * Work Schedule Export
 *
 * 勤務体制一覧表のPDF/印刷出力機能
 */

'use client';

import React, { useRef } from 'react';
import {
  WorkScheduleReport,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';

interface WorkScheduleExportProps {
  report: WorkScheduleReport;
  facilityName: string;
  year: number;
  month: number;
  onPrint?: () => void;
}

const WorkScheduleExport: React.FC<WorkScheduleExportProps> = ({
  report,
  facilityName,
  year,
  month,
  onPrint,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  // 印刷実行
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされています。許可してから再度お試しください。');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>勤務体制一覧表 - ${year}年${month}月</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
          }

          body {
            font-family: 'Hiragino Kaku Gothic ProN', 'メイリオ', sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
          }

          .header {
            text-align: center;
            margin-bottom: 20px;
          }

          .header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin: 0 0 5px 0;
          }

          .header .meta {
            font-size: 10pt;
            color: #666;
          }

          .info-box {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
          }

          .info-box div {
            text-align: center;
          }

          .info-box .label {
            font-size: 9pt;
            color: #666;
          }

          .info-box .value {
            font-size: 14pt;
            font-weight: bold;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: center;
            font-size: 9pt;
          }

          th {
            background: #e0e0e0;
            font-weight: bold;
          }

          tr:nth-child(even) {
            background: #f9f9f9;
          }

          .text-left {
            text-align: left;
          }

          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8pt;
          }

          .badge-standard {
            background: #e0f2f1;
            color: #00796b;
          }

          .badge-addition {
            background: #fff3e0;
            color: #e65100;
          }

          .badge-role {
            background: #e3f2fd;
            color: #1565c0;
          }

          .footer {
            margin-top: 30px;
            font-size: 9pt;
            color: #666;
          }

          .footer .signature-line {
            display: flex;
            justify-content: flex-end;
            gap: 40px;
            margin-top: 40px;
          }

          .footer .signature-box {
            width: 120px;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 5px;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      onPrint?.();
    }, 250);
  };

  // サマリー計算
  const standardStaff = report.staffAssignments.filter((s) => s.personnelType === 'standard');
  const additionStaff = report.staffAssignments.filter((s) => s.personnelType === 'addition');
  const totalFTE = report.staffAssignments.reduce((sum, s) => sum + s.fte, 0);

  return (
    <>
      {/* 印刷用の非表示コンテンツ */}
      <div ref={printRef} className="hidden">
        {/* ヘッダー */}
        <div className="header">
          <h1>勤務体制一覧表</h1>
          <div className="meta">
            {facilityName} / {year}年{month}月
          </div>
        </div>

        {/* サマリー */}
        <div className="info-box">
          <div>
            <div className="label">総スタッフ数</div>
            <div className="value">{report.staffAssignments.length}名</div>
          </div>
          <div>
            <div className="label">基準人員</div>
            <div className="value">{standardStaff.length}名</div>
          </div>
          <div>
            <div className="label">加算人員</div>
            <div className="value">{additionStaff.length}名</div>
          </div>
          <div>
            <div className="label">常勤換算合計</div>
            <div className="value">{totalFTE.toFixed(2)}人</div>
          </div>
        </div>

        {/* スタッフ一覧テーブル */}
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>No.</th>
              <th style={{ width: '15%' }}>氏名</th>
              <th style={{ width: '10%' }}>人員区分</th>
              <th style={{ width: '12%' }}>勤務形態</th>
              <th style={{ width: '18%' }}>資格</th>
              <th style={{ width: '8%' }}>経験年数</th>
              <th style={{ width: '10%' }}>週労働時間</th>
              <th style={{ width: '8%' }}>常勤換算</th>
              <th style={{ width: '14%' }}>役割/配置加算</th>
            </tr>
          </thead>
          <tbody>
            {report.staffAssignments.map((assignment, idx) => (
              <tr key={assignment.staffId}>
                <td>{idx + 1}</td>
                <td className="text-left">{assignment.name}</td>
                <td>
                  <span
                    className={`badge ${
                      assignment.personnelType === 'standard' ? 'badge-standard' : 'badge-addition'
                    }`}
                  >
                    {PERSONNEL_TYPE_LABELS[assignment.personnelType]}
                  </span>
                </td>
                <td>{WORK_STYLE_LABELS[assignment.workStyle]}</td>
                <td className="text-left">
                  {assignment.qualifications
                    .map(
                      (q) => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q
                    )
                    .join('、')}
                </td>
                <td>{assignment.yearsOfExperience ? `${assignment.yearsOfExperience}年` : '-'}</td>
                <td>{assignment.weeklyHours}時間</td>
                <td style={{ fontWeight: 'bold' }}>{assignment.fte.toFixed(2)}</td>
                <td>
                  {assignment.role && (
                    <span className="badge badge-role">{assignment.role}</span>
                  )}
                  {assignment.assignedAdditions.length > 0 && (
                    <span style={{ fontSize: '8pt' }}>
                      {assignment.assignedAdditions.join(', ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* フッター */}
        <div className="footer">
          <div>
            作成日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="signature-line">
            <div className="signature-box">管理者</div>
            <div className="signature-box">児発管</div>
          </div>
        </div>
      </div>

      {/* 印刷ボタン（このコンポーネントを使う側から呼び出す） */}
      <button
        onClick={handlePrint}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold flex items-center gap-2"
      >
        印刷/PDF出力
      </button>
    </>
  );
};

export default WorkScheduleExport;
