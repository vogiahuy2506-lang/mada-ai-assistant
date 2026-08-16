/**
 * PublicLayout - Shared layout cho public pages
 * Bao gồm Header, Footer, AccessibilityToolbar
 */

import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AccessibilityToolbar } from './AccessibilityToolbar';
import { SkipToContent } from './SkipToContent';

export function PublicLayout({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SkipToContent />
      <Header />
      <main
        id="main-content"
        className="flex-1 pt-24 pb-16"
        role="main"
        aria-label="Nội dung chính"
      >
        {fullWidth ? (
          children
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        )}
      </main>
      <Footer />
      <AccessibilityToolbar />
    </div>
  );
}
