import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Key, X, ExternalLink, Check, AlertCircle } from 'lucide-react';

interface APIKeyModalProps {
  isDarkMode: boolean;
}

export const APIKeyModal: React.FC<APIKeyModalProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('fmp_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setHasKey(true);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('fmp_api_key', apiKey.trim());
      setHasKey(true);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setIsOpen(false);
      }, 1500);
    }
  };

  const handleRemove = () => {
    localStorage.removeItem('fmp_api_key');
    setApiKey('');
    setHasKey(false);
  };

  // Modal Component using Portal
  const Modal = () => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative">
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Key className="text-red-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">API Key Settings</h2>
              <p className="text-sm text-gray-400">Connect to live market data</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${hasKey ? 'bg-green-500/20 border border-green-500/30' : 'bg-yellow-500/20 border border-yellow-500/30'
            }`}>
            {hasKey ? (
              <>
                <Check size={18} className="text-green-400" />
                <span className="text-green-400 text-sm font-medium">API Key Connected</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">No API Key — Live Data Unavailable</span>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-4">
            <h3 className="text-white font-medium mb-2">How to get your free API key:</h3>
            <ol className="text-gray-300 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">1.</span>
                <span>Visit Financial Modeling Prep</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">2.</span>
                <span>Create a free account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">3.</span>
                <span>Copy your API key from the dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">4.</span>
                <span>Paste it below and click Save</span>
              </li>
            </ol>
            <a
              href="https://financialmodelingprep.com/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              <ExternalLink size={14} />
              Get Free API Key →
            </a>
          </div>

          {/* Input Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Financial Modeling Prep API key"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {hasKey && (
              <button
                onClick={handleRemove}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--accent-gold)]/50 text-red-400 hover:bg-red-500/10 transition-colors font-medium"
              >
                Remove Key
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${saved
                  ? 'bg-green-500 text-white'
                  : apiKey.trim()
                    ? 'btn-gold text-white'
                    : 'bg-zinc-700 text-gray-500 cursor-not-allowed'
                }`}
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2">
                  <Check size={18} />
                  Saved!
                </span>
              ) : (
                'Save API Key'
              )}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {/* API Key Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${hasKey
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : isDarkMode
              ? 'bg-zinc-800 hover:bg-[var(--bg-secondary)] text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        title={hasKey ? 'API Key Connected' : 'Add API Key'}
      >
        <Key size={18} />
        <span className="hidden sm:inline text-sm font-medium">
          {hasKey ? 'API ✓' : 'API Key'}
        </span>
      </button>

      {/* Modal */}
      <Modal />
    </>
  );
};
