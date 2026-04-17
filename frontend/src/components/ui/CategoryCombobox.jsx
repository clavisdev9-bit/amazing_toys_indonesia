import React, { useState, useRef, useEffect } from 'react';

export default function CategoryCombobox({ label, value, onChange, categories = [], required }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const normalised = value.trim().toLowerCase();
  const suggestions = categories.filter(
    (c) => c.toLowerCase().includes(normalised) && c.toLowerCase() !== normalised,
  );
  const exactMatch = categories.find((c) => c.toLowerCase() === normalised);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(e) {
    onChange(e.target.value);
    setOpen(true);
  }

  function handleSelect(cat) {
    onChange(cat);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        required={required}
        autoComplete="off"
      />
      {exactMatch && (
        <p className="text-xs text-amber-600">Kategori sudah ada — akan menggunakan yang terdaftar</p>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((cat) => (
            <li
              key={cat}
              onMouseDown={() => handleSelect(cat)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700"
            >
              {cat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
