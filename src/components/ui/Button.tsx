'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  /** Portal brand override */
  brand?: 'primary' | 'personal' | 'client';
}

const brandColors = {
  primary: {
    primary: 'bg-primary hover:bg-primary-dark text-white focus:ring-primary/30',
    secondary: 'border border-primary/20 text-primary hover:bg-primary-light focus:ring-primary/20',
    ghost: 'text-primary hover:bg-primary-light',
  },
  personal: {
    primary: 'bg-personal hover:bg-personal-dark text-white focus:ring-personal/30',
    secondary: 'border border-personal/20 text-personal hover:bg-personal-light focus:ring-personal/20',
    ghost: 'text-personal hover:bg-personal-light',
  },
  client: {
    primary: 'bg-client hover:bg-client-dark text-white focus:ring-client/30',
    secondary: 'border border-client/20 text-client hover:bg-client-light focus:ring-client/20',
    ghost: 'text-client hover:bg-client-light',
  },
};

const sizeMap = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-sm gap-2 rounded-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  brand = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  let colorClass: string;

  if (variant === 'danger') {
    colorClass = 'bg-danger hover:bg-red-600 text-white focus:ring-danger/30';
  } else if (variant === 'secondary') {
    colorClass = brandColors[brand].secondary;
  } else if (variant === 'ghost') {
    colorClass = brandColors[brand].ghost;
  } else {
    colorClass = brandColors[brand].primary;
  }

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${sizeMap[size]} ${colorClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
