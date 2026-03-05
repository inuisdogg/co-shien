import type { Metadata } from 'next';
import ResignationClient from './ResignationClient';

export const metadata: Metadata = {
  title: '退職届・退職願の作成ツール【保育士・福祉職向け無料】| Roots',
  description:
    '保育士・幼稚園教諭・児童指導員向けの無料退職届・退職願作成ツール。退職届の書き方がわからなくても、必要事項を入力するだけでPDFをダウンロード。福祉・保育業界に特化したテンプレートで安心。',
  openGraph: {
    title: '退職届・退職願の作成ツール【保育士・福祉職向け無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員向けの無料退職届・退職願作成ツール。退職届の書き方がわからなくても、必要事項を入力するだけでPDFをダウンロード。福祉・保育業界に特化したテンプレートで安心。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '退職届・退職願の作成ツール【保育士・福祉職向け無料】| Roots',
    description:
      '保育士・幼稚園教諭・児童指導員向けの無料退職届・退職願作成ツール。退職届の書き方がわからなくても、必要事項を入力するだけでPDFをダウンロード。福祉・保育業界に特化したテンプレートで安心。',
  },
};

export default function Page() {
  return <ResignationClient />;
}
