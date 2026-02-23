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
    revenueGrowth: 0.6,      // 60% of base growth
    marginChange: -0.02,     // -2% margin
    terminalGrowth: 0.8,     // 80% of base terminal growth
    wacc: 1.15,              // 15% higher WACC
    label: 'Bear Case',
    description: 'Low growth, high costs, pessimistic assumptions',
    color: 'red',
  },
  base: {
    revenueGrowth: 1.0,      // 100% of base
    marginChange: 0,         // No change
    terminalGrowth: 1.0,     // 100% of base
    wacc: 1.0,               // Base WACC
    label: 'Base Case',
    description: 'Most likely scenario with current trends',
    color: 'yellow',
  },
  bull: {
    revenueGrowth: 1.4,      // 140% of base growth
    marginChange: 0.03,      // +3% margin
    terminalGrowth: 1.2,     // 120% of base terminal growth
    wacc: 0.9,               // 10% lower WACC
    label: 'Bull Case',
    description: 'High growth, margin expansion, optimistic assumptions',
    color: 'green',
  },
};

export const ScenarioToggle: React.FC<ScenarioToggleProps> = ({ 
  scenario, 
  onScenarioChange,
  isDarkMode 
}) => {
  return (
    <div className={`flex items-center gap-2 p-1 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
      <button
        onClick={() => onScenarioChange('bear')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          scenario === 'bear'
            ? 'bg-red-600 text-white shadow-lg'
            : isDarkMode 
              ? 'text-gray-400 hover:text-red-400 hover:bg-zinc-700'
              : 'text-gray-600 hover:text-red-600 hover:bg-gray-300'
        }`}
        title={scenarioMultipliers.bear.description}
      >
        <TrendingDown size={16} />
        <span className="font-medium">Bear</span>
      </button>
      
      <button
        onClick={() => onScenarioChange('base')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          scenario === 'base'
            ? 'bg-yellow-600 text-white shadow-lg'
            : isDarkMode
              ? 'text-gray-400 hover:text-yellow-400 hover:bg-zinc-700'
              : 'text-gray-600 hover:text-yellow-600 hover:bg-gray-300'
        }`}
        title={scenarioMultipliers.base.description}
      >
        <Minus size={16} />
        <span className="font-medium">Base</span>
      </button>
      
      <button
        onClick={() => onScenarioChange('bull')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          scenario === 'bull'
            ? 'bg-green-600 text-white shadow-lg'
            : isDarkMode
              ? 'text-gray-400 hover:text-green-400 hover:bg-zinc-700'
              : 'text-gray-600 hover:text-green-600 hover:bg-gray-300'
        }`}
        title={scenarioMultipliers.bull.description}
      >
        <TrendingUp size={16} />
        <span className="font-medium">Bull</span>
      </button>
    </div>
  );
};

export default ScenarioToggle;
