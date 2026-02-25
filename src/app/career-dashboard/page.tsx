'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CareerDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/career');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#818CF8]"></div>
    </div>
  );
}
