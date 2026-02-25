/**
 * Word / Document Generation Engine for Roots
 * 印刷可能なHTMLを生成し、window.print() またはPDF変換に利用する
 *
 * - 事故・苦情報告書 (Incident Report)
 * - 研修議事録 (Training Record)
 * - 委員会議事録 (Committee Meeting Minutes)
 */

// ---------- Shared Types ----------

/**
 * Incident / complaint / near-miss report data.
 * Mirrors the IncidentReport interface used in IncidentReportView.
 */
export interface IncidentReportData {
  id: string;
  facilityName?: string;
  reportType: 'complaint' | 'accident' | 'near_miss' | 'injury';
  title: string;
  description: string | null;
  occurredAt: string;
  discoveredAt: string | null;
  reportedAt: string | null;
  location: string | null;
  childName: string | null;
  reporterName: string | null;
  cause: string | null;
  immediateAction: string | null;
  injuryDetails: string | null;
  hospitalVisit: boolean;
  complainantName: string | null;
  complaintContent: string | null;
  responseContent: string | null;
  preventionMeasures: string | null;
  improvementPlan: string | null;
  familyNotified: boolean;
  adminReportRequired: boolean;
  adminReported: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  createdAt: string;
}

/**
 * Training record data.
 * Mirrors the TrainingRecord interface used in TrainingRecordView.
 */
export interface TrainingRecordData {
  id: string;
  facilityName?: string;
  trainingName: string;
  trainingType: 'internal' | 'external' | 'online' | 'oj_training';
  trainingCategory: 'mandatory' | 'skill_improvement' | 'safety' | 'welfare' | 'medical' | 'communication';
  trainingDate: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  location: string | null;
  instructorName: string | null;
  instructorAffiliation: string | null;
  participants: TrainingParticipant[];
  evaluationMethod: string | null;
  contentSummary: string | null;
  cost: number | null;
  status: string;
}

export interface TrainingParticipant {
  name: string;
  role?: string;
  attended?: boolean;
}

/**
 * Committee meeting data.
 * Mirrors the CommitteeMeeting interface used in CommitteeView.
 */
