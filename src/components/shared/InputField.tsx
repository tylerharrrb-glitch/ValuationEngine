/**
 * Reusable input field component using DebouncedInput.
 * Handles number formatting, prefix/suffix, and tooltips.
 */
import React from 'react';
import { DebouncedInput } from '../DebouncedInput';
import { Tooltip } from '../Tooltip';
import { formatCurrencyShort, formatShares, CurrencyCode } from '../../utils/formatters';

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (val: number | string) => void;
  tooltip?: string;
  prefix?: string;
  suffix?: string;
  type?: string;
  step?: string;
  showAsShares?: boolean;
  min?: number;
  max?: number;
  validate?: (value: number | string) => string | null;
  isDarkMode: boolean;
  textMutedClass: string;
  inputClass: string;
  currency: CurrencyCode;
}

/**
 * Input field with debounced updates, optional tooltip, prefix/suffix,
 * and automatic number formatting display.
 */
export const InputField: React.FC<InputFieldProps> = ({
  label, value, onChange, tooltip, prefix, suffix,
  type = 'number', step = 'any', showAsShares = false,
  min, max, validate,
  textMutedClass, inputClass, currency,
}) => {
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (val: string | number) => {
    // Clear previous error
    setError(null);
    
    // Number specific validation
    if (type === 'number' && typeof val === 'number') {
      if (min !== undefined && val < min) {
        setError(`Value cannot be less than ${min}`);
        // We still allow the change to happen so user can correct it, 
        // OR we could block it. Let's allow and show error.
      }
      if (max !== undefined && val > max) {
        setError(`Value cannot be greater than ${max}`);
      }
    }
    
    // Custom validation
    if (validate) {
      const customError = validate(val);
      if (customError) setError(customError);
    }

    onChange(val);
  };

  return (
    <div className="mb-2">
      <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>
        {tooltip ? <Tooltip term={tooltip}>{label}</Tooltip> : label}
      </label>
      <div className="flex items-center">
        {prefix && <span className={`mr-2 ${textMutedClass}`}>{prefix}</span>}
        <DebouncedInput
          type={type as 'number' | 'text'}
          step={step}
          value={value}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10' : inputClass}`}
        />
        {suffix && <span className={`ml-2 ${textMutedClass}`}>{suffix}</span>}
      </div>
      {error && (
        <span className="text-xs text-red-500 mt-1 block">{error}</span>
      )}
      {!error && type === 'number' && typeof value === 'number' && (value > 999 || value < -999) && (
        <span className={`text-xs ${textMutedClass} mt-1 block`}>
          {showAsShares ? `${formatShares(value)} shares` : formatCurrencyShort(value, currency)}
        </span>
      )}
    </div>
  );
};

export default InputField;
