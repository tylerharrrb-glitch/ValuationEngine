/**
 * B4: Save/Load Valuations Panel
 * Save to localStorage named slots, export/import JSON files.
 */
import React, { useState, useEffect } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../../../types/financial';
import { Save, Upload, Download, Trash2, Clock } from 'lucide-react';

interface SavedValuation {
    name: string;
    timestamp: string;
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    comparables: ComparableCompany[];
}

interface SaveLoadPanelProps {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    comparables: ComparableCompany[];
    onLoad: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
    isDarkMode: boolean;
}

const STORAGE_KEY = 'wolf_saved_valuations';

export const SaveLoadPanel: React.FC<SaveLoadPanelProps> = ({
    financialData, assumptions, comparables, onLoad, isDarkMode,
}) => {
    const [saved, setSaved] = useState<SavedValuation[]>([]);
    const [saveName, setSaveName] = useState('');

    // Load saved list on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setSaved(JSON.parse(raw));
        } catch { /* ignore */ }
    }, []);

    const persist = (list: SavedValuation[]) => {
        setSaved(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    };

    const handleSave = () => {
        const name = saveName.trim() || `${financialData.companyName || 'Valuation'} — ${new Date().toLocaleDateString()}`;
        const entry: SavedValuation = {
            name,
            timestamp: new Date().toISOString(),
            financialData,
            assumptions,
            comparables,
        };
        persist([entry, ...saved.filter(s => s.name !== name)].slice(0, 20)); // max 20 slots
        setSaveName('');
    };

    const handleDelete = (name: string) => {
        persist(saved.filter(s => s.name !== name));
    };

    const handleLoad = (entry: SavedValuation) => {
        onLoad({ financialData: entry.financialData, assumptions: entry.assumptions, comparables: entry.comparables });
    };

    const handleExportJSON = () => {
        const data = { financialData, assumptions, comparables, exportedAt: new Date().toISOString(), version: '3.0' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WOLF_${financialData.ticker || 'valuation'}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportJSON = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    if (data.financialData && data.assumptions) {
                        onLoad({ financialData: data.financialData, assumptions: data.assumptions, comparables: data.comparables || [] });
                    }
                } catch (err) {
                    console.error('[WOLF] Invalid JSON file:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const cardBg = isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200';
    const btnPrimary = 'bg-red-600 hover:bg-red-700 text-white';
    const btnSecondary = isDarkMode ? 'bg-zinc-700 hover:bg-zinc-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700';

    return (
        <div className={`p-4 rounded-xl border ${cardBg}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Save / Load Valuations
            </h3>

            {/* Save row */}
            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder={`${financialData.companyName || 'Name this valuation'}...`}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${isDarkMode ? 'bg-zinc-900 border-zinc-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
                <button onClick={handleSave} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${btnPrimary}`}>
                    <Save size={14} /> Save
                </button>
            </div>

            {/* Export/Import buttons */}
            <div className="flex gap-2 mb-3">
                <button onClick={handleExportJSON} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${btnSecondary}`}>
                    <Download size={14} /> Export JSON
                </button>
                <button onClick={handleImportJSON} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${btnSecondary}`}>
                    <Upload size={14} /> Import JSON
                </button>
            </div>

            {/* Saved list */}
            {saved.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {saved.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${isDarkMode ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-gray-50 hover:bg-gray-100'} transition-all`}>
                            <div className="flex-1 min-w-0">
                                <span className={`font-medium truncate block ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{s.name}</span>
                                <span className={`flex items-center gap-1 ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    <Clock size={10} /> {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex gap-1 ml-2">
                                <button onClick={() => handleLoad(s)} className="px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 text-xs">Load</button>
                                <button onClick={() => handleDelete(s.name)} className="px-1.5 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
