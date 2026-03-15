/**
 * WOLF Header — Glass morphism navbar with gold branding.
 */
import React, { useState, useRef } from 'react';
import { Undo2, Redo2, Save, Upload, ArrowLeft } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../../types/financial';
import { ScenarioType, ScenarioToggle } from '../ScenarioToggle';
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
  scenario, onScenarioChange,
  canUndo, canRedo, onUndo, onRedo,
  financialData, assumptions, comparables, onLoadValuation,
  isDarkMode,
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

  return (
    <header
      className="fixed top-0 left-0 w-full z-[1000]"
      style={{
        background: 'rgba(10,14,23,.72)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(30,45,69,.5)',
        height: '64px',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 h-full flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <h1 style={{ fontFamily: "var(--ff-display)", fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1.3rem', letterSpacing: '1px' }}>
            WOLF
          </h1>
          <span style={{ fontFamily: "var(--ff-mono)", fontSize: '.72rem', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            Valuation Engine
          </span>
        </div>

        {/* Center: Scenario Toggle */}
        <div className="hidden md:flex items-center">
          <ScenarioToggle scenario={scenario} onScenarioChange={onScenarioChange} isDarkMode={isDarkMode} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button onClick={onUndo} disabled={!canUndo} className="nav-link p-2 disabled:opacity-30" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="nav-link p-2 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
          <button onClick={handleSave} className="nav-link p-2" title="Save Valuation">
            <Save size={16} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="nav-link p-2" title="Load Valuation">
            <Upload size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoad} className="hidden" />
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
          <APIKeyModal isDarkMode={isDarkMode} />
          <UserAuth
            financialData={financialData}
            assumptions={assumptions}
            comparables={comparables}
            onLoadValuation={onLoadValuation}
            isDarkMode={isDarkMode}
          />
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
          <a
            href="https://ahmedwael.pages.dev/"
            className="nav-link flex items-center gap-1.5"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Portfolio</span>
          </a>
          {showSaveSuccess && (
            <span className="text-xs ml-2 animate-pulse" style={{ color: '#4ade80' }}>Saved!</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
