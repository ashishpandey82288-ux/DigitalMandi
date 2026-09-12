// ==============================================================================
// DigitalMandi — Status Badge Component
// ==============================================================================

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger' | 'accent' | 'primary';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-0.5 text-xs gap-1.5',
  };

  const variantStyles = {
    primary: 'bg-emerald-800 text-emerald-100 border border-emerald-700/60 font-semibold',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80 font-medium',
    accent: 'bg-amber-100/90 text-amber-900 border border-amber-300 font-semibold',
    info: 'bg-sky-50 text-sky-800 border border-sky-200/80 font-medium',
    neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-200/80 font-medium',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200/80 font-medium',
  };

  const dotColors = {
    primary: 'bg-emerald-300',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    accent: 'bg-amber-600',
    info: 'bg-sky-500',
    neutral: 'bg-neutral-400',
    danger: 'bg-rose-500',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full tracking-tight ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

