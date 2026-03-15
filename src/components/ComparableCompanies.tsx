import { ComparableCompany } from '../types/financial';
import { formatNumber } from '../utils/formatters';
import { Plus, Trash2, Building2 } from 'lucide-react';

interface Props {
  comparables: ComparableCompany[];
  onChange: (comparables: ComparableCompany[]) => void;
}

export function ComparableCompanies({ comparables, onChange }: Props) {
  const addCompany = () => {
    onChange([
      ...comparables,
      { name: `Company ${comparables.length + 1}`, ticker: '', peRatio: 20, evEbitda: 12, psRatio: 3, pbRatio: 4, marketCap: 0, revenue: 0 },
    ]);
  };

  const removeCompany = (index: number) => {
    onChange(comparables.filter((_, i) => i !== index));
  };

  const updateCompany = (index: number, field: keyof ComparableCompany, value: string | number) => {
    const updated = [...comparables];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const inputClass = "w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm";

  const avgPE = comparables.length > 0 ? comparables.reduce((s, c) => s + c.peRatio, 0) / comparables.length : 0;
  const avgEV = comparables.length > 0 ? comparables.reduce((s, c) => s + c.evEbitda, 0) / comparables.length : 0;
  const avgPS = comparables.length > 0 ? comparables.reduce((s, c) => s + c.psRatio, 0) / comparables.length : 0;
  const avgPB = comparables.length > 0 ? comparables.reduce((s, c) => s + c.pbRatio, 0) / comparables.length : 0;

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-gold)]/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Comparable Companies</h2>
        </div>
        <button
          onClick={addCompany}
          className="flex items-center gap-1 px-3 py-1.5 btn-gold text-white rounded-lg text-sm transition-all shadow-lg shadow-[var(--accent-gold)]/10"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      {comparables.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">Company</th>
                <th className="text-center py-2 px-2">P/E Ratio</th>
                <th className="text-center py-2 px-2">EV/EBITDA</th>
                <th className="text-center py-2 px-2">P/S Ratio</th>
                <th className="text-center py-2 px-2">P/B Ratio</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((company, index) => (
                <tr key={index} className="border-b border-zinc-800/50">
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => updateCompany(index, 'name', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="0.1"
                      value={company.peRatio}
                      onChange={(e) => updateCompany(index, 'peRatio', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-center`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="0.1"
                      value={company.evEbitda}
                      onChange={(e) => updateCompany(index, 'evEbitda', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-center`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="0.1"
                      value={company.psRatio}
                      onChange={(e) => updateCompany(index, 'psRatio', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-center`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step="0.1"
                      value={company.pbRatio}
                      onChange={(e) => updateCompany(index, 'pbRatio', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-center`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => removeCompany(index)}
                      className="p-1.5 text-red-500 hover:text-[var(--accent-gold)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-900/70 font-medium">
                <td className="py-2 px-2 text-red-400">Average</td>
                <td className="py-2 px-2 text-center text-white">{formatNumber(avgPE, 1)}x</td>
                <td className="py-2 px-2 text-center text-white">{formatNumber(avgEV, 1)}x</td>
                <td className="py-2 px-2 text-center text-white">{formatNumber(avgPS, 1)}x</td>
                <td className="py-2 px-2 text-center text-white">{formatNumber(avgPB, 1)}x</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {comparables.length === 0 && (
        <div className="text-center py-8 text-zinc-600">
          <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No comparable companies added</p>
          <p className="text-sm">Click "Add Company" to add peer companies for relative valuation</p>
        </div>
      )}
    </div>
  );
}
