import { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase-server';
import JobDetailClient from './JobDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const supabase = createServerSupabase();
    const { data: job } = await supabase
      .from('job_postings')
      .select('title, description, employment_type, salary_min, salary_max, facility_id')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (!job) {
      return {
        title: '求人が見つかりません | Roots',
      };
    }

    const salaryText = job.salary_min && job.salary_max
      ? `${(job.salary_min / 10000).toFixed(0)}〜${(job.salary_max / 10000).toFixed(0)}万円`
      : job.salary_min
        ? `${(job.salary_min / 10000).toFixed(0)}万円〜`
        : '';

    const typeLabel = job.employment_type === 'full_time' ? '正社員' :
      job.employment_type === 'part_time' ? 'パート' : 'スポット';

    const title = `${job.title}（${typeLabel}${salaryText ? ` ${salaryText}` : ''}）| Roots`;
    const description = (job.description || '').slice(0, 160).replace(/\n/g, ' ');

    return {
      title,
      description: description || `${job.title}の求人情報。Rootsで福祉・保育の求人を探そう。`,
      openGraph: {
        title,
        description: description || `${job.title}の求人情報`,
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title,
        description: description || `${job.title}の求人情報`,
      },
    };
  } catch {
    return {
      title: '求人詳細 | Roots',
      description: '福祉・保育の求人情報',
    };
  }
}

export default function Page() {
  return <JobDetailClient />;
}
