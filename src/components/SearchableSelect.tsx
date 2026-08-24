import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
  type?: string;
  swatch?: string;
}

interface SearchableSelectProps {
  id?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = "ค้นหา...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync search input with current label when opened
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.type && opt.type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-[9999]" : "z-[10]"}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 mt-1 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold flex items-center justify-between cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        <span className="truncate max-w-[90%]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/80 max-h-72 flex flex-col overflow-hidden z-[9999] animate-fade-in-down">
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="พิมพ์เพื่อค้นหาผ้า..."
              className="w-full bg-transparent text-slate-700 text-xs outline-none py-1 font-semibold"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-0.5 hover:bg-slate-200 rounded-full cursor-pointer text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50 max-h-56 scrollbar-thin">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-xs font-semibold flex items-center justify-between hover:bg-indigo-50/50 cursor-pointer transition ${
                      isSelected ? "bg-indigo-50 text-indigo-700" : "text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[85%]">
                      {opt.swatch && (
                        <img
                          src={opt.swatch}
                          alt=""
                          className="w-4 h-4 rounded-md border border-slate-200 shrink-0 object-cover"
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                ไม่พบผลลัพธ์ที่ค้นหา
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
