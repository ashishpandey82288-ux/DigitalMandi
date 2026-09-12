// ==============================================================================
// DigitalMandi — Reusable Card Component
// ==============================================================================

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  accentBorder?: 'emerald' | 'amber' | 'blue' | 'none';
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  footer,
  accentBorder = 'none',
  className = '',
  ...props
}) => {
  const accentClasses = {
    none: '',
    emerald: 'border-t-4 border-t-emerald-600',
    amber: 'border-t-4 border-t-amber-500',
    blue: 'border-t-4 border-t-blue-600',
  };

  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200/80 shadow-xs hover:border-neutral-300/80 transition-all duration-200 overflow-hidden ${accentClasses[accentBorder]} ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-sm sm:text-base font-bold text-neutral-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 bg-neutral-50/70 border-t border-neutral-100 text-xs text-neutral-600">{footer}</div>}
    </div>
  );
};

