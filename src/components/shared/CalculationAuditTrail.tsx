/**
 * Calculation Audit Trail — Shows history position and last saved indicator.
 */
import React from 'react';
import { Clock, History } from 'lucide-react';

interface Props {
  historyIndex: number;
  historyLength: number;
  lastSaved?: string;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
}

export const CalculationAuditTrail: React.FC<Props> = ({
  historyIndex, historyLength, lastSaved, cardClass, textMutedClass,
}) => {
  return (
    <div className={`flex items-center gap-4 px-4 py-2 rounded-lg border ${cardClass}`}>
      <div className={`flex items-center gap-2 text-xs ${textMutedClass}`}>
        <History size={14} />
        <span>Step {historyIndex + 1} of {historyLength}</span>
      </div>
      {lastSaved && (
        <div className={`flex items-center gap-2 text-xs ${textMutedClass}`}>
          <Clock size={14} />
          <span>Last saved: {lastSaved}</span>
        </div>
      )}
    </div>
  );
};

export default CalculationAuditTrail;
