/**
 * 施設SaaS LP - /facility
 * 施設管理者向けのランディングページ
 *
 * ターゲット: 児童発達支援/放課後等デイサービスの施設長・管理者
 * 主要訴求: 監査書類ワンクリック出力、完全無料、施設運営の一元管理
 * CTA先: /career/signup?redirect=/facility/register
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roots - 完全無料の施設管理システム｜児童発達支援・放課後等デイサービス',
  description:
    '実地指導の監査書類をワンクリックで出力。勤怠管理、請求業務、児童管理、保護者連携——施設運営に必要なすべてを完全無料で。',
  openGraph: {
    title: 'Roots - 完全無料の施設管理システム',
    description:
      '実地指導の監査書類をワンクリックで出力。施設運営に必要なすべてを完全無料で。',
    type: 'website',
  },
};

import FacilityLPClient from './FacilityLPClient';

export default function FacilityPage() {
  return <FacilityLPClient />;
}
