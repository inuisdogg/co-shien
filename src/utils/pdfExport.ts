/**
 * PDF帳票出力ユーティリティ
 * 運営指導書類のPDF出力を行うための共通基盤
 */

import jsPDF from 'jspdf';

// A4サイズの定義
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 15;

// フォント設定
const FONT_SIZE = {
  title: 16,
  subtitle: 12,
  normal: 10,
  small: 8,
};

// 行の高さ
const LINE_HEIGHT = 6;

// PDF生成オプション
export interface PdfOptions {
  title?: string;
  subtitle?: string;
  facilityName?: string;
  facilityCode?: string;
  createdAt?: string;
  orientation?: 'portrait' | 'landscape';
  showPageNumbers?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
}

// テーブルのカラム定義
export interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

// 日付フォーマット
export const formatDate = (date: string | Date, format: 'full' | 'short' | 'jp' = 'jp'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  switch (format) {
    case 'full':
      return `${year}年${month}月${day}日`;
    case 'short':
      return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
    case 'jp':
    default:
      return `${year}年${month}月${day}日`;
  }
};

// 和暦変換
export const toJapaneseEra = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  // 令和 (2019年5月1日〜)
  if (year > 2019 || (year === 2019 && (month > 5 || (month === 5 && day >= 1)))) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear === 1 ? '元' : reiwaYear}年${month}月${day}日`;
  }

  // 平成 (1989年1月8日〜2019年4月30日)
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear === 1 ? '元' : heiseiYear}年${month}月${day}日`;
  }

  return `${year}年${month}月${day}日`;
};

/**
 * PDFドキュメントクラス
 * 帳票作成のためのヘルパーメソッドを提供
 */
export class PdfDocument {
  private doc: jsPDF;
  private currentY: number = MARGIN;
  private pageNumber: number = 1;
  private options: PdfOptions;

  constructor(options: PdfOptions = {}) {
    this.options = {
      showPageNumbers: true,
      showHeader: true,
      showFooter: true,
      ...options,
    };

    this.doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // デフォルトフォント（日本語フォントは後で追加可能）
    this.doc.setFont('helvetica');
  }

  /**
   * ヘッダーを描画
   */
  drawHeader(): void {
    if (!this.options.showHeader) return;

    const { title, facilityName, facilityCode } = this.options;
    const pageWidth = this.doc.internal.pageSize.getWidth();

    // 施設情報（右上）
    if (facilityName) {
      this.doc.setFontSize(FONT_SIZE.small);
      this.doc.text(facilityName, pageWidth - MARGIN, MARGIN, { align: 'right' });
      if (facilityCode) {
        this.doc.text(`(${facilityCode})`, pageWidth - MARGIN, MARGIN + 4, { align: 'right' });
      }
    }

    // タイトル（中央）
    if (title) {
      this.doc.setFontSize(FONT_SIZE.title);
      this.doc.text(title, pageWidth / 2, MARGIN + 10, { align: 'center' });
      this.currentY = MARGIN + 20;
    }

    this.doc.setFontSize(FONT_SIZE.normal);
  }

