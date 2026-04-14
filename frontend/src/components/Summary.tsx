import React from 'react';

interface SummaryProps {
  totalVisitors: number;
  totalChildren: number;
  totalTeens: number;
  totalAdults: number;
  totalRevenue: number;
}

const Summary: React.FC<SummaryProps> = ({
  totalVisitors,
  totalChildren,
  totalTeens,
  totalAdults,
  totalRevenue,
}) => {
  // Helper to format the revenue into Indonesian Rupiah (or your preferred currency)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span className="text-sm text-gray-500 font-medium mb-1">Total Visitors</span>
        <span className="text-3xl font-bold text-gray-800">{totalVisitors}</span>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span className="text-sm text-gray-500 font-medium mb-1">Children</span>
        <span className="text-3xl font-bold text-blue-600">{totalChildren}</span>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span className="text-sm text-gray-500 font-medium mb-1">Teens</span>
        <span className="text-3xl font-bold text-indigo-600">{totalTeens}</span>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span className="text-sm text-gray-500 font-medium mb-1">Adults</span>
        <span className="text-3xl font-bold text-purple-600">{totalAdults}</span>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <span className="text-sm text-gray-500 font-medium mb-1">Total Revenue</span>
        <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
      </div>
    </div>
  );
};

export default Summary;