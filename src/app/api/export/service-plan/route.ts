/**
 * 個別支援計画 Excel出力API
 * テンプレートにデータを埋め込んでダウンロード
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import path from 'path';

// 和暦変換
function toWareki(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 令和は2019年5月1日から
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear}年${month}月${day}日`;
  }
  // 平成
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

// 日付のみ抽出（年月日形式）
function formatDateYMD(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      facilityName,
      childName,
      birthDate,
      planType,
      periodStart,
      periodEnd,
      createdByName,
      createdDate,
      currentSituation,
      strengths,
      interests,
      familyCooperation,
      longTermGoals,
      shortTermGoals,
      supportContent,
      specialNotes,
    } = body;

    // テンプレートファイルを読み込み
    const templatePath = path.join(process.cwd(), 'templates', '0520_個別支援計画(都参考様式） (1).xlsx');
    const templateBuffer = readFileSync(templatePath);
    const workbook = XLSX.read(templateBuffer, { type: 'buffer' });

    // シート1: 別紙1-1（個別支援計画参考様式）
    const sheet1Name = workbook.SheetNames[0];
    const sheet1 = workbook.Sheets[sheet1Name];

    // セルへの書き込み関数
    const writeCell = (cellRef: string, value: string | number | undefined) => {
      if (value === undefined || value === null) return;
      if (!sheet1[cellRef]) {
        sheet1[cellRef] = { t: 's', v: '' };
      }
      sheet1[cellRef].v = value;
    };

    // --- シート1へのデータ書き込み ---

    // 事業所名（F1セル付近）
    writeCell('F1', facilityName || '');

    // 作成日（B3またはC3付近）
    writeCell('B3', toWareki(createdDate));

    // 作成者（G3付近）
    writeCell('G3', createdByName || '');

    // 児童名（B5付近）
    writeCell('B5', childName || '');

    // 生年月日（G5付近）
    writeCell('G5', toWareki(birthDate));

    // 計画期間
    writeCell('J5', `${formatDateYMD(periodStart)} ～ ${formatDateYMD(periodEnd)}`);

    // 本人の希望（A8付近の内容エリア）
    writeCell('B8', interests || '');

    // 保護者の希望（A9付近の内容エリア）
    writeCell('B9', familyCooperation || '');

    // 総合的な支援の方針（A11付近）
    writeCell('B11', currentSituation || '');

    // 長期目標（A14付近）
    if (longTermGoals && longTermGoals.length > 0) {
      const goals = longTermGoals.map((g: { goal: string; domain: string }) =>
        `【${g.domain || ''}】${g.goal || ''}`
      ).join('\n');
      writeCell('B14', goals);
    }

    // 短期目標（A15付近）
    if (shortTermGoals && shortTermGoals.length > 0) {
      const goals = shortTermGoals.map((g: { goal: string; domain: string }) =>
        `【${g.domain || ''}】${g.goal || ''}`
      ).join('\n');
      writeCell('B15', goals);
    }

    // 支援内容（行17以降）
    // テンプレートの構造に合わせて書き込み
    if (supportContent && supportContent.length > 0) {
      supportContent.forEach((content: { category: string; content: string; frequency?: string; staff?: string }, index: number) => {
        const rowNum = 18 + index; // 18行目から開始
        if (rowNum <= 32) { // 最大32行まで
          writeCell(`A${rowNum}`, content.category || '');
          writeCell(`B${rowNum}`, content.content || '');
          writeCell(`J${rowNum}`, content.frequency || '');
          writeCell(`K${rowNum}`, content.staff || '');
        }
      });
    }

    // 特記事項（A35付近）
    writeCell('B35', specialNotes || '');

    // シート2: 別紙1-2（個別支援計画参考様式別表）
    const sheet2Name = workbook.SheetNames[1];
    const sheet2 = workbook.Sheets[sheet2Name];

    // シート2への書き込み
    const writeCell2 = (cellRef: string, value: string | number | undefined) => {
      if (value === undefined || value === null) return;
      if (!sheet2[cellRef]) {
        sheet2[cellRef] = { t: 's', v: '' };
      }
      sheet2[cellRef].v = value;
    };

    // 利用児氏名
    writeCell2('C4', childName || '');

    // ワークブックをバッファに変換
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // ファイル名（日本語対応）
    const fileName = `個別支援計画_${childName || '児童'}_${formatDateYMD(periodStart) || new Date().toISOString().split('T')[0]}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    // レスポンスを返す
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      },
    });

  } catch (error) {
    console.error('Excel出力エラー:', error);
    return NextResponse.json(
      { error: 'Excel出力に失敗しました', details: String(error) },
      { status: 500 }
    );
  }
}
