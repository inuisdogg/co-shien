/**
 * 変更届・運営規程 自動生成エンジン
 *
 * 施設情報の変更を検知し、必要な行政書類を自動生成する。
 * HTMLテンプレート方式で高品質な日本語印刷出力を実現。
 *
 * - 変更届出書 (Change Notification Form)
 * - 運営規程 (Operating Regulations) — facility_settingsから自動生成
 * - 変更種別→必要書類マッピング
 */

import type { ChangeNotificationType, FacilitySettings } from '@/types';
import { resolveTimeSlots } from '@/utils/slotResolver';

// ─── Helper Functions ───

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr || '-';
  }
}

function toJapaneseEra(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (y > 2019 || (y === 2019 && (m > 5 || (m === 5 && day >= 1)))) {
      const reiwa = y - 2018;
      return `令和${reiwa === 1 ? '元' : reiwa}年${m}月${day}日`;
    }
    return `${y}年${m}月${day}日`;
  } catch {
    return dateStr || '-';
  }
}

function todayJapanese(): string {
  return toJapaneseEra(new Date().toISOString());
}

// 曜日
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// ─── Change Impact Mapping ───

export type RequiredDocument = {
  name: string;
  description: string;
  autoGenerable: boolean; // Rootsで自動生成可能か
  generator?: 'change_notification' | 'operating_regulations' | 'staffing_list' | 'floor_plan';
};

