// ==============================================================================
// DigitalMandi — Reusable Input Component
// ==============================================================================

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2 text-sm rounded-lg border bg-white text-neutral-900 shadow-2xs transition-all placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 ${
          error ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500 bg-rose-50/20' : 'border-neutral-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-neutral-500">{helperText}</p>}
    </div>
  );
};

