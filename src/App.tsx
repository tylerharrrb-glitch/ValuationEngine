/**
 * WOLF Valuation Engine — Main Application
 * Thin orchestrator that composes extracted hooks and components.
 */
import { useState, lazy, Suspense } from 'react';
import { MarketRegion } from './types/financial';
import { ScenarioType } from './components/ScenarioToggle';
import { ValuationStyleKey } from './constants/valuationStyles';
import { initialFinancialData, initialAssumptions, initialComparables } from './constants/initialData';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useFinancialData } from './hooks/useFinancialData';
import { useValuationCalculations } from './hooks/useValuationCalculations';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { exportToPDF } from './utils/pdfExport';

// Layout components
import { Header } from './components/layout/Header';
import { CompanyHeader } from './components/layout/CompanyHeader';
import { TabNavigation, TabId } from './components/layout/TabNavigation';
import { Footer } from './components/layout/Footer';

// Tab components (Lazy loaded)
// Tab components (Lazy loaded)
import { InputTabProps } from './components/input/InputTab';
import { ValuationTabProps } from './components/valuation/ValuationTab';
import { ChartsTabProps } from './components/charts/ChartsTab';

const InputTab = lazy<React.FC<InputTabProps>>(() => import('./components/input/InputTab'));
const ValuationTab = lazy<React.FC<ValuationTabProps>>(() => import('./components/valuation/ValuationTab'));
const ChartsTab = lazy<React.FC<ChartsTabProps>>(() => import('./components/charts/ChartsTab'));

import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { LoadingFallback } from './components/shared/LoadingFallback';
import { WolfAnalystPanel } from './components/WolfAnalystPanel';

