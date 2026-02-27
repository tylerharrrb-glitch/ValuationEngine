/**
 * WOLF Footer — Disclaimer and copyright.
 */
import React from 'react';

interface FooterProps {
  isDarkMode: boolean;
  textClass: string;
  textMutedClass: string;
}

export const Footer: React.FC<FooterProps> = ({ isDarkMode, textMutedClass }) => {
  return (
    <footer className={`border-t py-6 mt-8 ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className={`text-xs font-semibold tracking-wider uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          WOLF Valuation Engine v2.7
        </span>
        <p className={`text-[11px] text-center max-w-lg ${textMutedClass}`}>
          Financial data provided by{' '}
          <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer"
            className="underline hover:text-red-400 transition-colors">
            Financial Modeling Prep
          </a>
          . For educational purposes only. Not financial advice.
          Past performance does not guarantee future results.
          Always verify data independently before making investment decisions.
        </p>
        <span className={`text-[11px] ${textMutedClass}`}>
          &copy; {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
