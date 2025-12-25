
import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-brand-white dark:bg-brand-black z-50">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-brand-black dark:border-brand-white border-t-transparent animate-spin rounded-full mb-4"></div>
        <h1 className="text-2xl font-bold tracking-tighter">SOCIALICON</h1>
      </div>
    </div>
  );
};

export default LoadingScreen;
