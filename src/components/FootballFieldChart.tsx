import React from 'react';
import { Tooltip } from './Tooltip';

interface ValuationRange {
  method: string;
  low: number;
  mid: number;
  high: number;
  color: string;
}

interface FootballFieldChartProps {
  valuations: ValuationRange[];
  currentPrice: number;
  isDarkMode: boolean;
  currency?: string;
}

export const FootballFieldChart: React.FC<FootballFieldChartProps> = ({
  valuations,
  currentPrice,
  isDarkMode,
  currency = 'USD',
}) => {
  // Find the overall min and max for scaling with padding
  const allValues = valuations.flatMap(v => [v.low, v.mid, v.high]).concat([currentPrice]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  // Calculate chart range with padding (20% on each side)
  const chartPadding = (dataMax - dataMin) * 0.25;
  const minValue = Math.max(0, dataMin - chartPadding);
  const maxValue = dataMax + chartPadding;
  const range = maxValue - minValue;

  const getPosition = (value: number) => {
    // Return position as percentage
    const pos = ((value - minValue) / range) * 100;
    return Math.max(0, Math.min(100, pos));
  };

  const formatPrice = (value: number | string) => {
    // Safeguard: if value is somehow already a formatted string, strip existing prefix
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(numValue)) return 'N/A';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
    // For EGP, prefix manually to avoid double-prefix from Intl
    if (currency === 'EGP') {
      return `EGP ${formatted}`;
    }
    return `$${formatted}`;
  };

  // Calculate current price position
  const currentPricePosition = getPosition(currentPrice);

  return (
    <div className="wolf-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="section-label">FOOTBALL FIELD VALUATION</span>
          <h3 style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            <Tooltip term="Intrinsic Value">Valuation Range Comparison</Tooltip>
          </h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent-gold)' }}></div>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.75rem' }}>
              Current: {formatPrice(currentPrice)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.75rem' }}>Mid Value</span>
          </div>
        </div>
      </div>

      {/* Chart container with labels */}
      <div className="flex">
        {/* Y-axis labels — pt-[28px] matches the price scale header height + mb-4 */}
        <div className="w-28 flex-shrink-0 pt-[28px]">
          {valuations.map((val, index) => (
            <div
              key={index}
              className="h-16 flex items-center text-sm font-medium text-right pr-4"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}
            >
              {val.method}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          {/* Price scale at top */}
          <div className="flex justify-between text-xs mb-4 px-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>
            <span>{formatPrice(minValue)}</span>
            <span>{formatPrice((minValue + maxValue) / 2)}</span>
            <span>{formatPrice(maxValue)}</span>
          </div>

          {/* Bars container - this is where the current price line should be relative to */}
          <div className="relative">
            {/* Current price vertical line - positioned within the bars container */}
            <div
              className="absolute top-0 bottom-0 w-0.5 z-20"
              style={{
                left: `${currentPricePosition}%`,
                background: 'var(--accent-gold)',
              }}
            >
              {/* Price label at top */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap font-semibold shadow-lg" style={{ background: 'var(--accent-gold)', color: 'var(--bg-primary)', fontFamily: 'var(--ff-mono)' }}>
                {formatPrice(currentPrice)}
              </div>
            </div>

            {/* Valuation bars */}
            {valuations.map((val, index) => {
              const lowPos = getPosition(val.low);
              const highPos = getPosition(val.high);
              const midPos = getPosition(val.mid);
              const width = highPos - lowPos;

              return (
                <div key={index} className="h-16 flex items-center">
                  <div className="flex-1 relative h-10">
                    {/* Background bar */}
                    <div className="absolute inset-y-0 left-0 right-0 rounded-lg" style={{ background: 'var(--bg-secondary)' }}></div>

                    {/* Range bar */}
                    <div
                      className={`absolute inset-y-0 rounded-lg opacity-80 ${val.color}`}
                      style={{
                        left: `${lowPos}%`,
                        width: `${Math.max(width, 1)}%`,
                      }}
                    ></div>

                    {/* Mid point marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1.5 bg-yellow-400 rounded-full shadow-lg z-10"
                      style={{ left: `${midPos}%`, transform: 'translateX(-50%)' }}
                    ></div>

                    {/* Value labels below bar — merge when positions overlap */}
                    {(highPos - lowPos) < 8 ? (
                      /* Single combined label when range is too narrow */
                      <div
                      className="absolute top-full mt-1 text-xs font-medium whitespace-nowrap"
                        style={{ left: `${(lowPos + highPos) / 2}%`, transform: 'translateX(-50%)', color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}
                      >
                        {formatPrice(val.low)} — {formatPrice(val.high)}
                      </div>
                    ) : (
                      /* Two separate labels when there's enough space */
                      <>
                        <div
                          className="absolute top-full mt-1 text-xs font-medium"
                          style={{ left: `${lowPos}%`, transform: 'translateX(-50%)', color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}
                        >
                          {formatPrice(val.low)}
                        </div>
                        <div
                          className="absolute top-full mt-1 text-xs font-medium"
                          style={{ left: `${highPos}%`, transform: 'translateX(-50%)', color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}
                        >
                          {formatPrice(val.high)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend - Valuation summary cards */}
      <div className="mt-10 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {valuations.map((val, index) => {
            const vsCurrentPercent = ((val.mid - currentPrice) / currentPrice) * 100;
            const isUpside = vsCurrentPercent > 0;

            return (
              <div key={index} className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded ${val.color}`}></div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)', fontSize: '.7rem' }}>{val.method}</div>
                </div>
                <div className="font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-display)', fontWeight: 900 }}>
                  {formatPrice(val.mid)}
                </div>
                <div className={`text-xs font-medium ${isUpside ? 'text-green-500' : 'text-red-500'}`}>
                  {isUpside ? '▲' : '▼'} {Math.abs(vsCurrentPercent).toFixed(1)}% {isUpside ? 'Upside' : 'Downside'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FootballFieldChart;
