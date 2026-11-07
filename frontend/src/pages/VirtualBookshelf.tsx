import React, { useState, useEffect } from 'react';
import { Library, Filter, RefreshCw, BookOpen, Layers } from 'lucide-react';
import { api } from '../services/api';
import { VirtualShelfItem } from '../types';

export const VirtualBookshelf: React.FC = () => {
  const [items, setItems] = useState<VirtualShelfItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryCode, setCategoryCode] = useState<string>('');
  const [activeItem, setActiveItem] = useState<VirtualShelfItem | null>(null);

  const fetchBookshelf = async () => {
    setLoading(true);
    try {
      const data = await api.getVirtualBookshelf(categoryCode || undefined);
      setItems(data);
      if (data.length > 0) setActiveItem(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookshelf();
  }, [categoryCode]);

  // Color generator based on category
  const getSpineColor = (cat: string) => {
    if (cat.startsWith('0')) return 'from-emerald-700 to-emerald-900 border-emerald-500/50 text-emerald-100';
    if (cat.startsWith('6')) return 'from-cyan-700 to-cyan-900 border-cyan-500/50 text-cyan-100';
    if (cat.startsWith('8')) return 'from-amber-700 to-amber-900 border-amber-500/50 text-amber-100';
    if (cat.startsWith('1')) return 'from-purple-700 to-purple-900 border-purple-500/50 text-purple-100';
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
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Stacks</option>
              <option value="004">004 - Computer Science & AI</option>
              <option value="620">620 - Applied Engineering</option>
              <option value="100">100 - Philosophy & Psychology</option>
            </select>
          </div>
          <button
            onClick={fetchBookshelf}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Virtual Bookshelf Visual Presentation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <span className="flex items-center space-x-1.5 font-semibold text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Interactive Shelf Bay: MAIN-STACKS-A</span>
          </span>
          <span>Click any spine to inspect accession details</span>
        </div>

        {/* Shelf Rack */}
        <div className="relative pt-6 pb-2 px-4 bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 rounded-lg min-h-[320px] flex items-end overflow-x-auto space-x-3 shadow-inner">
          {items.map((book) => {
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

                  {/* Availability badge on spine foot */}
                  <div className="pt-2 text-center border-t border-white/20">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        book.available_copies > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                      }`}
                    >
                      {book.available_copies} avail
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Wooden Shelf Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-950 border-t-2 border-amber-800 shadow-md" />
        </div>

        {/* Selected Book Detail Inspection Card */}
        {activeItem && (
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
                <div className="text-lg font-bold text-emerald-400">
                  {activeItem.available_copies} / {activeItem.total_copies}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Copies On Shelf</div>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                Available for Checkout
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
