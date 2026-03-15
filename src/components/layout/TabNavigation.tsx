/**
 * Tab Navigation — Switches between Input, Valuation, Charts tabs.
 * Gold active-tab underline, mono font.
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

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      className="flex gap-0 mb-8"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center justify-center gap-2 transition-all duration-200"
            style={{
              fontFamily: 'var(--ff-mono)',
              fontSize: '.78rem',
              padding: '12px 24px',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: isActive ? 'var(--accent-gold)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget.style.color = 'var(--text-secondary)');
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget.style.color = 'var(--text-muted)');
            }}
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