export interface CommitteeMeetingData {
  id: string;
  facilityName?: string;
  committeeType: string;
  committeeName: string;
  meetingDate: string;
  location: string | null;
  meetingType: 'regular' | 'extraordinary';
  attendees: MeetingAttendee[];
  agenda: AgendaItem[];
  decisions: string | null;
  actionItems: ActionItem[];
  reports: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface MeetingAttendee {
  name: string;
  role?: string;
  present?: boolean;
}

export interface AgendaItem {
  title: string;
  description?: string;
  presenter?: string;
}

export interface ActionItem {
  task: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
}

// ---------- Label Maps ----------

const REPORT_TYPE_LABELS: Record<string, string> = {
  complaint: '苦情報告書',
  accident: '事故報告書',
  near_miss: 'ヒヤリハット報告書',
  injury: '怪我報告書',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: '軽微',
  medium: '中程度',
  high: '重大',
  critical: '緊急',
};

const TRAINING_TYPE_LABELS: Record<string, string> = {
  internal: '社内研修',
  external: '外部研修',
  online: 'オンライン研修',
  oj_training: 'OJT',
};

const TRAINING_CATEGORY_LABELS: Record<string, string> = {
  mandatory: '法定研修',
  skill_improvement: 'スキル向上',
  safety: '安全管理',
  welfare: '福祉',
  medical: '医療',
  communication: 'コミュニケーション',
};

const COMMITTEE_TYPE_LABELS: Record<string, string> = {
  operation_promotion: '運営推進会議',
  abuse_prevention: '虐待防止委員会',
  restraint_review: '身体拘束適正化委員会',
  safety: '安全委員会',
  infection_control: '感染症対策委員会',
  quality_improvement: '質の改善委員会',
  other: 'その他',
};

// ---------- Shared CSS ----------

function baseStyles(): string {
  return `
    <style>
      @page {
        size: A4;
        margin: 15mm;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", "Yu Gothic", sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #1a1a1a;
        background: white;
      }
      .page {
        max-width: 210mm;
        margin: 0 auto;
        padding: 10mm;
      }
      .title {
        text-align: center;
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 8mm;
        border-bottom: 2px solid #333;
        padding-bottom: 4mm;
      }
      .subtitle {
        text-align: center;
        font-size: 12pt;
        color: #555;
        margin-bottom: 6mm;
      }
      .meta-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6mm;
      }
      .meta-table td {
        padding: 3px 8px;
        font-size: 10pt;
        vertical-align: top;
      }
      .meta-table .label {
        font-weight: bold;
        width: 120px;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
      }
      .meta-table .value {
        border: 1px solid #ddd;
      }
      .section-title {
        font-size: 12pt;
        font-weight: bold;
        margin-top: 6mm;
        margin-bottom: 3mm;
        padding-left: 4px;
        border-left: 4px solid #2563eb;
      }
      .content-box {
        border: 1px solid #ddd;
        padding: 4mm;
        margin-bottom: 4mm;
        min-height: 15mm;
        white-space: pre-wrap;
        font-size: 10pt;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6mm;
        font-size: 10pt;
      }
      .data-table th {
        background-color: #f0f4f8;
        border: 1px solid #ccc;
        padding: 4px 8px;
        text-align: left;
        font-weight: bold;
      }
      .data-table td {
        border: 1px solid #ccc;
        padding: 4px 8px;
        vertical-align: top;
      }
      .badge {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 4px;
        font-size: 9pt;
        font-weight: bold;
      }
      .badge-red { background: #fee2e2; color: #991b1b; }
      .badge-orange { background: #ffedd5; color: #9a3412; }
      .badge-yellow { background: #fef9c3; color: #854d0e; }
      .badge-green { background: #dcfce7; color: #166534; }
      .badge-blue { background: #dbeafe; color: #1e40af; }
      .badge-gray { background: #f3f4f6; color: #374151; }
      .footer {
        margin-top: 10mm;
        padding-top: 4mm;
        border-top: 1px solid #ccc;
        font-size: 9pt;
        color: #888;
        text-align: right;
      }
      .stamp-area {
        float: right;
        display: flex;
        gap: 4mm;
        margin-bottom: 4mm;
      }
      .stamp-box {
        width: 22mm;
        height: 22mm;
        border: 1px solid #999;
        text-align: center;
        font-size: 8pt;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding-bottom: 2px;
      }
      .clearfix::after {
        content: "";
        display: table;
        clear: both;
      }
      @media print {
        body { background: white; }
        .page { padding: 0; max-width: none; }
        .no-print { display: none; }
      }
    </style>
  `;
}

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
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function severityBadge(severity: string): string {
  const cls =
    severity === 'critical'
      ? 'badge-red'
      : severity === 'high'
        ? 'badge-orange'
        : severity === 'medium'
          ? 'badge-yellow'
          : 'badge-green';
  return `<span class="badge ${cls}">${escapeHtml(SEVERITY_LABELS[severity] ?? severity)}</span>`;
}

// ---------- 1. Incident Report HTML ----------

/**
 * Generate a printable HTML document for an incident / complaint / near-miss report.
 * The returned HTML is a full document (with <html>, <head>, <body>) suitable for
 * opening in a new window and printing via window.print().
 */
export function generateIncidentReportHTML(report: IncidentReportData): string {
  const typeLabel = REPORT_TYPE_LABELS[report.reportType] ?? '報告書';

  const isComplaint = report.reportType === 'complaint';
  const isAccident = report.reportType === 'accident' || report.reportType === 'injury';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(typeLabel)} - ${escapeHtml(report.title)}</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <!-- Stamp area -->
    <div class="stamp-area">
      <div class="stamp-box">施設長</div>
      <div class="stamp-box">管理者</div>
      <div class="stamp-box">担当</div>
    </div>
    <div class="clearfix"></div>

