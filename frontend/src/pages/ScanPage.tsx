import React from 'react';
import LanguageSelector from '../components/LanguageSelector';
const ScanPage: React.FC = () => {
  return <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Museum Ticketing</h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <LanguageSelector />
      </main>
    </div>;
};
export default ScanPage;