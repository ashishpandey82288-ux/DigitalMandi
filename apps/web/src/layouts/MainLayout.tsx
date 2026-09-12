// ==============================================================================
// KisanFlow — Master Application Layout
// ==============================================================================

import React from 'react';
import { Header } from '../components/common/Header.tsx';
import { Footer } from '../components/common/Footer.tsx';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};