    <div class="title">${escapeHtml(typeLabel)}</div>

    <!-- Basic Information -->
    <table class="meta-table">
      <tr>
        <td class="label">施設名</td>
        <td class="value">${escapeHtml(report.facilityName)}</td>
        <td class="label">報告書番号</td>
        <td class="value">${escapeHtml(report.id.slice(0, 8))}</td>
      </tr>
      <tr>
        <td class="label">件名</td>
        <td class="value" colspan="3">${escapeHtml(report.title)}</td>
      </tr>
      <tr>
        <td class="label">発生日時</td>
        <td class="value">${formatDateTime(report.occurredAt)}</td>
        <td class="label">重大度</td>
        <td class="value">${severityBadge(report.severity)}</td>
      </tr>
      <tr>
        <td class="label">発見日時</td>
        <td class="value">${formatDateTime(report.discoveredAt)}</td>
        <td class="label">報告日</td>
        <td class="value">${formatDateTime(report.reportedAt)}</td>
      </tr>
      <tr>
        <td class="label">発生場所</td>
        <td class="value">${escapeHtml(report.location)}</td>
        <td class="label">報告者</td>
        <td class="value">${escapeHtml(report.reporterName)}</td>
      </tr>
      ${report.childName ? `
      <tr>
        <td class="label">対象児童</td>
        <td class="value" colspan="3">${escapeHtml(report.childName)}</td>
      </tr>` : ''}
    </table>

    <!-- Description -->
    <div class="section-title">事象の詳細</div>
    <div class="content-box">${escapeHtml(report.description)}</div>

    ${isAccident ? `
    <!-- Injury Details (Accident / Injury only) -->
    <div class="section-title">怪我の状況</div>
    <div class="content-box">${escapeHtml(report.injuryDetails) || '記録なし'}</div>

    <table class="meta-table">
      <tr>
        <td class="label">医療機関受診</td>
        <td class="value">${report.hospitalVisit ? 'あり' : 'なし'}</td>
        <td class="label">家族への連絡</td>
        <td class="value">${report.familyNotified ? '連絡済' : '未連絡'}</td>
      </tr>
    </table>
    ` : ''}

    ${isComplaint ? `
    <!-- Complaint Details -->
    <div class="section-title">苦情内容</div>
    <table class="meta-table">
      <tr>
        <td class="label">苦情申立者</td>
        <td class="value" colspan="3">${escapeHtml(report.complainantName)}</td>
      </tr>
    </table>
    <div class="content-box">${escapeHtml(report.complaintContent)}</div>

    <div class="section-title">対応内容</div>
    <div class="content-box">${escapeHtml(report.responseContent) || '記録なし'}</div>
    ` : ''}

    <!-- Cause -->
    <div class="section-title">原因</div>
    <div class="content-box">${escapeHtml(report.cause) || '調査中'}</div>

    <!-- Immediate Action -->
    <div class="section-title">応急処置・初期対応</div>
    <div class="content-box">${escapeHtml(report.immediateAction) || '記録なし'}</div>

    <!-- Prevention -->
    <div class="section-title">再発防止策</div>
    <div class="content-box">${escapeHtml(report.preventionMeasures) || '検討中'}</div>

    <!-- Improvement Plan -->
    <div class="section-title">改善計画</div>
    <div class="content-box">${escapeHtml(report.improvementPlan) || '検討中'}</div>

    <!-- Administrative Reporting -->
    <table class="meta-table">
      <tr>
        <td class="label">行政報告要否</td>
        <td class="value">${report.adminReportRequired ? '要' : '不要'}</td>
        <td class="label">行政報告済</td>
        <td class="value">${report.adminReported ? '報告済' : '未報告'}</td>
      </tr>
    </table>

