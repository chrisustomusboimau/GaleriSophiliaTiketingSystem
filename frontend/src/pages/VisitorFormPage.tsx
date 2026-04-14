import React from 'react';
import VisitorForm from '../components/VisitorForm';
import { useLanguage } from '../contexts/LanguageContext';
const VisitorFormPage: React.FC = () => {
  const {
    language,
    translations
  } = useLanguage();
  return <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {translations.ticketingTitle[language]}
          </h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <VisitorForm />
        </div>
      </main>
    </div>;
};
export default VisitorFormPage;