import type { Metadata } from 'next';
import IncomeCalculatorClient from './IncomeCalculatorClient';

export const metadata: Metadata = {
  title: '扶養内パート年収計算ツール【保育士・福祉職向け無料】| Roots',
  description:
    '扶養内パートの年収を無料で計算。103万の壁・106万の壁・130万の壁・150万の壁を一覧比較。保育士・児童指導員・福祉職のパート年収シミュレーションに。時給・勤務日数から手取り概算まで自動計算。',
  openGraph: {
    title: '扶養内パート年収計算ツール【保育士・福祉職向け無料】| Roots',
    description:
      '扶養内パートの年収を無料で計算。103万の壁・130万の壁を一覧比較。保育士・福祉職のパート年収シミュレーションに。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '扶養内パート年収計算ツール【保育士・福祉職向け無料】| Roots',
    description:
      '扶養内パートの年収を無料で計算。103万の壁・130万の壁を一覧比較。保育士・福祉職のパート年収シミュレーションに。',
  },
};

export default function Page() {
  return <IncomeCalculatorClient />;
}
