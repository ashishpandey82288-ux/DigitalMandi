// ==============================================================================
// KisanFlow — Loading Spinner Component
// ==============================================================================

import React from 'react';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div
        className={`${sizeMap[size]} border-emerald-600 border-t-transparent rounded-full animate-spin`}
      />
      {label && <p className="text-xs font-medium text-neutral-600">{label}</p>}
    </div>
  );
};
