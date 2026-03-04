'use client';

import React from 'react';

interface LoadingSpinnerProps {
  /** Which portal/brand color to use */
  color?: 'primary' | 'personal' | 'client';
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Show accompanying text */
  label?: string;
  /** Full-screen centered layout */
  fullScreen?: boolean;
}

const colorMap = {
  primary: 'border-primary',
  personal: 'border-personal',
  client: 'border-client',
};

const sizeMap = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-10 h-10 border-3',
};

export default function LoadingSpinner({
  color = 'primary',
  size = 'md',
  label = '読み込み中...',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizeMap[size]} border-t-transparent ${colorMap[color]} rounded-full animate-spin`}
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  );
}
