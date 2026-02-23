/**
 * Tab Navigation — Switches between Input, Valuation, Charts tabs.
 */
import React from 'react';
import { Settings, BarChart3, LineChart } from 'lucide-react';

export type TabId = 'input' | 'valuation' | 'charts';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isDarkMode: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'input', label: 'Input Data', icon: <Settings size={16} /> },
  { id: 'valuation', label: 'Valuation', icon: <BarChart3 size={16} /> },
  { id: 'charts', label: 'Charts & Analysis', icon: <LineChart size={16} /> },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, isDarkMode }) => {
  return (
    <div className={`flex gap-1 p-1 rounded-xl mb-6 ${isDarkMode ? 'bg-zinc-900/80' : 'bg-gray-100'}`}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2
              px-4 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-red-600 text-white shadow-lg'
                : isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-zinc-800/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }
            `}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TabNavigation;
