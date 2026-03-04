'use client';

import ErrorPage from '@/components/ui/ErrorPage';

export default function BusinessError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} brand="primary" homeHref="/business" description="施設管理画面の読み込み中にエラーが発生しました。再試行してください。" />;
}
