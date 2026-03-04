/**
 * 法令遵守書類生成ユーティリティ
 *
 * 1. 代理受領通知書 (Proxy Receipt Notification)
 * 2. 上限管理結果票 CSV (Upper Limit Management Result Sheet)
 * 3. 国保連提出用CSV (KOKUHOREN Billing CSV - 介護給付費明細書フォーマット)
 * 4. 介護給付費明細書 HTML (Billing Detail Statement - printable/PDF)
 * 5. 利用者負担額一覧表 (User Copay Summary)
 */

import { openPrintWindow } from './wordEngine';

// ━━━ Types ━━━

export interface ProxyReceiptData {
  facilityName: string;
  facilityCode: string;
  facilityAddress?: string;
  yearMonth: string; // YYYY-MM
  childName: string;
  guardianName: string;
  beneficiaryNumber: string;
  serviceType: string; // 児童発達支援 or 放課後等デイサービス
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
  copayAmount: number;
  insuranceAmount: number;
  upperLimitAmount: number;
  usageDays: number;
}

export interface UpperLimitResultData {
  facilityName: string;
  facilityCode: string;
  yearMonth: string;
  childName: string;
  guardianName: string;
  beneficiaryNumber: string;
  incomeCategory: string;
  upperLimitAmount: number;
  managementType: 'none' | 'self' | 'coordinator' | 'managed';
  selfCopayAmount: number;
  adjustedCopayAmount: number;
  totalCopayAllFacilities: number;
  otherFacilities: {
    facilityName: string;
    facilityCode: string;
    totalAmount: number;
    copayAmount: number;
  }[];
}

export interface KokuhorenRecord {
  childName: string;
  beneficiaryNumber: string;
  serviceType: string;
  cityCode?: string;
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
  copayAmount: number;
  insuranceAmount: number;
  upperLimitAmount: number;
  usageDays: number;
  details: {
    serviceDate: string;
    serviceCode: string;
    units: number;
    isAbsence: boolean;
    additions?: { code: string; name: string; units: number }[];
  }[];
}

export interface KokuhorenExportData {
  facilityName: string;
  facilityCode: string;
  yearMonth: string; // YYYY-MM
  records: KokuhorenRecord[];
}

// ━━━ 1. 代理受領通知書 ━━━

