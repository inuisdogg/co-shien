'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/parent'); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
    </div>
  );
}
