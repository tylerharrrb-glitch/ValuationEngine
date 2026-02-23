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

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate current price position
  const currentPricePosition = getPosition(currentPrice);

  return (
    <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          <Tooltip term="Intrinsic Value">Football Field Valuation</Tooltip>
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              Current: {formatPrice(currentPrice)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Mid Value</span>
          </div>
        </div>
      </div>

      {/* Chart container with labels */}
      <div className="flex">
        {/* Y-axis labels */}
        <div className="w-28 flex-shrink-0">
          {valuations.map((val, index) => (
            <div 
              key={index} 
              className={`h-16 flex items-center text-sm font-medium text-right pr-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              {val.method}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          {/* Price scale at top */}
          <div className="flex justify-between text-xs text-gray-500 mb-4 px-1">
            <span>{formatPrice(minValue)}</span>
            <span>{formatPrice((minValue + maxValue) / 2)}</span>
            <span>{formatPrice(maxValue)}</span>
          </div>

          {/* Bars container - this is where the current price line should be relative to */}
          <div className="relative">
            {/* Current price vertical line - positioned within the bars container */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
              style={{ 
                left: `${currentPricePosition}%`,
              }}
            >
              {/* Price label at top */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-semibold shadow-lg">
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
                    <div className={`absolute inset-y-0 left-0 right-0 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}></div>
                    
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

                    {/* Value labels below bar */}
                    <div
                      className={`absolute top-full mt-1 text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                      style={{ left: `${lowPos}%`, transform: 'translateX(-50%)' }}
                    >
                      {formatPrice(val.low)}
                    </div>
                    <div
                      className={`absolute top-full mt-1 text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                      style={{ left: `${highPos}%`, transform: 'translateX(-50%)' }}
                    >
                      {formatPrice(val.high)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend - Valuation summary cards */}
      <div className={`mt-10 pt-4 border-t ${isDarkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {valuations.map((val, index) => {
            const vsCurrentPercent = ((val.mid - currentPrice) / currentPrice) * 100;
            const isUpside = vsCurrentPercent > 0;
            
            return (
              <div key={index} className={`p-3 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded ${val.color}`}></div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{val.method}</div>
                </div>
                <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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