export function generateProxyReceiptHTML(data: ProxyReceiptData): string {
  const [year, month] = data.yearMonth.split('-');
  const jpYear = `令和${parseInt(year) - 2018}年`;
  const jpMonth = `${parseInt(month)}月`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>代理受領通知書</title>
<style>
  @page { margin: 20mm; size: A4; }
  body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .header { text-align: center; margin-bottom: 24px; }
  .header h1 { font-size: 20px; border-bottom: 2px solid #333; display: inline-block; padding-bottom: 4px; }
  .date { text-align: right; margin-bottom: 16px; }
  .addressee { margin-bottom: 24px; }
  .addressee .name { font-size: 16px; font-weight: bold; }
  .sender { text-align: right; margin-bottom: 24px; }
  .body-text { margin-bottom: 16px; text-indent: 1em; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; }
  th { background: #f5f5f5; width: 35%; font-weight: bold; }
  .amount { text-align: right; }
  .note { font-size: 11px; color: #666; margin-top: 16px; }
</style>
</head>
<body>
  <div class="header"><h1>代理受領通知書</h1></div>
  <div class="date">${jpYear}${jpMonth}分</div>
  <div class="addressee">
    <p class="name">${data.guardianName} 様</p>
  </div>
  <div class="sender">
    <p>${data.facilityName}</p>
    <p>事業所番号: ${data.facilityCode}</p>
    ${data.facilityAddress ? `<p>${data.facilityAddress}</p>` : ''}
  </div>
  <div class="body-text">
    障害児通所給付費について、下記のとおり市町村より代理受領しましたのでお知らせいたします。
  </div>
  <table>
    <tr><th>対象月</th><td>${jpYear}${jpMonth}</td></tr>
    <tr><th>利用者名</th><td>${data.childName}</td></tr>
    <tr><th>受給者証番号</th><td>${data.beneficiaryNumber}</td></tr>
    <tr><th>サービス種別</th><td>${data.serviceType}</td></tr>
    <tr><th>利用日数</th><td>${data.usageDays}日</td></tr>
    <tr><th>総単位数</th><td class="amount">${data.totalUnits.toLocaleString()} 単位</td></tr>
    <tr><th>単位単価</th><td class="amount">${data.unitPrice.toFixed(1)} 円</td></tr>
    <tr><th>費用総額</th><td class="amount">${data.totalAmount.toLocaleString()} 円</td></tr>
    <tr><th>利用者負担上限月額</th><td class="amount">${data.upperLimitAmount.toLocaleString()} 円</td></tr>
    <tr><th>利用者負担額</th><td class="amount"><strong>${data.copayAmount.toLocaleString()} 円</strong></td></tr>
    <tr><th>代理受領額（給付費）</th><td class="amount"><strong>${data.insuranceAmount.toLocaleString()} 円</strong></td></tr>
  </table>
  <div class="note">
    ※ 本通知は、児童福祉法第21条の5の29の規定に基づき、障害児通所給付費の代理受領に関する通知です。<br>
    ※ ご不明な点がございましたら、事業所までお問い合わせください。
  </div>
</body>
</html>`;
}

export function printProxyReceipt(data: ProxyReceiptData): void {
  const html = generateProxyReceiptHTML(data);
  openPrintWindow(html);
}

export function printProxyReceiptBatch(records: ProxyReceiptData[]): void {
  const pages = records.map((r) => generateProxyReceiptHTML(r)
    .replace('<!DOCTYPE html>', '')
    .replace(/<html[^>]*>/, '')
    .replace('</html>', '')
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<\/?body>/g, '')
  );

  const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>代理受領通知書一覧</title>
<style>
  @page { margin: 20mm; size: A4; }
  body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; font-size: 13px; line-height: 1.6; color: #333; }
  .page-break { page-break-after: always; }
  .header { text-align: center; margin-bottom: 24px; }
  .header h1 { font-size: 20px; border-bottom: 2px solid #333; display: inline-block; padding-bottom: 4px; }
  .date { text-align: right; margin-bottom: 16px; }
  .addressee { margin-bottom: 24px; }
  .addressee .name { font-size: 16px; font-weight: bold; }
  .sender { text-align: right; margin-bottom: 24px; }
  .body-text { margin-bottom: 16px; text-indent: 1em; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; }
  th { background: #f5f5f5; width: 35%; font-weight: bold; }
  .amount { text-align: right; }
  .note { font-size: 11px; color: #666; margin-top: 16px; }
</style>
</head>
<body>
${pages.map((p, i) => `<div${i < pages.length - 1 ? ' class="page-break"' : ''}>${p}</div>`).join('\n')}
</body>
</html>`;
  openPrintWindow(fullHtml);
}

// ━━━ 2. 上限管理結果票 CSV ━━━

const INCOME_CATEGORY_LABELS: Record<string, string> = {
  general: '一般2（年収890万超）',
  general_low: '一般1（年収890万以下）',
  low_income: '低所得',
  welfare: '生活保護',
};

const MANAGEMENT_TYPE_LABELS: Record<string, string> = {
  none: '管理事業所なし',
  self: '自事業所が管理',
  coordinator: '他事業所が管理',
  managed: '管理対象',
};

export function exportUpperLimitResultCSV(records: UpperLimitResultData[]): void {
  if (records.length === 0) return;

  const header = [
    '対象年月', '事業所名', '事業所番号', '児童名', '保護者名', '受給者証番号',
    '所得区分', '負担上限月額', '管理区分', '自事業所負担額', '調整後負担額',
    '全事業所合計', '他事業所名', '他事業所番号', '他事業所請求額', '他事業所負担額',
  ].join(',');

  const rows: string[] = [];
  for (const r of records) {
    const baseRow = [
      r.yearMonth,
      r.facilityName,
      r.facilityCode,
      r.childName,
      r.guardianName,
      r.beneficiaryNumber,
      INCOME_CATEGORY_LABELS[r.incomeCategory] || r.incomeCategory,
      r.upperLimitAmount,
      MANAGEMENT_TYPE_LABELS[r.managementType] || r.managementType,
      r.selfCopayAmount,
      r.adjustedCopayAmount,
      r.totalCopayAllFacilities,
      '', '', '', '',
    ];
    rows.push(baseRow.join(','));

    // 他事業所の明細行
    for (const other of r.otherFacilities) {
      rows.push([
        '', '', '', '', '', '', '', '', '', '', '', '',
        other.facilityName,
        other.facilityCode,
        other.totalAmount,
        other.copayAmount,
      ].join(','));
    }
  }

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  downloadCSV(csv, `上限管理結果票_${records[0].yearMonth}.csv`);
}

// ━━━ 3. 国保連提出用CSV（介護給付費明細書フォーマット） ━━━

export function exportKokuhorenCSV(data: KokuhorenExportData): void {
  const lines: string[] = [];
  const ym = data.yearMonth.replace('-', '');

  // ── ファイルヘッダー ──
  lines.push([
    'JD',                      // 交換情報識別番号（障害児通所）
    data.facilityCode,         // 事業所番号
    data.facilityName,         // 事業所名称
    ym,                        // サービス提供年月
    new Date().toISOString().slice(0, 10).replace(/-/g, ''), // 作成年月日
    data.records.length,       // 総件数
  ].join(','));

  // ── 明細レコード（児童ごと） ──
  for (const rec of data.records) {
    // 基本情報レコード
    lines.push([
      '1',                          // レコード種別: 基本情報
      rec.beneficiaryNumber,        // 受給者証番号
      rec.childName,                // 利用者氏名
      rec.cityCode || '',           // 市区町村コード
      rec.serviceType === '児童発達支援' ? '63' : '64', // サービス種類コード
      rec.usageDays,                // 利用日数
      rec.totalUnits,               // サービス単位数合計
      rec.unitPrice,                // 単位数単価
      rec.totalAmount,              // 給付費請求額
      rec.upperLimitAmount,         // 利用者負担上限月額
      rec.copayAmount,              // 利用者負担額
      rec.insuranceAmount,          // 保険請求額
    ].join(','));

    // 日別明細レコード
    for (const detail of rec.details) {
      const additionCodes = (detail.additions || []).map(a => `${a.code}:${a.units}`).join(';');
      lines.push([
        '2',                        // レコード種別: 日別明細
        rec.beneficiaryNumber,      // 受給者証番号
        detail.serviceDate.replace(/-/g, ''), // サービス提供日
        detail.serviceCode,         // サービスコード
        detail.units,               // 単位数
        detail.isAbsence ? '1' : '0', // 欠席フラグ
        additionCodes,              // 加算コード（セミコロン区切り）
      ].join(','));
    }
  }

  // ── 集計レコード ──
  const totalInsurance = data.records.reduce((sum, r) => sum + r.insuranceAmount, 0);
  const totalCopay = data.records.reduce((sum, r) => sum + r.copayAmount, 0);
  const totalAmount = data.records.reduce((sum, r) => sum + r.totalAmount, 0);

  lines.push([
    '9',                            // レコード種別: 集計
    data.records.length,            // 明細件数
    totalAmount,                    // 費用合計
    totalInsurance,                 // 給付費請求額合計
    totalCopay,                     // 利用者負担額合計
  ].join(','));

  const csv = '\uFEFF' + lines.join('\n');
  downloadCSV(csv, `国保連請求_${data.facilityCode}_${ym}.csv`);
}

// ━━━ 4. 介護給付費明細書 HTML（印刷/PDF出力用） ━━━

export interface BillingStatementData {
  facilityName: string;
  facilityCode: string;
  facilityAddress?: string;
  yearMonth: string; // YYYY-MM
  records: {
    childName: string;
    beneficiaryNumber: string;
    serviceType: string;
    totalUnits: number;
    unitPrice: number;
    totalAmount: number;
    copayAmount: number;
    insuranceAmount: number;
    upperLimitAmount: number;
    incomeCategory: string;
    usageDays: number;
    details: {
      serviceDate: string;
      serviceCode: string;
      units: number;
      isAbsence: boolean;
      additions: { code: string; name: string; units: number }[];
    }[];
  }[];
}

const INCOME_LABELS: Record<string, string> = {
  general: '一般2',
  general_low: '一般1',
  low_income: '低所得',
  welfare: '生活保護',
};

export function generateBillingStatementHTML(data: BillingStatementData): string {
  const [year, month] = data.yearMonth.split('-');
  const jpYear = `令和${parseInt(year) - 2018}年`;
  const jpMonth = `${parseInt(month)}月`;

  const pages = data.records.map((rec, idx) => {
    // 日別明細行を生成
    const detailRows = rec.details.map((d) => {
      const dayNum = parseInt(d.serviceDate.split('-')[2], 10);
      const addText = d.additions.map((a) => `${a.name}(${a.units})`).join(' / ');
      return `<tr>
        <td class="center">${dayNum}</td>
        <td class="center">${d.isAbsence ? '欠' : '○'}</td>
        <td>${d.serviceCode}</td>
        <td class="right">${d.units.toLocaleString()}</td>
        <td class="small">${escHtml(addText)}</td>
      </tr>`;
    }).join('\n');

    return `
    <div class="page${idx < data.records.length - 1 ? ' page-break' : ''}">
      <h2 class="doc-title">介護給付費・訓練等給付費等明細書</h2>
      <div class="meta-row">
        <span>${jpYear}${jpMonth}分</span>
        <span>事業所番号: ${data.facilityCode}</span>
        <span>${data.facilityName}</span>
      </div>

      <table class="info-table">
        <tr>
          <th>受給者証番号</th><td>${rec.beneficiaryNumber}</td>
          <th>利用者名</th><td>${rec.childName}</td>
        </tr>
        <tr>
          <th>サービス種別</th><td>${rec.serviceType}</td>
          <th>所得区分</th><td>${INCOME_LABELS[rec.incomeCategory] || rec.incomeCategory}</td>
        </tr>
        <tr>
          <th>利用日数</th><td>${rec.usageDays}日</td>
          <th>負担上限月額</th><td class="right">${rec.upperLimitAmount.toLocaleString()}円</td>
        </tr>
      </table>

      <table class="detail-table">
        <thead>
          <tr>
            <th style="width:40px">日</th>
            <th style="width:30px">利用</th>
            <th style="width:80px">コード</th>
            <th style="width:70px">単位数</th>
            <th>加算内訳</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
        </tbody>
      </table>

      <table class="summary-table">
        <tr>
          <th>サービス単位数合計</th><td class="right">${rec.totalUnits.toLocaleString()}</td>
          <th>単位単価</th><td class="right">${rec.unitPrice.toFixed(2)}円</td>
        </tr>
        <tr>
          <th>費用合計</th><td class="right">${rec.totalAmount.toLocaleString()}円</td>
          <th>給付費請求額</th><td class="right">${rec.insuranceAmount.toLocaleString()}円</td>
        </tr>
        <tr>
          <th>利用者負担額</th><td class="right bold">${rec.copayAmount.toLocaleString()}円</td>
          <th></th><td></td>
        </tr>
      </table>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>介護給付費明細書 ${jpYear}${jpMonth}分</title>
<style>
  @page { margin: 15mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
  .page-break { page-break-after: always; }
  .doc-title { text-align: center; font-size: 16px; margin: 0 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #666; padding: 3px 6px; }
  th { background: #f0f0f0; font-weight: bold; text-align: left; white-space: nowrap; }
  .info-table th { width: 100px; }
  .info-table td { min-width: 120px; }
  .detail-table { font-size: 10px; }
  .detail-table th { text-align: center; background: #e8e8e8; }
  .detail-table td { padding: 2px 4px; }
  .summary-table th { width: 130px; background: #e8f4e8; }
  .summary-table td { min-width: 100px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .small { font-size: 9px; }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}

export function printBillingStatement(data: BillingStatementData): void {
  const html = generateBillingStatementHTML(data);
  openPrintWindow(html);
}

// ━━━ 5. 利用者負担額一覧表 HTML ━━━

export interface CopayListData {
  facilityName: string;
  facilityCode: string;
  yearMonth: string;
  records: {
    childName: string;
    beneficiaryNumber: string;
    serviceType: string;
    incomeCategory: string;
    upperLimitAmount: number;
    totalAmount: number;
    copayAmount: number;
    insuranceAmount: number;
    usageDays: number;
  }[];
}

export function generateCopayListHTML(data: CopayListData): string {
  const [year, month] = data.yearMonth.split('-');
  const jpYear = `令和${parseInt(year) - 2018}年`;
  const jpMonth = `${parseInt(month)}月`;

  const totalCopay = data.records.reduce((s, r) => s + r.copayAmount, 0);
  const totalInsurance = data.records.reduce((s, r) => s + r.insuranceAmount, 0);
  const totalAll = data.records.reduce((s, r) => s + r.totalAmount, 0);

  const rows = data.records.map((r, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${escHtml(r.childName)}</td>
      <td>${r.beneficiaryNumber}</td>
      <td>${r.serviceType}</td>
      <td>${INCOME_LABELS[r.incomeCategory] || r.incomeCategory}</td>
      <td class="center">${r.usageDays}</td>
      <td class="right">${r.upperLimitAmount.toLocaleString()}</td>
      <td class="right">${r.totalAmount.toLocaleString()}</td>
      <td class="right">${r.copayAmount.toLocaleString()}</td>
      <td class="right">${r.insuranceAmount.toLocaleString()}</td>
    </tr>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>利用者負担額一覧表 ${jpYear}${jpMonth}分</title>
<style>
  @page { margin: 15mm; size: A4 landscape; }
  body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; font-size: 12px; color: #333; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 8px; }
  .meta { text-align: right; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5px 8px; }
  th { background: #f0f0f0; font-weight: bold; font-size: 11px; }
  .center { text-align: center; }
  .right { text-align: right; }
  tfoot td { font-weight: bold; background: #f5f5f5; }
</style>
</head>
<body>
  <h1>利用者負担額一覧表</h1>
  <div class="meta">
    <span>${jpYear}${jpMonth}分</span>
    <span>${data.facilityName}（${data.facilityCode}）</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th>利用者名</th>
        <th>受給者証番号</th>
        <th>サービス種別</th>
        <th>所得区分</th>
        <th>日数</th>
        <th>上限月額</th>
        <th>費用合計</th>
        <th>利用者負担額</th>
        <th>給付費請求額</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="7" class="right">合計</td>
        <td class="right">${totalAll.toLocaleString()}</td>
        <td class="right">${totalCopay.toLocaleString()}</td>
        <td class="right">${totalInsurance.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="7" class="right">件数</td>
        <td colspan="3" class="center">${data.records.length}件</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

export function printCopayList(data: CopayListData): void {
  const html = generateCopayListHTML(data);
  openPrintWindow(html);
}

// ━━━ 6. 契約内容報告書 ━━━

export interface ContractReportPrintData {
  facilityName: string;
  facilityCode: string;
  governmentOrgName: string;
  year: number;
  month: number;
  items: {
    childName: string;
    recipientNumber: string;
    reportType: 'new' | 'change' | 'termination';
    contractStartDate: string;
    contractEndDate: string;
    daysPerMonth?: number;
    changeContent: string;
    terminationReason: string;
  }[];
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  new: '新規',
  change: '変更',
  termination: '終了',
};

export function generateContractReportHTML(data: ContractReportPrintData): string {
  const today = new Date();
  const submissionDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const rows = data.items.map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${escHtml(item.childName)}</td>
      <td class="center mono">${escHtml(item.recipientNumber)}</td>
      <td class="center">${REPORT_TYPE_LABEL[item.reportType] || item.reportType}</td>
      <td class="center">${escHtml(item.contractStartDate)}</td>
      <td class="center">${escHtml(item.contractEndDate)}</td>
      <td class="center">${item.daysPerMonth != null ? item.daysPerMonth + '日' : ''}</td>
      <td>${item.reportType === 'termination'
        ? escHtml(item.terminationReason)
        : escHtml(item.changeContent)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>契約内容報告書</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; font-size: 11px; color: #333; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; }
  .meta-left, .meta-right { }
  .meta-right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10px; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  td.center { text-align: center; }
  td.mono { font-family: monospace; }
  .note { border: 1px solid #ccc; padding: 10px; min-height: 50px; font-size: 10px; }
  .note-label { font-weight: bold; margin-bottom: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <h1>契約内容報告書</h1>
  </div>

  <div class="meta">
    <div class="meta-left">
      <p>提出先: ${escHtml(data.governmentOrgName)}</p>
      <p>事業所名: ${escHtml(data.facilityName)}</p>
      <p>事業所番号: ${escHtml(data.facilityCode)}</p>
    </div>
    <div class="meta-right">
      <p>提出日: ${submissionDate}</p>
      <p>対象期間: ${data.year}年${data.month}月</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">No</th>
        <th style="width:80px">児童名</th>
        <th style="width:90px">受給者証番号</th>
        <th style="width:40px">種別</th>
        <th style="width:75px">契約開始日</th>
        <th style="width:75px">契約終了日</th>
        <th style="width:50px">日数/月</th>
        <th>変更内容 / 終了理由</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" class="center">報告項目なし</td></tr>'}
    </tbody>
  </table>

  <div class="note">
    <div class="note-label">備考</div>
  </div>
</body>
</html>`;
}

export function printContractReport(data: ContractReportPrintData): void {
  const html = generateContractReportHTML(data);
  openPrintWindow(html);
}

// ━━━ ヘルパー ━━━

function escHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
