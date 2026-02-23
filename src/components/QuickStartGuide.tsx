import { X, Copy, Check, Terminal, FolderTree, Zap, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickStartGuide({ isOpen, onClose }: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const commands = [
    {
      step: 1,
      title: 'Install Node.js',
      desc: 'Download and install from nodejs.org',
      cmd: '',
      link: 'https://nodejs.org'
    },
    {
      step: 2,
      title: 'Create React + TypeScript Project',
      desc: 'Run this in your terminal',
      cmd: 'npm create vite@latest wolf-valuation -- --template react-ts'
    },
    {
      step: 3,
      title: 'Enter Project Folder',
      desc: 'Navigate to your new project',
      cmd: 'cd wolf-valuation'
    },
    {
      step: 4,
      title: 'Install Dependencies',
      desc: 'Install all required packages',
      cmd: 'npm install tailwindcss @tailwindcss/vite recharts lucide-react xlsx'
    },
    {
      step: 5,
      title: 'Start Development Server',
      desc: 'Launch your app at localhost:5173',
      cmd: 'npm run dev'
    }
  ];

  const projectStructure = `
wolf-valuation/
├── src/
│   ├── components/          # UI Components
│   │   ├── FinancialInputForm.tsx
│   │   ├── DCFResults.tsx
│   │   ├── ValuationSummary.tsx
│   │   └── KeyMetrics.tsx
│   ├── utils/               # Logic & Calculations
│   │   ├── valuation.ts     # DCF, WACC formulas
│   │   ├── formatters.ts    # Number formatting
│   │   └── excelExportPro.ts # Excel generation
│   ├── types/               # TypeScript Types
│   │   └── financial.ts     # Data interfaces
│   ├── data/                # Sample Data
│   │   └── sampleData.ts
│   ├── App.tsx              # Main Component
│   └── main.tsx             # Entry Point
├── package.json
└── vite.config.ts
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-zinc-900 rounded-2xl border border-zinc-700 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">WOLF Quick Start</h2>
                <p className="text-orange-100">Build This App in 5 Minutes!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Intro */}
          <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-xl p-4">
            <p className="text-yellow-200">
              <strong>⚡ No coding experience?</strong> Just copy-paste these commands! 
              You'll have this exact app running on your computer in minutes.
            </p>
          </div>

          {/* Commands */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-white">Terminal Commands</h3>
            </div>

            {commands.map((item, index) => (
              <div 
                key={index}
                className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {item.step}
                    </span>
                    <span className="text-white font-medium">{item.title}</span>
                  </div>
                  {item.link && (
                    <a 
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm"
                    >
                      Download <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-zinc-400 text-sm mb-2">{item.desc}</p>
                {item.cmd && (
                  <div className="flex items-center gap-2 bg-black rounded-lg p-3 font-mono text-sm">
                    <code className="flex-1 text-green-400 overflow-x-auto">
                      $ {item.cmd}
                    </code>
                    <button
                      onClick={() => copyToClipboard(item.cmd, index)}
                      className="p-1.5 hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Project Structure */}
          <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
            <div className="flex items-center gap-2 mb-3">
              <FolderTree className="w-5 h-5 text-red-500" />
              <h3 className="text-white font-semibold">Project Structure</h3>
            </div>
            <pre className="text-sm text-zinc-300 overflow-x-auto bg-black rounded-lg p-4">
              {projectStructure}
            </pre>
          </div>

          {/* Key Files to Copy */}
          <div className="bg-gradient-to-r from-red-950/30 to-zinc-900/30 rounded-xl p-5 border border-red-700/30">
            <h3 className="text-lg font-semibold text-red-400 mb-3">📁 Key Files You Need</h3>
            <div className="space-y-2 text-zinc-300">
              <p><code className="text-red-400">src/types/financial.ts</code> - Define your data types (FinancialData, Assumptions)</p>
              <p><code className="text-red-400">src/utils/valuation.ts</code> - Calculation functions (DCF, WACC, multiples)</p>
              <p><code className="text-red-400">src/utils/formatters.ts</code> - Number formatting (currency, percent, etc.)</p>
              <p><code className="text-red-400">src/utils/excelExportPro.ts</code> - Excel with formulas export</p>
              <p><code className="text-red-400">src/components/*.tsx</code> - All UI components</p>
              <p><code className="text-red-400">src/App.tsx</code> - Main app that brings it all together</p>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-green-950/30 border border-green-700/50 rounded-xl p-4">
            <h3 className="text-green-400 font-semibold mb-2">✅ What's Next?</h3>
            <ol className="list-decimal list-inside text-zinc-300 space-y-1">
              <li>Copy the component files from this app</li>
              <li>Paste them into your project's src folder</li>
              <li>Modify the design and calculations as needed</li>
              <li>Deploy to Vercel with <code className="text-red-400">npx vercel</code></li>
            </ol>
          </div>

          {/* Resources */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'React Docs', url: 'https://react.dev', color: 'text-cyan-400' },
              { name: 'TypeScript', url: 'https://typescriptlang.org', color: 'text-blue-400' },
              { name: 'Tailwind CSS', url: 'https://tailwindcss.com', color: 'text-teal-400' },
              { name: 'Vercel Deploy', url: 'https://vercel.com', color: 'text-white' },
            ].map((resource, i) => (
              <a
                key={i}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 text-center transition-colors border border-zinc-700"
              >
                <p className={`font-medium ${resource.color}`}>{resource.name}</p>
                <p className="text-zinc-500 text-xs">docs →</p>
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 p-4 bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-sm">
              🚀 You can do this! Start coding today.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Let's Go!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
