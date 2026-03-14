/**
 * 🐺 WOLF Analyst Panel — Floating AI chat panel
 * CFA-grade calculation verifier & methodology Q&A.
 * Powered by Google Gemini 1.5 Flash.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle, Send, Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import {
  callWolfAnalyst, isWolfConfigured,
  type WolfMessage, type WolfAnalystRequest,
} from '../services/wolfAnalyst';
import type {
  FinancialData, ValuationAssumptions, ComparableCompany,
  DCFProjection, WACCResult, DCFResult, DDMResult,
  FCFFVerification, ScenarioAnalysis,
} from '../types/financial';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface WolfAnalystPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  // Engine data for verification
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  dcfProjections: DCFProjection[];
  dcfValue: number;
  comparableValue: number;
  blendedValue: number;
  upside: number;
  waccResult?: WACCResult;
  dcfResult?: DCFResult;
  ddmResult?: DDMResult;
  fcffVerification?: FCFFVerification;
  scenarioAnalysis?: ScenarioAnalysis;
}

// ─── Markdown Renderer ──────────────────────────────────────────────────────

function renderMarkdown(text: string, isDarkMode: boolean): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(l => !l.match(/^\|[\s\-:|]+\|$/));
      if (rows.length > 0) {
        const parseCells = (r: string) =>
          r.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1).map(c => c.trim());
        const headerCells = parseCells(rows[0]);
        const bodyRows = rows.slice(1);
        elements.push(
          <div key={`t-${i}`} className="overflow-x-auto my-3">
            <table className={`w-full text-xs border-collapse ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'}`}>
              <thead>
                <tr className={isDarkMode ? 'bg-zinc-800 text-white' : 'bg-gray-200 text-gray-900'}>
                  {headerCells.map((c, ci) => (
                    <th key={ci} className={`px-2 py-1.5 text-left font-semibold border ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'}`}>
                      {renderInline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0
                    ? (isDarkMode ? 'bg-zinc-900' : 'bg-white')
                    : (isDarkMode ? 'bg-zinc-800/50' : 'bg-gray-50')}>
                    {parseCells(row).map((c, ci) => (
                      <td key={ci} className={`px-2 py-1 border ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'}`}>
                        {renderInline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className={`text-sm font-semibold mt-3 mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{renderInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className={`text-base font-bold mt-3 mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{renderInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className={`text-lg font-bold mt-2 mb-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{renderInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className={`my-2 ${isDarkMode ? 'border-zinc-700' : 'border-gray-300'}`} />);
      i++; continue;
    }

    // Status icons — make them stand out
    if (line.includes('✅') || line.includes('⚠️') || line.includes('❌')) {
      const bgClass = line.includes('❌')
        ? (isDarkMode ? 'bg-red-900/30 border-red-700/50' : 'bg-red-50 border-red-200')
        : line.includes('⚠️')
          ? (isDarkMode ? 'bg-yellow-900/30 border-yellow-700/50' : 'bg-yellow-50 border-yellow-200')
          : (isDarkMode ? 'bg-green-900/30 border-green-700/50' : 'bg-green-50 border-green-200');
      elements.push(
        <div key={i} className={`px-2 py-1 my-1 rounded border text-xs font-medium ${bgClass}`}>
          {renderInline(line)}
        </div>
      );
      i++; continue;
    }

    // List items
    if (line.match(/^\s*[-*]\s/)) {
      elements.push(<li key={i} className="ml-4 text-xs mb-0.5 list-disc">{renderInline(line.replace(/^\s*[-*]\s/, ''))}</li>);
      i++; continue;
    }
    if (line.match(/^\s*\d+\.\s/)) {
      elements.push(<li key={i} className="ml-4 text-xs mb-0.5 list-decimal">{renderInline(line.replace(/^\s*\d+\.\s/, ''))}</li>);
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
      i++; continue;
    }

    // Default paragraph
    elements.push(<p key={i} className="text-xs mb-0.5 leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    if (codeParts.length > 1) {
      return codeParts.map((cp, ci) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${i}-${ci}`} className="px-1 py-0.5 rounded bg-zinc-700/50 text-amber-300 text-[10px] font-mono">{cp.slice(1, -1)}</code>;
        }
        return <span key={`${i}-${ci}`}>{cp}</span>;
      });
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export const WolfAnalystPanel: React.FC<WolfAnalystPanelProps> = (props) => {
  const { isOpen, onClose, isDarkMode } = props;
  const [messages, setMessages] = useState<WolfMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Send message
  const sendMessage = useCallback(async (text: string, mode: 'verify' | 'chat' = 'chat') => {
    if (!text.trim() && mode === 'chat') return;
    if (!isWolfConfigured()) {
      setError('WOLF Analyst is not configured. Set VITE_GEMINI_API_KEY in your .env file and restart the dev server.');
      return;
    }

    const userMsg: WolfMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const req: WolfAnalystRequest = {
        mode,
        userMessage: text,
        conversationHistory: messages,
        financialData: props.financialData,
        assumptions: props.assumptions,
        comparables: props.comparables,
        dcfProjections: props.dcfProjections,
        dcfValue: props.dcfValue,
        comparableValue: props.comparableValue,
        blendedValue: props.blendedValue,
        upside: props.upside,
        waccResult: props.waccResult,
        dcfResult: props.dcfResult,
        ddmResult: props.ddmResult,
        fcffVerification: props.fcffVerification,
        scenarioAnalysis: props.scenarioAnalysis,
      };

      const reply = await callWolfAnalyst(req);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`AI verification unavailable: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  }, [messages, props]);

  const runFullVerification = () =>
    sendMessage('Run full verification of all modules.', 'verify');

  if (!isOpen) return null;

  // ── Render ──

  return (
    <div
      className={`fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl transition-all duration-300
        ${isDarkMode
          ? 'bg-zinc-900/95 border-l border-zinc-700 text-gray-200'
          : 'bg-white/95 border-l border-gray-200 text-gray-800'}
        backdrop-blur-xl`}
      style={{ width: 420, maxWidth: '100vw' }}
    >
      {/* ── Header ── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${isDarkMode ? 'border-zinc-700 bg-zinc-800/80' : 'border-gray-200 bg-gray-50/80'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🐺</span>
          <div>
            <h3 className="text-sm font-bold tracking-wide">WOLF Analyst</h3>
            <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>CFA-grade AI Verifier · Groq Llama 3.1</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-zinc-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Verify Button ── */}
      <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`}>
        <button
          onClick={runFullVerification}
          disabled={loading}
          className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all
            ${loading
              ? 'bg-zinc-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-900/30'}`}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <CheckCircle size={14} />
              Verify All Calculations
            </>
          )}
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-xs font-medium">Ask WOLF Analyst anything about the valuation</p>
            <p className="text-[10px] mt-1 opacity-70">or click "Verify All Calculations" for a full audit</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] rounded-xl px-3 py-2 ${
              m.role === 'user'
                ? 'bg-red-600 text-white rounded-br-sm'
                : isDarkMode
                  ? 'bg-zinc-800 border border-zinc-700 rounded-bl-sm'
                  : 'bg-gray-100 border border-gray-200 rounded-bl-sm'
            }`}>
              {m.role === 'assistant'
                ? <div className="wolf-md">{renderMarkdown(m.content, isDarkMode)}</div>
                : <p className="text-xs">{m.content}</p>
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className={`rounded-xl px-3 py-2 rounded-bl-sm flex items-center gap-2
              ${isDarkMode ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-100 border border-gray-200'}`}>
              <Loader2 size={12} className="animate-spin text-red-400" />
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Analyzing…</span>
            </div>
          </div>
        )}

        {error && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
            ${isDarkMode ? 'bg-red-900/30 border border-red-700/50 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50/50'}`}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about any calculation or formula…"
            disabled={loading}
            className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors
              ${isDarkMode
                ? 'bg-zinc-900 border-zinc-600 text-white placeholder:text-gray-600 focus:border-red-500'
                : 'bg-white border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-red-500'}
              focus:outline-none focus:ring-1 focus:ring-red-500/30`}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className={`px-3 py-2 rounded-lg transition-all
              ${loading || !input.trim()
                ? isDarkMode ? 'bg-zinc-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-md'}`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WolfAnalystPanel;