function App() {
  // ── UI State ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('valuation');
  const [scenario, setScenario] = useState<ScenarioType>('base');
  const [marketRegion, setMarketRegion] = useState<MarketRegion>('Egypt');
  const [dcfWeight, setDcfWeight] = useState(60);
  const [valuationStyle, setValuationStyle] = useState<ValuationStyleKey>('moderate');
  const [showWolfAnalyst, setShowWolfAnalyst] = useState(false);

  // ── Theme ─────────────────────────────────────────────────────────────
  const { isDarkMode, toggleDarkMode, bgClass, cardClass, textClass, textMutedClass, inputClass } = useTheme();

  // ── Financial Data & History ──────────────────────────────────────────
  const {
    financialData, assumptions, comparables,
    updateFinancialData, updateAssumptions, updateComparables,
    handleStockDataFetched, handleLoadValuation,
    canUndo, canRedo, undo, redo,
    historyIndex, historyLength, lastSaved,
  } = useFinancialData(initialFinancialData, initialAssumptions, initialComparables);

  // ── Valuation Calculations ────────────────────────────────────────────
  const calc = useValuationCalculations(
    financialData, assumptions, comparables,
    scenario, valuationStyle, dcfWeight, marketRegion,
  );

  // ── Keyboard Shortcuts ────────────────────────────────────────────────
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSave: () => exportToPDF({
      financialData,
      assumptions: calc.adjustedAssumptions,
      comparables,
      dcfProjections: calc.dcfProjections,
      dcfValue: calc.dcfValue,
      comparableValue: calc.comparableValue,
      scenario
    }),
    canUndo,
    canRedo,
  });

  // ── Render ────────────────────────────────────────────────────────────
  const themeProps = { isDarkMode, cardClass, textClass, textMutedClass, currency: calc.currency };

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
      {/* Header */}
      <Header
        isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}
        scenario={scenario} onScenarioChange={setScenario}
        canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
        financialData={financialData} assumptions={assumptions} comparables={comparables}
        onLoadValuation={handleLoadValuation}
        textClass={textClass} textMutedClass={textMutedClass}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Company Header with price, recommendation, exports */}
        <CompanyHeader
          financialData={financialData} assumptions={assumptions}
          adjustedAssumptions={calc.adjustedAssumptions} comparables={comparables}
          dcfProjections={calc.dcfProjections} dcfValue={calc.dcfValue}
          comparableValue={calc.comparableValue} upside={calc.upside}
          recommendation={calc.recommendation} scenario={scenario}
          onOpenWolfAnalyst={() => setShowWolfAnalyst(true)}
          {...themeProps}
        />

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} isDarkMode={isDarkMode} />

        {/* ═══ INPUT TAB ═══ */}
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'input' && (
            <ErrorBoundary name="Input Data">
              <InputTab
                financialData={financialData} assumptions={assumptions} comparables={comparables}
                updateFinancialData={updateFinancialData}
                updateAssumptions={updateAssumptions}
                updateComparables={updateComparables}
                handleStockDataFetched={handleStockDataFetched}
                marketRegion={marketRegion} setMarketRegion={setMarketRegion}
                isDarkMode={isDarkMode} cardClass={cardClass} textClass={textClass}
                textMutedClass={textMutedClass} inputClass={inputClass} currency={calc.currency}
              />
            </ErrorBoundary>
          )}

          {/* ═══ VALUATION TAB ═══ */}
          {activeTab === 'valuation' && (
            <ErrorBoundary name="Valuation Model">
              <ValuationTab
                financialData={financialData} assumptions={assumptions}
                adjustedAssumptions={calc.adjustedAssumptions}
                comparables={comparables} dcfProjections={calc.dcfProjections}
                dcfValue={calc.dcfValue} comparableValue={calc.comparableValue}
                blendedValue={calc.blendedValue} upside={calc.upside}
                dcfWeight={dcfWeight} compsWeight={calc.compsWeight} setDcfWeight={setDcfWeight}
                comparableValuations={calc.comparableValuations}
                hasValidComparables={calc.hasValidComparables}
                industryMultiples={calc.industryMultiples}
                keyMetrics={calc.keyMetrics} recommendation={calc.recommendation}
                scenarioCases={calc.scenarioCases} scenario={scenario}
                valuationStyle={valuationStyle} setValuationStyle={setValuationStyle}
                marketRegion={marketRegion}
                historyIndex={historyIndex} historyLength={historyLength} lastSaved={lastSaved}
                handleLoadValuation={handleLoadValuation}
                {...themeProps}
              />
            </ErrorBoundary>
          )}

          {/* ═══ CHARTS TAB ═══ */}
          {activeTab === 'charts' && (
            <ErrorBoundary name="Charts & Analysis">
              <ChartsTab
                financialData={financialData}
                adjustedAssumptions={calc.adjustedAssumptions}
                dcfProjections={calc.dcfProjections}
                revenueProjectionData={calc.revenueProjectionData}
                valuationComparisonData={calc.valuationComparisonData}
                footballFieldData={calc.footballFieldData}
                industryMultiples={calc.industryMultiples}
                scenario={scenario}
                {...themeProps}
              />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>

      {/* Footer */}
      <Footer isDarkMode={isDarkMode} textClass={textClass} textMutedClass={textMutedClass} />

      {/* 🐺 WOLF Analyst Toggle Button */}
      <button
        onClick={() => setShowWolfAnalyst(prev => !prev)}
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all duration-200 hover:scale-110
          ${showWolfAnalyst
            ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
            : 'bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-red-900/40'}`}
        title={showWolfAnalyst ? 'Close WOLF Analyst' : 'Open WOLF Analyst'}
      >
        🐺
      </button>

      {/* 🐺 WOLF Analyst Panel */}
      <WolfAnalystPanel
        isOpen={showWolfAnalyst}
        onClose={() => setShowWolfAnalyst(false)}
        isDarkMode={isDarkMode}
        financialData={financialData}
        assumptions={calc.adjustedAssumptions}
        comparables={comparables}
        dcfProjections={calc.dcfProjections}
        dcfValue={calc.dcfValue}
        comparableValue={calc.comparableValue}
        blendedValue={calc.blendedValue}
        upside={calc.upside}
      />
    </div>
  );
}

export default App;
