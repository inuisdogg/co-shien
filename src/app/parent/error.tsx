'use client';

import ErrorPage from '@/components/ui/ErrorPage';

export default function ParentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage error={error} reset={reset} brand="client" homeHref="/parent" description="保護者画面の読み込み中にエラーが発生しました。再試行してください。" />;
}
