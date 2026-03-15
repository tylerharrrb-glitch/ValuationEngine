/**
 * Loading fallback for React.lazy / Suspense boundaries.
 */
import React from 'react';

export const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-[var(--accent-gold)] border-t-transparent rounded-full animate-spin" />
  </div>
);

export default LoadingFallback;