    <div class="footer">
      作成日: ${formatDate(report.createdAt)} | Roots システム出力
    </div>
  </div>
</body>
</html>`;
}

// ---------- 2. Training Record HTML ----------

/**
 * Generate a printable HTML document for a training record (研修議事録).
 */
export function generateTrainingRecordHTML(record: TrainingRecordData): string {
  const typeLabel = TRAINING_TYPE_LABELS[record.trainingType] ?? record.trainingType;
  const categoryLabel = TRAINING_CATEGORY_LABELS[record.trainingCategory] ?? record.trainingCategory;

  const participantRows = (record.participants ?? [])
    .map(
      (p: TrainingParticipant, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.role)}</td>
        <td>${p.attended === false ? '欠席' : '出席'}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>研修記録 - ${escapeHtml(record.trainingName)}</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <!-- Stamp area -->
    <div class="stamp-area">
      <div class="stamp-box">施設長</div>
      <div class="stamp-box">管理者</div>
    </div>
    <div class="clearfix"></div>

    <div class="title">研修記録</div>

    <!-- Basic Information -->
    <table class="meta-table">
      <tr>
        <td class="label">施設名</td>
        <td class="value" colspan="3">${escapeHtml(record.facilityName)}</td>
      </tr>
      <tr>
        <td class="label">研修名</td>
        <td class="value" colspan="3">${escapeHtml(record.trainingName)}</td>
      </tr>
      <tr>
        <td class="label">研修区分</td>
        <td class="value">${escapeHtml(typeLabel)}</td>
        <td class="label">研修分野</td>
        <td class="value">${escapeHtml(categoryLabel)}</td>
      </tr>
      <tr>
        <td class="label">実施日</td>
        <td class="value">${formatDate(record.trainingDate)}</td>
        <td class="label">時間</td>
        <td class="value">${record.startTime ?? '-'} 〜 ${record.endTime ?? '-'}${record.durationHours ? ` (${record.durationHours}時間)` : ''}</td>
      </tr>
      <tr>
        <td class="label">場所</td>
        <td class="value">${escapeHtml(record.location) || '-'}</td>
        <td class="label">費用</td>
        <td class="value">${record.cost != null ? `${record.cost.toLocaleString()}円` : '-'}</td>
      </tr>
      <tr>
        <td class="label">講師名</td>
        <td class="value">${escapeHtml(record.instructorName) || '-'}</td>
        <td class="label">所属</td>
        <td class="value">${escapeHtml(record.instructorAffiliation) || '-'}</td>
      </tr>
    </table>

    <!-- Participants -->
    <div class="section-title">参加者一覧</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:40px">No.</th>
          <th>氏名</th>
          <th>役職</th>
          <th style="width:60px">出欠</th>
        </tr>
      </thead>
      <tbody>
        ${participantRows || '<tr><td colspan="4">参加者データなし</td></tr>'}
      </tbody>
    </table>

    <!-- Content Summary -->
    <div class="section-title">研修内容</div>
    <div class="content-box">${escapeHtml(record.contentSummary) || '記録なし'}</div>

    <!-- Evaluation -->
    <div class="section-title">評価方法</div>
    <div class="content-box">${escapeHtml(record.evaluationMethod) || '記録なし'}</div>

    <div class="footer">
      Roots システム出力
    </div>
  </div>
</body>
</html>`;
}

// ---------- 3. Committee Meeting HTML ----------

/**
 * Generate a printable HTML document for committee meeting minutes (委員会議事録).
 */
