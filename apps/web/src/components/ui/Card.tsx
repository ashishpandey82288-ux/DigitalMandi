// ==============================================================================
// KisanFlow — Reusable Card Component
// ==============================================================================

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  footer,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-neutral-100">
          {title && <h3 className="text-base font-semibold text-neutral-900">{title}</h3>}
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 text-xs text-neutral-600">{footer}</div>}
    </div>
  );
};
