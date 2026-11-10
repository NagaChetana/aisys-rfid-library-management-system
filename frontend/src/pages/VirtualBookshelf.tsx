import React, { useState, useEffect } from 'react';
import { Library, Filter, RefreshCw, BookOpen, Layers, ChevronDown, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { VirtualShelfItem } from '../types';

export const VirtualBookshelf: React.FC = () => {
  const [items, setItems] = useState<VirtualShelfItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryCode, setCategoryCode] = useState<string>('');
  const [activeItem, setActiveItem] = useState<VirtualShelfItem | null>(null);

  const fetchBookshelf = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getVirtualBookshelf(categoryCode || undefined);
      setItems(data);
      if (data.length === 0) {
        // Clear stale selection when filtered results are empty (OPAC-01)
        setActiveItem(null);
      } else {
        // Preserve selected book if still present in data, otherwise default to first (OPAC-04)
        setActiveItem((prev) => {
          if (prev && data.some((item) => item.id === prev.id)) {
            return data.find((item) => item.id === prev.id) || data[0];
          }
          return data[0];
        });
      }
    } catch (err: any) {
      console.error('Bookshelf fetch error:', err);
      setError(err.message || 'Failed to reload bookshelf data');
      setActiveItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookshelf();
  }, [categoryCode]);

  // Dynamic shelf header (OPAC-03)
  const getShelfHeader = () => {
    if (items.length === 0) {
      return categoryCode
        ? `Interactive Shelf Bay: Empty (Category ${categoryCode})`
        : 'Interactive Shelf Bay: No matching books';
    }
    const currentShelf = items[0]?.shelf_location || 'MAIN-SHELF-A';
    return `Interactive Shelf Bay: ${currentShelf}`;
  };

  // Color generator based on category
  const getSpineColor = (cat: string) => {
    if (cat.startsWith('0')) return 'from-emerald-700 to-emerald-900 border-emerald-500/50 text-emerald-100';
    if (cat.startsWith('6')) return 'from-cyan-700 to-cyan-900 border-cyan-500/50 text-cyan-100';
    if (cat.startsWith('8')) return 'from-amber-700 to-amber-900 border-amber-500/50 text-amber-100';
    if (cat.startsWith('1')) return 'from-purple-700 to-purple-900 border-purple-500/50 text-purple-100';
    if (cat.startsWith('3')) return 'from-rose-700 to-rose-900 border-rose-500/50 text-rose-100';
    if (cat.startsWith('5')) return 'from-teal-700 to-teal-900 border-teal-500/50 text-teal-100';
    return 'from-blue-700 to-blue-900 border-blue-500/50 text-blue-100';
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Library className="w-5 h-5 text-emerald-400" />
            <span>OPAC Virtual Bookshelf</span>
          </h2>
          <p className="text-xs text-slate-400">
            Interactive visual browsing of library stacks organized by Dewey Decimal classification (FR02).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            {/* Styled category dropdown with perfectly aligned chevron arrow (OPAC-02) */}
            <div className="relative inline-flex items-center">
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 pl-3 pr-8 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[210px]"
              >
                <option value="">All Stacks</option>
                <option value="004">004 - Computer Science &amp; AI</option>
                <option value="100">100 - Philosophy &amp; Psychology</option>
                <option value="300">300 - Social Sciences &amp; Economics</option>
                <option value="500">500 - Natural Sciences &amp; Math</option>
                <option value="620">620 - Applied Engineering</option>
                <option value="800">800 - Literature &amp; Rhetoric</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>
          {/* Refresh button with real reload and spin state (OPAC-04) */}
          <button
            onClick={fetchBookshelf}
            disabled={loading}
            title="Reload bookshelf data"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Virtual Bookshelf Visual Presentation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <span className="flex items-center space-x-1.5 font-semibold text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{getShelfHeader()}</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {items.length > 0 ? 'Click any spine to inspect accession details' : 'Choose a populated stack'}
          </span>
        </div>

        {/* Shelf Rack */}
        <div className="relative pt-6 pb-2 px-4 bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 rounded-lg min-h-[320px] flex items-end overflow-x-auto space-x-3 shadow-inner">
          {loading ? (
            <div className="w-full py-16 flex flex-col items-center justify-center text-center space-y-2 z-10 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs">Loading shelf items from repository...</p>
            </div>
          ) : items.length === 0 ? (
            // Clean empty state (OPAC-01)
            <div className="w-full py-16 flex flex-col items-center justify-center text-center space-y-2 z-10">
              <BookOpen className="w-10 h-10 text-slate-600 mb-1" />
              <p className="text-sm font-semibold text-slate-300">No books found in this category.</p>
              <p className="text-xs text-slate-500 max-w-sm">
                There are currently no items catalogued in Dewey Decimal classification {categoryCode || 'selected'}. Select another stack to browse.
              </p>
            </div>
          ) : (
            items.map((book) => {
              const isSelected = activeItem?.id === book.id;
              const spineStyle = getSpineColor(book.category_code);

              return (
                <div
                  key={book.id}
                  onClick={() => setActiveItem(book)}
                  className={`group relative flex-shrink-0 cursor-pointer transition-all duration-200 select-none ${
                    isSelected ? '-translate-y-4 scale-105' : 'hover:-translate-y-2'
                  }`}
                  style={{
                    width: '64px',
                    height: '240px',
                  }}
                >
                  {/* Book Spine 3D Effect */}
                  <div
                    className={`w-full h-full rounded-t-md p-2 flex flex-col justify-between border-t-2 border-r-2 border-l shadow-2xl bg-gradient-to-r ${spineStyle} ${
                      isSelected ? 'ring-2 ring-emerald-400 shadow-emerald-500/20' : ''
                    }`}
                  >
                    <div className="text-[10px] font-mono tracking-tighter uppercase font-bold text-white/80 truncate">
                      {book.call_number || book.category_code}
                    </div>

                    {/* Vertical Spine Title */}
                    <div className="my-auto overflow-hidden">
                      <p
                        className="text-xs font-bold tracking-tight text-white line-clamp-3 leading-snug"
                        title={book.title}
                      >
                        {book.title}
                      </p>
                      <p className="text-[9px] text-white/70 truncate mt-1">{book.author}</p>
                    </div>

                    {/* Availability badge on spine foot (OPAC-05) */}
                    <div className="pt-2 text-center border-t border-white/20">
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          book.available_copies > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {book.available_copies > 0 ? `${book.available_copies} avail` : '0 avail'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Wooden Shelf Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-950 border-t-2 border-amber-800 shadow-md pointer-events-none" />
        </div>

        {/* Selected Book Detail Inspection Card (Hidden if items is empty) (OPAC-01, OPAC-05) */}
        {activeItem && items.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h4 className="text-base font-bold text-white">{activeItem.title}</h4>
                <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-cyan-300 border border-slate-700">
                  {activeItem.isbn}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Author: <strong className="text-emerald-400">{activeItem.author}</strong> • Call No:{' '}
                <span className="font-mono text-slate-300">{activeItem.call_number}</span>
              </p>
              <p className="text-xs text-slate-400">
                Shelf Location:{' '}
                <span className="font-mono text-cyan-400">{activeItem.shelf_location}</span>
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className={`text-lg font-bold ${activeItem.available_copies > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeItem.available_copies} / {activeItem.total_copies}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Loanable Copies</div>
              </div>

              {/* Exact availability label based on available physical loanable copies (OPAC-05) */}
              {activeItem.available_copies > 0 ? (
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                  Available for Checkout
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-semibold">
                  Unavailable for Checkout
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
