// ==============================================================================
// KisanFlow — Footer Component
// ==============================================================================

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-neutral-200/80 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs text-neutral-600 font-medium">
              KisanFlow — Smart Procurement & Direct MSP Engine
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Developed for Smart India Hackathon (SIH 2026) | Phase 1 Foundation Architecture
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs text-neutral-500">
            <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[11px]">
              v1.0.0-phase1
            </span>
            <span>Prisma PostgreSQL</span>
            <span>•</span>
            <span>Redis Cache</span>
            <span>•</span>
            <span>FastAPI ML</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
