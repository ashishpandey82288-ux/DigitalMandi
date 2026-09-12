// ==============================================================================
// DigitalMandi — Reusable Button Component
// ==============================================================================

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5 shadow-sm',
  };

  const variantStyles = {
    primary:
      'bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-600 shadow-xs active:bg-emerald-900 border border-emerald-800/40',
    secondary:
      'bg-emerald-50 text-emerald-800 hover:bg-emerald-100/90 focus:ring-emerald-500 border border-emerald-200/80',
    accent:
      'bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400 focus:ring-amber-500 shadow-xs border border-amber-600/30',
    outline:
      'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50/80 hover:text-neutral-900 focus:ring-emerald-500 shadow-xs',
    ghost:
      'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-emerald-500',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-xs border border-rose-700/40',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