/** 変更種別ごとの必要書類マッピング */
export const CHANGE_IMPACT_MAP: Record<string, RequiredDocument[]> = {
  business_hours: [
    { name: '変更届出書', description: '営業日/営業時間の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '運営規程（変更後）', description: '変更後の営業時間を反映した運営規程', autoGenerable: true, generator: 'operating_regulations' },
  ],
  capacity: [
    { name: '変更届出書', description: '利用定員の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '運営規程（変更後）', description: '変更後の定員を反映した運営規程', autoGenerable: true, generator: 'operating_regulations' },
    { name: '平面図', description: '利用定員に対応した事業所の平面図', autoGenerable: false },
  ],
  facility_name: [
    { name: '変更届出書', description: '事業所名称の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '運営規程（変更後）', description: '変更後の名称を反映した運営規程', autoGenerable: true, generator: 'operating_regulations' },
    { name: '登記事項証明書', description: '名称変更が記載された法人の登記事項証明書', autoGenerable: false },
  ],
  address: [
    { name: '変更届出書', description: '事業所所在地の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '運営規程（変更後）', description: '変更後の所在地を反映した運営規程', autoGenerable: true, generator: 'operating_regulations' },
    { name: '平面図', description: '新事業所の平面図', autoGenerable: false },
    { name: '賃貸借契約書', description: '新事業所の賃貸借契約書の写し', autoGenerable: false },
  ],
  manager: [
    { name: '変更届出書', description: '管理者の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '管理者の経歴書', description: '新管理者の職務経歴書', autoGenerable: false },
  ],
  service_manager: [
    { name: '変更届出書', description: '児発管の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '児発管の経歴書', description: '新任児発管の職務経歴書', autoGenerable: false },
    { name: '研修修了証', description: '児童発達支援管理責任者研修の修了証', autoGenerable: false },
    { name: '実務経験証明書', description: '児発管の実務経験を証明する書類', autoGenerable: false },
  ],
  equipment: [
    { name: '変更届出書', description: '設備の変更を届け出る書類', autoGenerable: true, generator: 'change_notification' },
    { name: '備品一覧表', description: '変更後の設備・備品の一覧', autoGenerable: false },
    { name: '平面図', description: '変更後の配置を反映した平面図', autoGenerable: false },
  ],
  subsidy: [
    { name: '届出書（加算届）', description: '加算の新規算定・変更に係る届出書', autoGenerable: true, generator: 'change_notification' },
    { name: '勤務体制一覧表', description: '加算要件を満たす人員配置の一覧', autoGenerable: true, generator: 'staffing_list' },
    { name: '資格証明書', description: '加算要件に関連する資格証明書', autoGenerable: false },
  ],
};

// ─── Change Type Labels ───

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  business_hours: '営業日/営業時間の変更',
  capacity: '利用定員の変更',
  facility_name: '事業所名称の変更',
  address: '事業所所在地の変更',
  manager: '管理者の変更',
  service_manager: '児童発達支援管理責任者の変更',
  equipment: '設備の変更',
  subsidy: '加算の変更',
};

// ─── Base Styles for Print ───

function baseStyles(): string {
  return `
    <style>
      @page { size: A4; margin: 15mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", "Yu Gothic", sans-serif;
        font-size: 11pt; line-height: 1.6; color: #1a1a1a; background: white;
      }
      .page { max-width: 210mm; margin: 0 auto; padding: 10mm; }
      .title {
        text-align: center; font-size: 16pt; font-weight: bold;
        margin-bottom: 8mm; border-bottom: 2px solid #333; padding-bottom: 4mm;
      }
      .subtitle { text-align: center; font-size: 12pt; color: #555; margin-bottom: 6mm; }
      .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
      .meta-table td { padding: 3px 8px; font-size: 10pt; vertical-align: top; }
      .meta-table .label {
        font-weight: bold; width: 130px; background-color: #f5f5f5; border: 1px solid #ddd;
      }
      .meta-table .value { border: 1px solid #ddd; }
      .section-title {
        font-size: 12pt; font-weight: bold; margin-top: 6mm; margin-bottom: 3mm;
        padding-left: 4px; border-left: 4px solid #2563eb;
      }
      .content-box {
        border: 1px solid #ddd; padding: 4mm; margin-bottom: 4mm;
        min-height: 15mm; white-space: pre-wrap; font-size: 10pt;
      }
      .data-table {
        width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 10pt;
      }
      .data-table th {
        background-color: #f0f4f8; border: 1px solid #ccc;
        padding: 4px 8px; text-align: left; font-weight: bold;
      }
      .data-table td { border: 1px solid #ccc; padding: 4px 8px; vertical-align: top; }
      .highlight { background-color: #fef3c7; }
      .changed { background-color: #fef3c7; font-weight: bold; }
      .footer {
        margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #ccc;
        font-size: 9pt; color: #888; text-align: right;
      }
      .stamp-area { float: right; display: flex; gap: 4mm; margin-bottom: 4mm; }
      .stamp-box {
        width: 22mm; height: 22mm; border: 1px solid #999; text-align: center;
        font-size: 8pt; display: flex; flex-direction: column;
        justify-content: flex-end; padding-bottom: 2px;
      }
      .clearfix::after { content: ""; display: table; clear: both; }
      .signature-area { margin-top: 15mm; display: flex; justify-content: flex-end; gap: 10mm; }
      .signature-block { text-align: center; }
      .signature-line { border-bottom: 1px solid #333; width: 50mm; margin-top: 15mm; }
      .signature-label { font-size: 9pt; color: #666; margin-top: 2px; }
      .diff-old { text-decoration: line-through; color: #991b1b; background: #fee2e2; padding: 1px 4px; }
      .diff-new { color: #166534; background: #dcfce7; font-weight: bold; padding: 1px 4px; }
      @media print {
        body { background: white; }
        .page { padding: 0; max-width: none; }
        .no-print { display: none; }
      }
    </style>
  `;
}

// ─── Facility Info Type ───

export interface FacilityInfo {
  name: string;
  code?: string;
  businessNumber?: string;
  address?: string;
  postalCode?: string;
  phone?: string;
  fax?: string;
  corporateName?: string;
  representativeName?: string;
  managerName?: string;
  serviceManagerName?: string;
}

// ─── 1. 変更届出書 (Change Notification Form) ───

export interface ChangeNotificationData {
  facility: FacilityInfo;
  changeType: ChangeNotificationType | string;
  changeDescription: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  effectiveDate?: string;
  detectedAt: string;
  deadline: string;
  reason?: string;
}

/** 変更前後の値を読みやすいテキストに変換 */
function formatChangeValue(changeType: string, value: Record<string, any>, label: string): string {
  if (!value || Object.keys(value).length === 0) return '-';

  switch (changeType) {
    case 'business_hours': {
      const bh = value.businessHours;
      const holidays = value.regularHolidays;
      let text = '';
      if (bh) {
        if (bh.AM && bh.PM) {
          text += `営業時間: ${bh.AM.start || ''}〜${bh.AM.end || ''} / ${bh.PM.start || ''}〜${bh.PM.end || ''}`;
        } else if (typeof bh === 'object' && bh.periods) {
          text += `営業時間: フレキシブル制（${bh.periods.length}パターン）`;
        }
      }
      if (Array.isArray(holidays)) {
        const dayNames = holidays.map((d: number) => WEEKDAYS[d] || d).join('、');
        text += `\n定休日: ${dayNames || 'なし'}`;
      }
      return text || JSON.stringify(value, null, 2);
    }
    case 'capacity': {
      const cap = value.capacity;
      if (cap && typeof cap === 'object') {
        const slots = resolveTimeSlots([], { capacity: cap as Record<string, number> });
        return slots.map(s => `${s.name}: ${s.capacity ?? '-'}名`).join(' / ');
      }
      return JSON.stringify(value, null, 2);
    }
    case 'facility_name':
      return value.facilityName || '-';
    case 'address':
      return `〒${value.postalCode || ''} ${value.address || '-'}`;
    default:
      return JSON.stringify(value, null, 2);
  }
}

export function generateChangeNotificationHTML(data: ChangeNotificationData): string {
  const typeLabel = CHANGE_TYPE_LABELS[data.changeType] || data.changeType;
  const oldText = formatChangeValue(data.changeType, data.oldValue, '変更前');
  const newText = formatChangeValue(data.changeType, data.newValue, '変更後');
  const requiredDocs = CHANGE_IMPACT_MAP[data.changeType] || [];

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>変更届出書 - ${escapeHtml(typeLabel)}</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <div class="stamp-area">
      <div class="stamp-box">施設長</div>
      <div class="stamp-box">管理者</div>
      <div class="stamp-box">担当</div>
    </div>
    <div class="clearfix"></div>

    <div class="title">変更届出書</div>
    <div class="subtitle">障害児通所支援事業</div>

    <p style="text-align: right; margin-bottom: 6mm; font-size: 10pt;">
      届出日: ${todayJapanese()}
    </p>

    <!-- 事業者情報 -->
    <div class="section-title">事業者情報</div>
    <table class="meta-table">
      <tr>
        <td class="label">法人名</td>
        <td class="value">${escapeHtml(data.facility.corporateName)}</td>
        <td class="label">代表者</td>
        <td class="value">${escapeHtml(data.facility.representativeName)}</td>
      </tr>
      <tr>
        <td class="label">事業所名</td>
        <td class="value">${escapeHtml(data.facility.name)}</td>
        <td class="label">事業所番号</td>
        <td class="value" style="font-family: monospace;">${escapeHtml(data.facility.businessNumber)}</td>
      </tr>
      <tr>
        <td class="label">所在地</td>
        <td class="value" colspan="3">〒${escapeHtml(data.facility.postalCode)} ${escapeHtml(data.facility.address)}</td>
      </tr>
      <tr>
        <td class="label">電話番号</td>
        <td class="value">${escapeHtml(data.facility.phone)}</td>
        <td class="label">FAX</td>
        <td class="value">${escapeHtml(data.facility.fax)}</td>
      </tr>
      <tr>
        <td class="label">管理者</td>
        <td class="value">${escapeHtml(data.facility.managerName)}</td>
        <td class="label">児発管</td>
        <td class="value">${escapeHtml(data.facility.serviceManagerName)}</td>
      </tr>
    </table>

    <!-- 変更内容 -->
    <div class="section-title">変更の内容</div>
    <table class="meta-table">
      <tr>
        <td class="label">変更事項</td>
        <td class="value" colspan="3" style="font-weight: bold;">${escapeHtml(typeLabel)}</td>
      </tr>
      <tr>
        <td class="label">変更の理由</td>
        <td class="value" colspan="3">${escapeHtml(data.reason) || '事業運営上の必要による変更'}</td>
      </tr>
      <tr>
        <td class="label">変更予定日</td>
        <td class="value">${data.effectiveDate ? toJapaneseEra(data.effectiveDate) : todayJapanese()}</td>
        <td class="label">届出期限</td>
        <td class="value" style="font-weight: bold;">${toJapaneseEra(data.deadline)}</td>
      </tr>
    </table>

    <table class="data-table" style="margin-top: 4mm;">
      <thead>
        <tr>
          <th style="width: 50%;">変更前</th>
          <th style="width: 50%;">変更後</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="diff-old" style="white-space: pre-wrap;">${escapeHtml(oldText)}</td>
          <td class="diff-new" style="white-space: pre-wrap;">${escapeHtml(newText)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 添付書類一覧 -->
    ${requiredDocs.length > 0 ? `
    <div class="section-title">添付書類一覧</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%;">No.</th>
          <th style="width: 40%;">書類名</th>
          <th style="width: 40%;">説明</th>
          <th style="width: 15%;">添付</th>
        </tr>
      </thead>
      <tbody>
        ${requiredDocs.map((doc, i) => `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td>${escapeHtml(doc.name)}</td>
          <td style="font-size: 9pt; color: #555;">${escapeHtml(doc.description)}</td>
          <td style="text-align: center;">□</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <!-- 署名欄 -->
    <div class="signature-area">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">届出者（代表者）</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">管理者</div>
      </div>
    </div>

    <div class="footer">
      Roots自動生成 — ${todayJapanese()} | 正式な様式は管轄自治体に確認してください
    </div>
  </div>
</body>
</html>`;
}

// ─── 2. 運営規程 (Operating Regulations) — 自動生成 ───

export interface OperatingRegulationsData {
  facility: FacilityInfo;
  settings: FacilitySettings;
  designationDate?: string;
  designatedServiceTypes?: string[];
  capacity?: { AM: number; PM: number };
  socialInsurance?: Record<string, boolean>;
  complaintResolution?: Record<string, string>;
  primaryDisabilityTypes?: string[];
  changedSections?: string[]; // ハイライト対象の条番号
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  child_development_support: '児童発達支援',
  after_school_day_service: '放課後等デイサービス',
  nursery_visit_support: '保育所等訪問支援',
  home_based_child_support: '居宅訪問型児童発達支援',
};

export function generateOperatingRegulationsHTML(data: OperatingRegulationsData): string {
  const s = data.settings;
  const f = data.facility;
  const changed = new Set(data.changedSections || []);
  const hl = (section: string) => changed.has(section) ? 'class="highlight"' : '';

  // 営業時間テキスト
  const defaultSlots = resolveTimeSlots([]);
  const bh = s.flexibleBusinessHours || s.businessHours;
  let businessHoursText = '';
  if (bh && 'AM' in bh && 'PM' in bh) {
    const am = (bh as any).AM;
    const pm = (bh as any).PM;
    const amLabel = defaultSlots[0]?.name || '午前';
    const pmLabel = defaultSlots[1]?.name || '午後';
    businessHoursText = `${amLabel} ${am?.start || '09:00'}〜${am?.end || '12:00'}、${pmLabel} ${pm?.start || '13:00'}〜${pm?.end || '18:00'}`;
  } else {
    businessHoursText = '別途定めるとおり';
  }

  // 定休日テキスト
  const holidays = s.regularHolidays || [];
  const holidayText = holidays.length > 0
    ? holidays.map((d: number) => WEEKDAYS[d] + '曜日').join('、')
    : '日曜日、国民の祝日';

  // サービス種別
  const serviceTypes = (data.designatedServiceTypes || [])
    .map(t => SERVICE_TYPE_LABELS[t] || t)
    .join('、') || '児童発達支援、放課後等デイサービス';

  // 定員
  const cap = data.capacity || s.capacity;
  const capText = cap
    ? resolveTimeSlots([], { capacity: cap as Record<string, number> }).map(sl => `${sl.name} ${sl.capacity}名`).join('、')
    : '10名';

  // 苦情解決
  const cr = data.complaintResolution || {};

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>運営規程 - ${escapeHtml(f.name)}</title>
  ${baseStyles()}
  <style>
    .article { margin-bottom: 5mm; }
    .article-title { font-weight: bold; font-size: 11pt; margin-bottom: 2mm; }
    .article-body { padding-left: 6mm; font-size: 10pt; }
    .article-body ol, .article-body ul { padding-left: 6mm; }
    .article-body li { margin-bottom: 1mm; }
    .toc { margin: 6mm 0; }
    .toc-item { font-size: 10pt; margin-bottom: 1mm; }
    .highlight { background-color: #fef3c7; border-left: 3px solid #f59e0b; padding-left: 3mm; }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">運営規程</div>
    <div class="subtitle">${escapeHtml(f.name)}</div>
    <p style="text-align: right; font-size: 10pt; margin-bottom: 6mm;">
      制定日: ${data.designationDate ? toJapaneseEra(data.designationDate) : '___年___月___日'}<br>
      最終改定日: ${todayJapanese()}
    </p>

    <!-- 目次 -->
    <div class="section-title">目次</div>
    <div class="toc">
      <div class="toc-item">第1条　事業の目的</div>
      <div class="toc-item">第2条　運営の方針</div>
      <div class="toc-item">第3条　事業の名称等</div>
      <div class="toc-item">第4条　提供する事業</div>
      <div class="toc-item">第5条　従業者の職種、員数及び職務の内容</div>
      <div class="toc-item">第6条　営業日及び営業時間</div>
      <div class="toc-item">第7条　利用定員</div>
      <div class="toc-item">第8条　障害児通所支援の内容</div>
      <div class="toc-item">第9条　利用者負担額</div>
      <div class="toc-item">第10条　通常の事業の実施地域</div>
      <div class="toc-item">第11条　苦情解決</div>
      <div class="toc-item">第12条　緊急時の対応</div>
      <div class="toc-item">第13条　非常災害対策</div>
      <div class="toc-item">第14条　虐待防止</div>
      <div class="toc-item">第15条　その他</div>
    </div>

    <!-- 第1条 -->
    <div class="article">
      <div class="article-title">第1条（事業の目的）</div>
      <div class="article-body">
        ${escapeHtml(f.corporateName || '（法人名）')}が設置する${escapeHtml(f.name)}（以下「事業所」という。）が行う障害児通所支援事業の適正な運営を確保するために必要な人員及び運営管理に関する事項を定め、事業所の従業者が、障害児に対し、適正な障害児通所支援を提供することを目的とする。
      </div>
    </div>

    <!-- 第2条 -->
    <div class="article">
      <div class="article-title">第2条（運営の方針）</div>
      <div class="article-body">
        <ol>
          <li>事業所の従業者は、障害児の意思及び人格を尊重し、常に当該障害児の立場に立ったサービスの提供に努めるものとする。</li>
          <li>事業の実施に当たっては、地域との結び付きを重視し、関係市区町村、他の障害児通所支援事業者等との連携に努めるものとする。</li>
        </ol>
      </div>
    </div>

    <!-- 第3条 -->
    <div class="article" ${hl('facility_name')}>
      <div class="article-title">第3条（事業の名称等）</div>
      <div class="article-body">
        <table class="meta-table">
          <tr><td class="label">事業所の名称</td><td class="value">${escapeHtml(f.name)}</td></tr>
          <tr><td class="label">事業所の所在地</td><td class="value">〒${escapeHtml(f.postalCode)} ${escapeHtml(f.address)}</td></tr>
          <tr><td class="label">事業所番号</td><td class="value" style="font-family: monospace;">${escapeHtml(f.businessNumber)}</td></tr>
          <tr><td class="label">電話番号</td><td class="value">${escapeHtml(f.phone)}</td></tr>
          <tr><td class="label">管理者</td><td class="value">${escapeHtml(f.managerName)}</td></tr>
        </table>
      </div>
    </div>

    <!-- 第4条 -->
    <div class="article" ${hl('service_types')}>
      <div class="article-title">第4条（提供する事業）</div>
      <div class="article-body">
        当事業所において提供する障害児通所支援の種類は、次のとおりとする。
        <ul>
          ${(data.designatedServiceTypes || ['child_development_support', 'after_school_day_service'])
            .map(t => `<li>${escapeHtml(SERVICE_TYPE_LABELS[t] || t)}</li>`).join('')}
        </ul>
        ${data.primaryDisabilityTypes && data.primaryDisabilityTypes.length > 0 ? `
        <p style="margin-top: 2mm;">主たる対象: ${data.primaryDisabilityTypes.map(t => {
          const labels: Record<string, string> = {
            intellectual: '知的障害', developmental: '発達障害', physical: '身体障害',
            mental: '精神障害', severe: '重症心身障害', hearing: '聴覚障害', visual: '視覚障害',
          };
          return labels[t] || t;
        }).join('、')}</p>` : ''}
      </div>
    </div>

    <!-- 第5条 -->
    <div class="article">
      <div class="article-title">第5条（従業者の職種、員数及び職務の内容）</div>
      <div class="article-body">
        事業所に置く従業者の職種、員数及び職務の内容は、次のとおりとする。
        <table class="data-table" style="margin-top: 2mm;">
          <thead>
            <tr><th>職種</th><th>員数</th><th>職務の内容</th></tr>
          </thead>
          <tbody>
            <tr><td>管理者</td><td>1名</td><td>事業所の管理その他の管理を一元的に行う</td></tr>
            <tr><td>児童発達支援管理責任者</td><td>1名以上</td><td>個別支援計画の作成等</td></tr>
            <tr><td>児童指導員又は保育士</td><td>2名以上</td><td>障害児の支援</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 第6条 -->
    <div class="article" ${hl('business_hours')}>
      <div class="article-title">第6条（営業日及び営業時間）</div>
      <div class="article-body">
        <table class="meta-table">
          <tr><td class="label">営業日</td><td class="value">${holidayText}を除く毎日</td></tr>
          <tr><td class="label">営業時間</td><td class="value">${escapeHtml(businessHoursText)}</td></tr>
          <tr><td class="label">サービス提供時間</td><td class="value">${
            s.serviceHours
              ? `${defaultSlots[0]?.name || '午前'} ${s.serviceHours.AM?.start || '-'}〜${s.serviceHours.AM?.end || '-'}、${defaultSlots[1]?.name || '午後'} ${s.serviceHours.PM?.start || '-'}〜${s.serviceHours.PM?.end || '-'}`
              : businessHoursText
          }</td></tr>
        </table>
      </div>
    </div>

    <!-- 第7条 -->
    <div class="article" ${hl('capacity')}>
      <div class="article-title">第7条（利用定員）</div>
      <div class="article-body">
        当事業所の利用定員は、${escapeHtml(capText)}とする。
      </div>
    </div>

    <!-- 第8条 -->
    <div class="article">
      <div class="article-title">第8条（障害児通所支援の内容）</div>
      <div class="article-body">
        当事業所で提供する障害児通所支援の内容は以下のとおりとする。
        <ol>
          <li>個別支援計画に基づく日常生活における基本的な動作の指導</li>
          <li>集団生活への適応訓練</li>
          <li>知識技能の付与</li>
          <li>その他必要な支援</li>
        </ol>
      </div>
    </div>

    <!-- 第9条 -->
    <div class="article">
      <div class="article-title">第9条（利用者負担額）</div>
      <div class="article-body">
        障害児通所支援の提供に要した費用のうち、児童福祉法に基づく給付費の支給に係る利用者負担額として、障害児通所給付費等の額に100分の10を乗じた額とする。
      </div>
    </div>

    <!-- 第10条 -->
    <div class="article" ${hl('address')}>
      <div class="article-title">第10条（通常の事業の実施地域）</div>
      <div class="article-body">
        通常の事業の実施地域は、事業所所在地の市区町村及びその周辺地域とする。
      </div>
    </div>

    <!-- 第11条 -->
    <div class="article" ${hl('complaint')}>
      <div class="article-title">第11条（苦情解決）</div>
      <div class="article-body">
        <ol>
          <li>提供した障害児通所支援に関する苦情に迅速かつ適切に対応するため、苦情受付窓口を設置する。</li>
          ${cr.responsiblePerson ? `<li>苦情受付責任者: ${escapeHtml(cr.responsiblePerson)}</li>` : ''}
          ${cr.receptionHours ? `<li>受付日時: ${escapeHtml(cr.receptionHours)}</li>` : ''}
          ${cr.externalConsultation ? `<li>外部相談窓口: ${escapeHtml(cr.externalConsultation)}</li>` : ''}
        </ol>
      </div>
    </div>

    <!-- 第12条 -->
    <div class="article">
      <div class="article-title">第12条（緊急時の対応）</div>
      <div class="article-body">
        サービス提供中に障害児の病状の急変等が生じた場合は、速やかに主治医又は協力医療機関への連絡を行う等の必要な措置を講ずるとともに、保護者に連絡する。
      </div>
    </div>

    <!-- 第13条 -->
    <div class="article">
      <div class="article-title">第13条（非常災害対策）</div>
      <div class="article-body">
        非常災害に関する具体的な計画を立て、非常災害に対する不断の注意と訓練を行う。
      </div>
    </div>

    <!-- 第14条 -->
    <div class="article">
      <div class="article-title">第14条（虐待防止）</div>
      <div class="article-body">
        障害児虐待の防止のため、次の措置を講ずる。
        <ol>
          <li>虐待防止委員会の設置</li>
          <li>従業者に対する虐待防止研修の実施</li>
          <li>虐待防止のための責任者の設置</li>
        </ol>
      </div>
    </div>

    <!-- 第15条 -->
    <div class="article">
      <div class="article-title">第15条（その他）</div>
      <div class="article-body">
        この規程に定める事項のほか、運営に関する重要事項は、${escapeHtml(f.corporateName || '法人')}と事業所の管理者との協議に基づいて定める。
      </div>
    </div>

    <div style="margin-top: 10mm; text-align: center; font-size: 10pt;">
      附　則<br>
      この規程は、${data.designationDate ? toJapaneseEra(data.designationDate) : '___年___月___日'}から施行する。
    </div>

    <div class="footer">
      Roots自動生成 — ${todayJapanese()} | ${changed.size > 0 ? `★ 黄色ハイライト部分は直近の変更箇所です` : ''}
    </div>
  </div>
</body>
</html>`;
}

// ─── 3. 印刷ウィンドウ ───

export function openPrintWindow(html: string): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) {
    console.warn('ポップアップがブロックされました。ポップアップを許可してください。');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

// ─── 4. 変更→影響分析 ───

export interface ChangeImpactAnalysis {
  changeType: string;
  changeLabel: string;
  requiredDocuments: RequiredDocument[];
  affectedRegulationSections: string[];
  deadline: string;
  detectedAt: string;
}

/** 変更種別から影響分析を生成 */
export function analyzeChangeImpact(
  changeType: ChangeNotificationType | string,
  detectedAt: Date
): ChangeImpactAnalysis {
  const docs = CHANGE_IMPACT_MAP[changeType] || [
    { name: '変更届出書', description: '変更事項の届出書', autoGenerable: true, generator: 'change_notification' as const },
  ];

  // 変更種別→運営規程の影響箇所マッピング
  const sectionMap: Record<string, string[]> = {
    business_hours: ['business_hours'],
    capacity: ['capacity'],
    facility_name: ['facility_name'],
    address: ['facility_name', 'address'],
    manager: ['facility_name'],
    service_manager: [],
    equipment: [],
    subsidy: [],
  };

  const deadline = new Date(detectedAt);
  if (changeType === 'subsidy') {
    deadline.setDate(15);
    if (detectedAt.getDate() > 15) deadline.setMonth(deadline.getMonth() + 1);
  } else {
    deadline.setDate(deadline.getDate() + 10);
  }

  return {
    changeType,
    changeLabel: CHANGE_TYPE_LABELS[changeType] || changeType,
    requiredDocuments: docs,
    affectedRegulationSections: sectionMap[changeType] || [],
    deadline: deadline.toISOString(),
    detectedAt: detectedAt.toISOString(),
  };
}
