import React from 'react';
import { TrendingDown, Minus, TrendingUp } from 'lucide-react';

export type ScenarioType = 'bear' | 'base' | 'bull';

interface ScenarioToggleProps {
  scenario: ScenarioType;
  onScenarioChange: (scenario: ScenarioType) => void;
  isDarkMode: boolean;
}

export const scenarioMultipliers = {
  bear: {
    revenueGrowth: 0.6,
    marginChange: -0.02,
    terminalGrowth: 0.8,
    wacc: 1.15,
    label: 'Bear Case',
    description: 'Low growth, high costs, pessimistic assumptions',
    color: 'red',
  },
  base: {
    revenueGrowth: 1.0,
    marginChange: 0,
    terminalGrowth: 1.0,
    wacc: 1.0,
    label: 'Base Case',
    description: 'Most likely scenario with current trends',
    color: 'yellow',
  },
  bull: {
    revenueGrowth: 1.4,
    marginChange: 0.03,
    terminalGrowth: 1.2,
    wacc: 0.9,
    label: 'Bull Case',
    description: 'High growth, margin expansion, optimistic assumptions',
    color: 'green',
  },
};

export const ScenarioToggle: React.FC<ScenarioToggleProps> = ({ 
  scenario, 
  onScenarioChange,
}) => {
  const btnBase = "flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200";
  
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => onScenarioChange('bear')}
        className={`${btnBase} ${
          scenario === 'bear'
            ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] shadow-lg'
            : 'text-[var(--text-muted)] hover:text-[var(--accent-gold)]'
        }`}
        style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}
        title={scenarioMultipliers.bear.description}
      >
        <TrendingDown size={16} />
        <span className="font-medium">Bear</span>
      </button>
      
      <button
        onClick={() => onScenarioChange('base')}
        className={`${btnBase} ${
          scenario === 'base'
            ? 'bg-yellow-600 text-white shadow-lg'
            : 'text-[var(--text-muted)] hover:text-yellow-400'
        }`}
        style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}
        title={scenarioMultipliers.base.description}
      >
        <Minus size={16} />
        <span className="font-medium">Base</span>
      </button>
      
      <button
        onClick={() => onScenarioChange('bull')}
        className={`${btnBase} ${
          scenario === 'bull'
            ? 'bg-green-600 text-white shadow-lg'
            : 'text-[var(--text-muted)] hover:text-green-400'
        }`}
        style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}
        title={scenarioMultipliers.bull.description}
      >
        <TrendingUp size={16} />
        <span className="font-medium">Bull</span>
      </button>
    </div>
  );
};

export default ScenarioToggle;
