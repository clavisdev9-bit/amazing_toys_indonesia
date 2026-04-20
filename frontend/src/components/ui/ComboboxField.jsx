import React, { useState, useRef, useEffect } from 'react';

/**
 * Generic autocomplete combobox.
 * options: [{ value: number, label: string }]
 * value: number | null — currently selected value
 * onChange: (option: { value, label } | null) => void
 */
export default function ComboboxField({
  label,
  options = [],
  value,
  onChange,
  isLoading = false,
  error = null,
  required = false,
  placeholder = 'Ketik untuk mencari...',
  validationError,
}) {
  const selectedOption  = options.find(o => o.value === value) ?? null;
  const [inputText, setInputText]       = useState(selectedOption?.label ?? '');
  const [open, setOpen]                 = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef(null);

  // Sync display text when external value changes (e.g., form reset)
  useEffect(() => {
    const opt = options.find(o => o.value === value) ?? null;
    setInputText(opt?.label ?? '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click; restore display text if no selection
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        const opt = options.find(o => o.value === value) ?? null;
        setInputText(opt?.label ?? '');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, options]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(inputText.toLowerCase())
  );

  function handleInputChange(e) {
    setInputText(e.target.value);
    setHighlightIdx(-1);
    setOpen(true);
    if (value != null) onChange(null);
  }

  function handleSelect(opt) {
    setInputText(opt.label);
    onChange(opt);
    setOpen(false);
    setHighlightIdx(-1);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && e.key === 'ArrowDown') { setOpen(true); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlightIdx]);
    }
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
          ${validationError ? 'border-red-400' : 'border-gray-300'}`}
        value={inputText}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {validationError && <p className="text-xs text-red-500">{validationError}</p>}

      {open && (
        <ul
          className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          role="listbox"
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-3 py-2">
                <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${55 + i * 10}%` }} />
              </li>
            ))
          ) : error ? (
            <li className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg">{error}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400 italic">Tidak ada hasil ditemukan.</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value}
                onMouseDown={() => handleSelect(opt)}
                className={`px-3 py-2 text-sm cursor-pointer
                  ${idx === highlightIdx ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50 hover:text-blue-700'}
                  ${opt.value === value ? 'font-medium' : ''}`}
                role="option"
                aria-selected={opt.value === value}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
