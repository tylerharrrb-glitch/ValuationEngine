import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { User, LogIn, LogOut, Save, Folder, Trash2, X, Plus } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';

interface SavedValuation {
  id: string;
  name: string;
  ticker: string;
  date: string;
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
}

interface UserAuthProps {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  onLoadValuation: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
  isDarkMode: boolean;
}

// Modal component that renders via Portal to document.body
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Use Portal to render modal at document.body level
  return ReactDOM.createPortal(
    <>
      {/* OVERLAY - Exact structure as specified */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* MODAL BOX - Exact structure as specified */}
        <div 
          className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* X Button in top-right corner */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-gray-400 hover:text-white" />
          </button>

          {/* Modal Header */}
          <h2 className="text-xl font-bold text-white mb-6 pr-8">
            {title}
          </h2>

          {/* Modal Content */}
          {children}
        </div>
      </div>
    </>,
    document.body
  );
};

export const UserAuth: React.FC<UserAuthProps> = ({
  financialData,
  assumptions,
  comparables,
  onLoadValuation,
  isDarkMode,
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('wolf_user') !== null;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showValuationsModal, setShowValuationsModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('wolf_user') || '';
  });
  const [savedValuations, setSavedValuations] = useState<SavedValuation[]>(() => {
    const saved = localStorage.getItem('wolf_valuations');
    return saved ? JSON.parse(saved) : [];
  });
  const [newValuationName, setNewValuationName] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = email.split('@')[0];
    localStorage.setItem('wolf_user', name);
    setUserName(name);
    setIsLoggedIn(true);
    setShowLoginModal(false);
    setEmail('');
    setPassword('');
  };

  const handleLogout = () => {
    localStorage.removeItem('wolf_user');
    setIsLoggedIn(false);
    setUserName('');
  };

  const saveValuation = () => {
    if (!newValuationName.trim()) return;
    
    const newValuation: SavedValuation = {
      id: Date.now().toString(),
      name: newValuationName,
      ticker: financialData.ticker,
      date: new Date().toLocaleDateString(),
      financialData,
      assumptions,
      comparables,
    };
    
    const updated = [...savedValuations, newValuation];
    setSavedValuations(updated);
    localStorage.setItem('wolf_valuations', JSON.stringify(updated));
    setNewValuationName('');
    setShowSaveModal(false);
  };

  const loadValuation = (valuation: SavedValuation) => {
    onLoadValuation({
      financialData: valuation.financialData,
      assumptions: valuation.assumptions,
      comparables: valuation.comparables,
    });
    setShowValuationsModal(false);
  };

  const deleteValuation = (id: string) => {
    const updated = savedValuations.filter(v => v.id !== id);
    setSavedValuations(updated);
    localStorage.setItem('wolf_valuations', JSON.stringify(updated));
  };

  return (
    <>
      {/* User Menu Buttons */}
      <div className="relative flex items-center gap-2">
        {isLoggedIn ? (
          <>
            {/* Save Button */}
            <button
              onClick={() => setShowSaveModal(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="Save Valuation"
            >
              <Save size={18} />
            </button>
            
            {/* My Valuations Button */}
            <button
              onClick={() => setShowValuationsModal(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="My Valuations"
            >
              <Folder size={18} />
            </button>
            
            {/* User Badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-red-600/20 rounded-lg">
              <User size={16} className="text-red-400" />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {userName}
              </span>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-zinc-800 hover:bg-red-900/50 text-gray-300 hover:text-red-400'
                  : 'bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-600'
              }`}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            <LogIn size={18} />
            <span>Sign In</span>
          </button>
        )}
      </div>

      {/* LOGIN MODAL */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Sign In to WOLF"
      >
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors mt-2"
          >
            Sign In
          </button>
          <p className="text-center text-sm text-gray-500 mt-4">
            Demo mode: Enter any email to continue
          </p>
        </form>
      </Modal>

      {/* SAVED VALUATIONS MODAL */}
      <Modal
        isOpen={showValuationsModal}
        onClose={() => setShowValuationsModal(false)}
        title="My Saved Valuations"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {savedValuations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Folder size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">No saved valuations yet</p>
              <p className="text-sm mt-1">Save your current valuation to access it later</p>
            </div>
          ) : (
            savedValuations.map((valuation) => (
              <div
                key={valuation.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <button
                  onClick={() => loadValuation(valuation)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-white">
                    {valuation.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {valuation.ticker} • {valuation.date}
                  </div>
                </button>
                <button
                  onClick={() => deleteValuation(valuation.id)}
                  className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* SAVE VALUATION MODAL */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Valuation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valuation Name
            </label>
            <input
              type="text"
              value={newValuationName}
              onChange={(e) => setNewValuationName(e.target.value)}
              placeholder={`${financialData.companyName} - ${new Date().toLocaleDateString()}`}
              className="w-full px-4 py-3 rounded-lg border bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          
          <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Saving:</div>
            <div className="font-semibold text-white text-lg">
              {financialData.companyName} ({financialData.ticker})
            </div>
          </div>
          
          <button
            onClick={saveValuation}
            disabled={!newValuationName.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Save Valuation
          </button>
        </div>
      </Modal>
    </>
  );
};

export default UserAuth;
