/**
 * WOLF Header — Top bar with logo, scenario toggle, undo/redo, dark mode, save/load.
 */
import React, { useState, useRef } from 'react';
import { Moon, Sun, Undo2, Redo2, Save, Upload } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../../types/financial';
import { ScenarioType, ScenarioToggle } from '../ScenarioToggle';
import { WolfLogo } from '../WolfLogo';
import { APIKeyModal } from '../APIKeyModal';
import { UserAuth } from '../UserAuth';

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  scenario: ScenarioType;
  onScenarioChange: (s: ScenarioType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  onLoadValuation: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
  textClass: string;
  textMutedClass: string;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode, toggleDarkMode, scenario, onScenarioChange,
  canUndo, canRedo, onUndo, onRedo,
  financialData, assumptions, comparables, onLoadValuation,
  textClass,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const handleSave = () => {
    const data = JSON.stringify({ financialData, assumptions, comparables }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wolf-${financialData.ticker || 'valuation'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.financialData && parsed.assumptions) {
          onLoadValuation(parsed);
        }
      } catch {
        console.error('[WOLF] Failed to load valuation file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const btnClass = `p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-zinc-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'}`;

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-xl ${isDarkMode ? 'bg-black/80 border-b border-zinc-800' : 'bg-white/80 border-b border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <WolfLogo size={32} />
          <div>
            <h1 className={`text-lg font-bold ${textClass}`}>WOLF</h1>
            <p className={`text-[10px] tracking-widest uppercase ${isDarkMode ? 'text-red-500' : 'text-red-600'}`}>Valuation Engine</p>
          </div>
        </div>

        {/* Center: Scenario Toggle */}
        <div className="hidden md:flex items-center">
          <ScenarioToggle scenario={scenario} onScenarioChange={onScenarioChange} isDarkMode={isDarkMode} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button onClick={onUndo} disabled={!canUndo} className={`${btnClass} disabled:opacity-30`} title="Undo (Ctrl+Z)">
            <Undo2 size={18} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className={`${btnClass} disabled:opacity-30`} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={18} />
          </button>
          <div className={`w-px h-6 mx-1 ${isDarkMode ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <button onClick={handleSave} className={btnClass} title="Save Valuation">
            <Save size={18} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className={btnClass} title="Load Valuation">
            <Upload size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} className="hidden" />
          <div className={`w-px h-6 mx-1 ${isDarkMode ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <APIKeyModal isDarkMode={isDarkMode} />
          <UserAuth
            financialData={financialData}
            assumptions={assumptions}
            comparables={comparables}
            onLoadValuation={onLoadValuation}
            isDarkMode={isDarkMode}
          />
          <div className={`w-px h-6 mx-1 ${isDarkMode ? 'bg-zinc-700' : 'bg-gray-200'}`} />
          <button onClick={toggleDarkMode} className={btnClass} title="Toggle Theme">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {showSaveSuccess && (
            <span className="text-xs text-green-400 ml-2 animate-pulse">Saved!</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
