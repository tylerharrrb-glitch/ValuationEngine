import { X, BookOpen, Code, Terminal, Rocket, CheckCircle, ExternalLink, GraduationCap, Wrench, Lightbulb } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function HowToBuildModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const steps = [
    {
      icon: BookOpen,
      title: 'Step 1: Learn the Fundamentals',
      duration: '2-4 months',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      items: [
        { name: 'HTML & CSS', desc: 'Structure and styling of web pages', weeks: '2-4 weeks' },
        { name: 'JavaScript', desc: 'Programming logic, DOM manipulation', weeks: '4-8 weeks' },
        { name: 'React.js', desc: 'Component-based UI framework', weeks: '4-6 weeks' },
      ],
      resources: [
        { name: 'freeCodeCamp', url: 'https://freecodecamp.org' },
        { name: 'React Docs', url: 'https://react.dev' },
        { name: 'JavaScript.info', url: 'https://javascript.info' },
      ]
    },
    {
      icon: Terminal,
      title: 'Step 2: Set Up Development Environment',
      duration: '1 day',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      items: [
        { name: 'Install Node.js', desc: 'JavaScript runtime', code: 'nodejs.org/download' },
        { name: 'Install VS Code', desc: 'Code editor', code: 'code.visualstudio.com' },
        { name: 'Create React Project', desc: 'Using Vite', code: 'npm create vite@latest my-app' },
      ],
      commands: [
        'npm create vite@latest valuation-app -- --template react-ts',
        'cd valuation-app',
        'npm install',
        'npm run dev'
      ]
    },
    {
      icon: Wrench,
      title: 'Step 3: Install Required Packages',
      duration: '10 minutes',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      packages: [
        { name: 'tailwindcss', desc: 'Utility-first CSS framework' },
        { name: 'recharts', desc: 'Chart library for React' },
        { name: 'lucide-react', desc: 'Beautiful icons' },
        { name: 'xlsx', desc: 'Excel file generation' },
      ],
      commands: [
        'npm install tailwindcss recharts lucide-react xlsx'
      ]
    },
    {
      icon: Code,
      title: 'Step 4: Build Core Features',
      duration: '2-4 weeks',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      items: [
        { name: 'Type Definitions', desc: 'Define TypeScript interfaces for financial data' },
        { name: 'Calculation Functions', desc: 'DCF, WACC, comparable multiples' },
        { name: 'Input Components', desc: 'Forms for financial statements' },
        { name: 'Results Display', desc: 'Summary cards, tables, charts' },
        { name: 'Excel Export', desc: 'Generate professional reports' },
      ]
    },
    {
      icon: GraduationCap,
      title: 'Step 5: Learn Finance Concepts',
      duration: 'Ongoing',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      items: [
        { name: 'Financial Statements', desc: 'Income, Balance Sheet, Cash Flow' },
        { name: 'DCF Valuation', desc: 'Present value of future cash flows' },
        { name: 'Comparable Analysis', desc: 'Using P/E, EV/EBITDA multiples' },
        { name: 'WACC', desc: 'Weighted Average Cost of Capital' },
      ],
      resources: [
        { name: 'Investopedia', url: 'https://investopedia.com' },
        { name: 'Damodaran YouTube', url: 'https://youtube.com/@AswathDamodaranonValuation' },
      ]
    },
    {
      icon: Rocket,
      title: 'Step 6: Deploy Your App',
      duration: '30 minutes',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      items: [
        { name: 'Build Project', code: 'npm run build' },
        { name: 'Deploy to Vercel', desc: 'Free hosting, automatic deploys' },
        { name: 'Share Your Work', desc: 'Add to portfolio, share on LinkedIn' },
      ],
      commands: [
        'npm run build',
        'npx vercel'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-2xl border border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">How to Build WOLF</h2>
                <p className="text-red-100">A Complete Guide for Beginners</p>
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
          {/* Overview */}
          <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-6 h-6 text-yellow-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">What You'll Learn</h3>
                <p className="text-zinc-300">
                  This guide will teach you how to build a professional web application from scratch.
                  You'll learn React, TypeScript, Tailwind CSS, and how to implement financial calculations.
                  Total learning time: <span className="text-red-400 font-medium">3-6 months</span> for beginners.
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`${step.bgColor} rounded-xl p-5 border ${step.borderColor}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${step.bgColor} border ${step.borderColor} flex items-center justify-center`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-lg font-semibold ${step.color}`}>{step.title}</h3>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                      {step.duration}
                    </span>
                  </div>

                  {step.items && (
                    <div className="space-y-2 mb-4">
                      {step.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-white font-medium">{item.name}</span>
                            {item.desc && (
                              <span className="text-zinc-400 text-sm"> - {item.desc}</span>
                            )}
                            {'weeks' in item && item.weeks && (
                              <span className="text-zinc-500 text-xs ml-2">({item.weeks})</span>
                            )}
                            {'code' in item && item.code && (
                              <code className="text-xs bg-zinc-800 text-red-400 px-1.5 py-0.5 rounded ml-2">
                                {item.code}
                              </code>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {step.packages && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {step.packages.map((pkg, i) => (
                        <div key={i} className="bg-zinc-900/50 rounded-lg p-2">
                          <code className="text-red-400 text-sm">{pkg.name}</code>
                          <p className="text-zinc-500 text-xs">{pkg.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {step.commands && (
                    <div className="bg-black rounded-lg p-3 font-mono text-sm">
                      {step.commands.map((cmd, i) => (
                        <div key={i} className="text-green-400">
                          <span className="text-zinc-500">$ </span>{cmd}
                        </div>
                      ))}
                    </div>
                  )}

                  {step.resources && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {step.resources.map((res, i) => (
                        <a
                          key={i}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-red-400 px-3 py-1 rounded-full transition-colors"
                        >
                          {res.name}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Technologies Used */}
          <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700">
            <h3 className="text-lg font-semibold text-white mb-4">🛠️ Technologies Used in This App</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'React', desc: 'UI Library', color: 'text-cyan-400' },
                { name: 'TypeScript', desc: 'Type Safety', color: 'text-blue-400' },
                { name: 'Tailwind CSS', desc: 'Styling', color: 'text-teal-400' },
                { name: 'Vite', desc: 'Build Tool', color: 'text-red-400' },
                { name: 'Recharts', desc: 'Charts', color: 'text-pink-400' },
                { name: 'Lucide', desc: 'Icons', color: 'text-orange-400' },
                { name: 'xlsx', desc: 'Excel Export', color: 'text-green-400' },
                { name: 'Node.js', desc: 'Runtime', color: 'text-lime-400' },
              ].map((tech, i) => (
                <div key={i} className="bg-black rounded-lg p-3 text-center">
                  <p className={`font-semibold ${tech.color}`}>{tech.name}</p>
                  <p className="text-zinc-500 text-xs">{tech.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-r from-green-950/30 to-emerald-950/30 rounded-xl p-5 border border-green-700/30">
            <h3 className="text-lg font-semibold text-green-400 mb-3">💡 Tips for Success</h3>
            <ul className="space-y-2 text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>Build projects</strong>, don't just follow tutorials passively</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>Practice consistently</strong> - 1-2 hours daily is better than 10 hours once a week</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>Read documentation</strong> - official docs are your best friend</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>Debug errors</strong> - they teach you the most about how things work</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>Join communities</strong> - Discord, Reddit, Twitter for help and motivation</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 p-4 bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-sm">
              💾 This guide is also included in the Excel export!
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
