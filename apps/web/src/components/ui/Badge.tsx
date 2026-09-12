// ==============================================================================
// KisanFlow — Status Badge Component
// ==============================================================================

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    info: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
};
