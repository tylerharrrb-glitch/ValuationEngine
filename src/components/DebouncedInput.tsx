import React, { useState, useEffect, useCallback, useRef } from 'react';

interface DebouncedInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  type?: 'number' | 'text';
  step?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  readOnly?: boolean;
}

/**
 * DebouncedInput - A stable input component that doesn't lose focus on parent re-renders
 * 
 * Key features:
 * 1. Uses local state for immediate feedback
 * 2. Only calls onChange after debounce delay or on blur
 * 3. Defined OUTSIDE the main App component (critical for stability)
 * 4. Uses stable key/ref to prevent unmounting
 */
export const DebouncedInput: React.FC<DebouncedInputProps> = React.memo(({
  value,
  onChange,
  type = 'number',
  step = 'any',
  placeholder,
  className,
  debounceMs = 500,
  readOnly = false,
}) => {
  // Local state for immediate input feedback
  const [localValue, setLocalValue] = useState<string>(String(value));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value when external value changes (but not during typing)
  useEffect(() => {
    // Read-only fields always mirror external value; editable fields skip sync while focused
    if (readOnly || document.activeElement !== inputRef.current) {
      setLocalValue(String(value));
    }
  }, [value, readOnly]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle input change with debounce
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced update
    timeoutRef.current = setTimeout(() => {
      if (type === 'number') {
        const numValue = parseFloat(newValue);
        onChange(isNaN(numValue) ? 0 : numValue);
      } else {
        onChange(newValue);
      }
    }, debounceMs);
  }, [onChange, type, debounceMs]);

  // Handle blur - immediately commit value
  const handleBlur = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Commit the value immediately
    if (type === 'number') {
      const numValue = parseFloat(localValue);
      onChange(isNaN(numValue) ? 0 : numValue);
    } else {
      onChange(localValue);
    }
  }, [localValue, onChange, type]);

  // Handle Enter key - commit value immediately
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
      inputRef.current?.blur();
    }
  }, [handleBlur]);

  return (
    <input
      ref={inputRef}
      type={type}
      step={type === 'number' ? step : undefined}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
    />
  );
});

DebouncedInput.displayName = 'DebouncedInput';

export default DebouncedInput;
