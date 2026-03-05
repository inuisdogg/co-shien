import type { Metadata } from 'next';
import CareerLPClient from './CareerLPClient';

export const metadata: Metadata = {
  title: 'Roots キャリア — 福祉の資格・経歴をスマホで管理',
  description:
    '保育士・児童指導員のための無料キャリア管理アプリ。資格証のデジタル保管、履歴書自動作成、実務経験証明書の発行がスマホひとつで完結。',
  openGraph: {
    title: 'Roots キャリア — 福祉の資格・経歴をスマホで管理',
    description:
      '保育士・児童指導員のための無料キャリア管理アプリ。資格証のデジタル保管、履歴書自動作成、実務経験証明書の発行がスマホひとつで完結。',
    type: 'website',
    url: 'https://and-roots.jp/career/lp',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roots キャリア — 福祉の資格・経歴をスマホで管理',
    description: '保育士・児童指導員のための無料キャリア管理アプリ',
  },
};

export const dynamic = 'force-dynamic';

export default function CareerLPPage() {
  return <CareerLPClient />;
}
