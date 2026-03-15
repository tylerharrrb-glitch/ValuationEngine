import React from 'react';
import { CurrencyCode } from '../../../utils/formatters';

interface ScorecardFactor { name: string; score: number; maxScore: number; }
interface ScorecardCategory { category: string; score: number; maxScore: number; factors: ScorecardFactor[]; }
interface ScorecardData {
  grade: string;
  totalScore: number;
  maxTotalScore: number;
  qualityPremium: number;
  economicMoat: ScorecardCategory;
  financialHealth: ScorecardCategory;
  growthProfile: ScorecardCategory;
  capitalAllocation: ScorecardCategory;
}

interface Props {
  scorecard: ScorecardData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const QualityScorecard: React.FC<Props> = ({
  scorecard, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
  const categories = [scorecard.economicMoat, scorecard.financialHealth, scorecard.growthProfile, scorecard.capitalAllocation];
  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${textClass}`}>Quality Scorecard</h3>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${
            scorecard.grade.startsWith('A') ? 'text-green-400' :
            scorecard.grade.startsWith('B') ? 'text-blue-400' :
            scorecard.grade.startsWith('C') ? 'text-yellow-400' : 'text-red-400'
          }`}>{scorecard.grade}</span>
          <div className={`text-sm ${textMutedClass}`}>
            <div>{scorecard.totalScore.toFixed(1)} / {scorecard.maxTotalScore}</div>
            <div className={scorecard.qualityPremium >= 0 ? 'text-green-400' : 'text-red-400'}>
              {scorecard.qualityPremium >= 0 ? '+' : ''}{scorecard.qualityPremium}% quality premium
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div key={cat.category} className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-semibold ${textClass}`}>{cat.category}</span>
              <span className={`text-sm font-bold ${
                cat.score / cat.maxScore > 0.7 ? 'text-green-400' :
                cat.score / cat.maxScore > 0.4 ? 'text-yellow-400' : 'text-red-400'
              }`}>{cat.score.toFixed(1)}/{cat.maxScore}</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2 mb-3">
              <div className={`h-2 rounded-full ${
                cat.score / cat.maxScore > 0.7 ? 'bg-green-500' :
                cat.score / cat.maxScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
              }`} style={{ width: `${(cat.score / cat.maxScore) * 100}%` }} />
            </div>
            <div className="space-y-1">
              {cat.factors.map((f: ScorecardFactor) => (
                <div key={f.name} className="flex items-center justify-between">
                  <span className={`text-xs ${textMutedClass}`}>{f.name}</span>
                  <span className={`text-xs font-medium ${
                    f.score / f.maxScore > 0.7 ? 'text-green-400' :
                    f.score / f.maxScore > 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{f.score.toFixed(1)}/{f.maxScore}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