export function generateCommitteeMeetingHTML(meeting: CommitteeMeetingData): string {
  const committeeLabel = COMMITTEE_TYPE_LABELS[meeting.committeeType] ?? meeting.committeeName;
  const meetingTypeLabel = meeting.meetingType === 'extraordinary' ? '臨時' : '定例';

  const attendeeRows = (meeting.attendees ?? [])
    .map(
      (a: MeetingAttendee, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(a.name)}</td>
        <td>${escapeHtml(a.role)}</td>
        <td>${a.present === false ? '欠席' : '出席'}</td>
      </tr>`,
    )
    .join('');

  const agendaRows = (meeting.agenda ?? [])
    .map(
      (item: AgendaItem, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.presenter)}</td>
      </tr>`,
    )
    .join('');

  const actionRows = (meeting.actionItems ?? [])
    .map(
      (item: ActionItem, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.task)}</td>
        <td>${escapeHtml(item.assignee)}</td>
        <td>${escapeHtml(item.dueDate)}</td>
        <td>${escapeHtml(item.status)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(committeeLabel)} 議事録</title>
  ${baseStyles()}
</head>
<body>
  <div class="page">
    <!-- Stamp area -->
    <div class="stamp-area">
      <div class="stamp-box">委員長</div>
      <div class="stamp-box">施設長</div>
      <div class="stamp-box">記録者</div>
    </div>
    <div class="clearfix"></div>

    <div class="title">${escapeHtml(committeeLabel)} 議事録</div>
    <div class="subtitle">${meetingTypeLabel}会議</div>

    <!-- Basic Information -->
    <table class="meta-table">
      <tr>
        <td class="label">施設名</td>
        <td class="value" colspan="3">${escapeHtml(meeting.facilityName)}</td>
      </tr>
      <tr>
        <td class="label">委員会名</td>
        <td class="value">${escapeHtml(meeting.committeeName)}</td>
        <td class="label">区分</td>
        <td class="value">${escapeHtml(committeeLabel)}</td>
      </tr>
      <tr>
        <td class="label">開催日</td>
        <td class="value">${formatDate(meeting.meetingDate)}</td>
        <td class="label">会議種別</td>
        <td class="value">${meetingTypeLabel}</td>
      </tr>
      <tr>
        <td class="label">開催場所</td>
        <td class="value" colspan="3">${escapeHtml(meeting.location) || '-'}</td>
      </tr>
      ${meeting.approvedBy ? `
      <tr>
        <td class="label">承認者</td>
        <td class="value">${escapeHtml(meeting.approvedBy)}</td>
        <td class="label">承認日</td>
        <td class="value">${formatDate(meeting.approvedAt)}</td>
      </tr>` : ''}
    </table>

    <!-- Attendees -->
    <div class="section-title">出席者</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:40px">No.</th>
          <th>氏名</th>
          <th>役職</th>
          <th style="width:60px">出欠</th>
        </tr>
      </thead>
      <tbody>
        ${attendeeRows || '<tr><td colspan="4">出席者データなし</td></tr>'}
      </tbody>
    </table>

    <!-- Agenda -->
    <div class="section-title">議題</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:40px">No.</th>
          <th>議題</th>
          <th>内容</th>
          <th>発表者</th>
        </tr>
      </thead>
      <tbody>
        ${agendaRows || '<tr><td colspan="4">議題データなし</td></tr>'}
      </tbody>
    </table>

    <!-- Decisions -->
    <div class="section-title">決定事項</div>
    <div class="content-box">${escapeHtml(meeting.decisions) || '記録なし'}</div>

    <!-- Reports -->
    ${meeting.reports ? `
    <div class="section-title">報告事項</div>
    <div class="content-box">${escapeHtml(meeting.reports)}</div>
    ` : ''}

    <!-- Action Items -->
    <div class="section-title">アクション項目</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:40px">No.</th>
          <th>内容</th>
          <th>担当者</th>
          <th>期限</th>
          <th>状況</th>
        </tr>
      </thead>
      <tbody>
        ${actionRows || '<tr><td colspan="5">アクション項目なし</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      Roots システム出力
    </div>
  </div>
</body>
</html>`;
}

// ---------- Helper: Open Print Window ----------

/**
 * Open a new browser window with the given HTML content and trigger the print dialog.
 * This is a convenience function used by UI components.
 */
export function openPrintWindow(html: string): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) {
    alert('ポップアップがブロックされました。ポップアップを許可してください。');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for content to render before triggering print
  printWindow.onload = () => {
    printWindow.print();
  };
}
