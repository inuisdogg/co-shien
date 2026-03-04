'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon,
  title = 'データがありません',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        {icon || <Inbox className="w-7 h-7 text-gray-400" />}
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