  /**
   * フッターを描画
   */
  drawFooter(): void {
    if (!this.options.showFooter) return;

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();

    this.doc.setFontSize(FONT_SIZE.small);

    // ページ番号
    if (this.options.showPageNumbers) {
      this.doc.text(`${this.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // 作成日時
    if (this.options.createdAt) {
      this.doc.text(`Created: ${this.options.createdAt}`, MARGIN, pageHeight - 10);
    }
  }

  /**
   * 新しいページを追加
   */
  addPage(): void {
    this.drawFooter();
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = MARGIN;
    this.drawHeader();
  }

  /**
   * 現在のY位置がページ下部に達していないかチェック
   */
  checkPageBreak(requiredHeight: number = LINE_HEIGHT): boolean {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.currentY + requiredHeight > pageHeight - MARGIN - 15) {
      this.addPage();
      return true;
    }
    return false;
  }

  /**
   * テキストを追加
   */
  addText(
    text: string,
    options: {
      fontSize?: number;
      align?: 'left' | 'center' | 'right';
      bold?: boolean;
      x?: number;
      lineHeight?: number;
    } = {}
  ): void {
    const {
      fontSize = FONT_SIZE.normal,
      align = 'left',
      bold = false,
      x = MARGIN,
      lineHeight = LINE_HEIGHT,
    } = options;

    this.checkPageBreak(lineHeight);

    this.doc.setFontSize(fontSize);

    const pageWidth = this.doc.internal.pageSize.getWidth();
    let xPos = x;
    if (align === 'center') xPos = pageWidth / 2;
    else if (align === 'right') xPos = pageWidth - MARGIN;

    this.doc.text(text, xPos, this.currentY, { align });
    this.currentY += lineHeight;
  }

  /**
   * 複数行のテキストを追加
   */
  addMultilineText(
    text: string,
    options: {
      fontSize?: number;
      maxWidth?: number;
      lineHeight?: number;
    } = {}
  ): void {
    const {
      fontSize = FONT_SIZE.normal,
      maxWidth = A4_WIDTH - MARGIN * 2,
      lineHeight = LINE_HEIGHT,
    } = options;

    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(text, maxWidth);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
      this.doc.text(line, MARGIN, this.currentY);
      this.currentY += lineHeight;
    }
  }

  /**
   * 空行を追加
   */
  addSpace(height: number = LINE_HEIGHT): void {
    this.currentY += height;
  }

  /**
   * 水平線を描画
   */
  addLine(options: { y?: number; startX?: number; endX?: number; lineWidth?: number } = {}): void {
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const {
      y = this.currentY,
      startX = MARGIN,
      endX = pageWidth - MARGIN,
      lineWidth = 0.5,
    } = options;

    this.doc.setLineWidth(lineWidth);
    this.doc.line(startX, y, endX, y);
    this.currentY = y + 2;
  }

  /**
   * ラベルと値のペアを追加
   */
  addLabelValue(
    label: string,
    value: string,
    options: {
      labelWidth?: number;
      fontSize?: number;
    } = {}
  ): void {
    const { labelWidth = 40, fontSize = FONT_SIZE.normal } = options;

    this.checkPageBreak();
    this.doc.setFontSize(fontSize);
    this.doc.text(`${label}:`, MARGIN, this.currentY);
    this.doc.text(value || '-', MARGIN + labelWidth, this.currentY);
    this.currentY += LINE_HEIGHT;
  }

  /**
   * 署名欄を追加
   */
  addSignatureBlock(
    signatures: Array<{
      role: string;
      name?: string;
      date?: string;
      signed?: boolean;
    }>
  ): void {
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const blockWidth = (pageWidth - MARGIN * 2) / signatures.length;

    this.addSpace(10);
    this.addLine();
    this.addSpace(5);

    signatures.forEach((sig, index) => {
      const x = MARGIN + blockWidth * index;

      // 役職
      this.doc.setFontSize(FONT_SIZE.small);
      this.doc.text(sig.role, x + blockWidth / 2, this.currentY, { align: 'center' });

      // 署名欄（枠線）
      this.doc.rect(x + 5, this.currentY + 3, blockWidth - 10, 15);

      // 署名済みの場合
      if (sig.signed && sig.name) {
        this.doc.setFontSize(FONT_SIZE.normal);
        this.doc.text(sig.name, x + blockWidth / 2, this.currentY + 12, { align: 'center' });
      }

      // 日付
      if (sig.date) {
        this.doc.setFontSize(FONT_SIZE.small);
        this.doc.text(sig.date, x + blockWidth / 2, this.currentY + 22, { align: 'center' });
      }
    });

    this.currentY += 30;
  }

  /**
   * シンプルなテーブルを描画
   */
  addTable(
    columns: TableColumn[],
    rows: Record<string, any>[],
    options: {
      headerBgColor?: string;
      rowHeight?: number;
      fontSize?: number;
    } = {}
  ): void {
    const { rowHeight = 8, fontSize = FONT_SIZE.small } = options;
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - MARGIN * 2;

    // カラム幅の計算
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const widthMultiplier = tableWidth / totalWidth;

    let currentX = MARGIN;

    // ヘッダー行
    this.checkPageBreak(rowHeight * 2);
    this.doc.setFontSize(fontSize);
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(MARGIN, this.currentY - 1, tableWidth, rowHeight, 'F');

    columns.forEach((col) => {
      const colWidth = col.width * widthMultiplier;
      const align = col.align || 'left';
      let textX = currentX + 2;
      if (align === 'center') textX = currentX + colWidth / 2;
      else if (align === 'right') textX = currentX + colWidth - 2;

      this.doc.text(col.header, textX, this.currentY + 4, { align });
      currentX += colWidth;
    });

    this.currentY += rowHeight;

    // データ行
    rows.forEach((row, rowIndex) => {
      this.checkPageBreak(rowHeight);
      currentX = MARGIN;

      // 交互の背景色
      if (rowIndex % 2 === 1) {
        this.doc.setFillColor(250, 250, 250);
        this.doc.rect(MARGIN, this.currentY - 1, tableWidth, rowHeight, 'F');
      }

      columns.forEach((col) => {
        const colWidth = col.width * widthMultiplier;
        const value = String(row[col.key] ?? '');
        const align = col.align || 'left';
        let textX = currentX + 2;
        if (align === 'center') textX = currentX + colWidth / 2;
        else if (align === 'right') textX = currentX + colWidth - 2;

        // テキストが長い場合は切り詰め
        const maxChars = Math.floor(colWidth / 2.5);
        const displayText = value.length > maxChars ? value.substring(0, maxChars - 2) + '..' : value;

        this.doc.text(displayText, textX, this.currentY + 4, { align });
        currentX += colWidth;
      });

      this.currentY += rowHeight;
    });

    // テーブル枠線
    this.doc.setLineWidth(0.3);
    this.doc.rect(MARGIN, this.currentY - rowHeight * (rows.length + 1), tableWidth, rowHeight * (rows.length + 1));

    this.addSpace(5);
  }

  /**
   * PDFを保存
   */
  save(filename: string): void {
    this.drawFooter();
    this.doc.save(filename);
  }

  /**
   * PDFをBlobとして取得
   */
  getBlob(): Blob {
    this.drawFooter();
    return this.doc.output('blob');
  }

  /**
   * PDFをBase64として取得
   */
  getBase64(): string {
    this.drawFooter();
    return this.doc.output('datauristring');
  }

  /**
   * 内部のjsPDFインスタンスを取得（高度なカスタマイズ用）
   */
  getDoc(): jsPDF {
    return this.doc;
  }

  /**
   * 現在のY位置を取得
   */
  getCurrentY(): number {
    return this.currentY;
  }

  /**
   * Y位置を設定
   */
  setCurrentY(y: number): void {
    this.currentY = y;
  }
}

/**
 * 業務日誌PDFを生成
 */
export const generateDailyLogPdf = (
  log: {
    date: string;
    weather?: string;
    temperature?: number;
    attendanceSummary?: {
      scheduled?: number;
      actual?: number;
      absent?: number;
    };
    activities?: Array<{ time: string; activity: string; staff?: string }>;
    specialNotes?: string;
    safetyCheck?: boolean;
  },
  facilityInfo: { name: string; code?: string }
): PdfDocument => {
  const pdf = new PdfDocument({
    title: '業務日誌',
    facilityName: facilityInfo.name,
    facilityCode: facilityInfo.code,
    createdAt: formatDate(new Date(), 'short'),
  });

  pdf.drawHeader();
  pdf.addSpace(5);

  // 日付
  pdf.addText(`日付: ${toJapaneseEra(log.date)}`, { fontSize: FONT_SIZE.subtitle });
  pdf.addSpace(3);

  // 基本情報
  pdf.addLabelValue('天気', log.weather || '-');
  if (log.temperature !== undefined) {
    pdf.addLabelValue('気温', `${log.temperature}°C`);
  }

  pdf.addSpace(5);
  pdf.addLine();
  pdf.addSpace(5);

  // 出席状況
  if (log.attendanceSummary) {
    pdf.addText('出席状況', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addLabelValue('予定人数', String(log.attendanceSummary.scheduled || 0));
    pdf.addLabelValue('実際人数', String(log.attendanceSummary.actual || 0));
    pdf.addLabelValue('欠席人数', String(log.attendanceSummary.absent || 0));
  }

  pdf.addSpace(5);
  pdf.addLine();
  pdf.addSpace(5);

  // 活動内容
  if (log.activities && log.activities.length > 0) {
    pdf.addText('活動内容', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addTable(
      [
        { header: '時間', key: 'time', width: 20 },
        { header: '活動', key: 'activity', width: 60 },
        { header: '担当', key: 'staff', width: 20 },
      ],
      log.activities
    );
  }

  // 特記事項
  if (log.specialNotes) {
    pdf.addSpace(5);
    pdf.addText('特記事項', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addMultilineText(log.specialNotes);
  }

  // 安全確認
  pdf.addSpace(10);
  pdf.addLabelValue('安全確認', log.safetyCheck ? '確認済み' : '未確認');

  return pdf;
};

/**
 * 個別支援計画PDFを生成
 */
export const generateServicePlanPdf = (
  plan: {
    childName: string;
    planType: string;
    periodStart: string;
    periodEnd: string;
    createdByName?: string;
    createdDate?: string;
    currentSituation?: string;
    issues?: string;
    strengths?: string;
    interests?: string;
    longTermGoals?: Array<{ goal: string; domain: string }>;
    shortTermGoals?: Array<{ goal: string; domain: string; targetDate?: string }>;
    supportContent?: Array<{ category: string; content: string; frequency?: string }>;
    specialNotes?: string;
    familyCooperation?: string;
  },
  facilityInfo: { name: string; code?: string }
): PdfDocument => {
  const pdf = new PdfDocument({
    title: '個別支援計画書',
    facilityName: facilityInfo.name,
    facilityCode: facilityInfo.code,
    createdAt: formatDate(new Date(), 'short'),
  });

  pdf.drawHeader();
  pdf.addSpace(5);

  // 基本情報
  const planTypeLabel = plan.planType === 'initial' ? '初回' : plan.planType === 'renewal' ? '更新' : '変更';
  pdf.addLabelValue('児童名', plan.childName);
  pdf.addLabelValue('計画種別', planTypeLabel);
  pdf.addLabelValue('計画期間', `${toJapaneseEra(plan.periodStart)} 〜 ${toJapaneseEra(plan.periodEnd)}`);
  if (plan.createdByName) pdf.addLabelValue('作成者', plan.createdByName);
  if (plan.createdDate) pdf.addLabelValue('作成日', toJapaneseEra(plan.createdDate));

  pdf.addSpace(5);
  pdf.addLine();
  pdf.addSpace(5);

  // 児童の状況
  pdf.addText('児童の状況', { fontSize: FONT_SIZE.subtitle });
  pdf.addSpace(3);
  if (plan.currentSituation) {
    pdf.addText('現在の状況:', { fontSize: FONT_SIZE.small });
    pdf.addMultilineText(plan.currentSituation);
  }
  if (plan.issues) {
    pdf.addText('課題:', { fontSize: FONT_SIZE.small });
    pdf.addMultilineText(plan.issues);
  }
  if (plan.strengths) {
    pdf.addText('強み・得意なこと:', { fontSize: FONT_SIZE.small });
    pdf.addMultilineText(plan.strengths);
  }
  if (plan.interests) {
    pdf.addText('興味・関心:', { fontSize: FONT_SIZE.small });
    pdf.addMultilineText(plan.interests);
  }

  pdf.addSpace(5);
  pdf.addLine();
  pdf.addSpace(5);

  // 目標
  if (plan.longTermGoals && plan.longTermGoals.length > 0) {
    pdf.addText('長期目標', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    plan.longTermGoals.forEach((goal, i) => {
      pdf.addText(`${i + 1}. [${goal.domain}] ${goal.goal}`);
    });
  }

  if (plan.shortTermGoals && plan.shortTermGoals.length > 0) {
    pdf.addSpace(5);
    pdf.addText('短期目標', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addTable(
      [
        { header: '領域', key: 'domain', width: 20 },
        { header: '目標', key: 'goal', width: 50 },
        { header: '達成予定', key: 'targetDate', width: 30 },
      ],
      plan.shortTermGoals.map((g) => ({
        ...g,
        targetDate: g.targetDate ? formatDate(g.targetDate, 'short') : '-',
      }))
    );
  }

  // 支援内容
  if (plan.supportContent && plan.supportContent.length > 0) {
    pdf.addSpace(5);
    pdf.addText('支援内容', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addTable(
      [
        { header: 'カテゴリ', key: 'category', width: 25 },
        { header: '内容', key: 'content', width: 50 },
        { header: '頻度', key: 'frequency', width: 25 },
      ],
      plan.supportContent
    );
  }

  // 特記事項・家庭との連携
  if (plan.specialNotes) {
    pdf.addSpace(5);
    pdf.addText('特記事項', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addMultilineText(plan.specialNotes);
  }

  if (plan.familyCooperation) {
    pdf.addSpace(5);
    pdf.addText('家庭との連携', { fontSize: FONT_SIZE.subtitle });
    pdf.addSpace(3);
    pdf.addMultilineText(plan.familyCooperation);
  }

  // 署名欄
  pdf.addSignatureBlock([
    { role: '保護者', signed: false },
    { role: '担当者', signed: false },
    { role: '管理者', signed: false },
  ]);

  return pdf;
};

export default PdfDocument;
