import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Copy,
  ChevronDown,
  ChevronRight,
  Shield,
  Radio,
  Layers,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Book, BookItem } from '../types';

export const BookCatalog: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);

  // Modals
  const [showAddBookModal, setShowAddBookModal] = useState<boolean>(false);
  const [showAddCopyModal, setShowAddCopyModal] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Book Form
  const [newBook, setNewBook] = useState({
    isbn: '',
    title: '',
    subtitle: '',
    author_name: '',
    category_code: '004',
    publisher: '',
    publish_year: new Date().getFullYear(),
    initial_copies: 2,
    shelf_location: 'MAIN-SHELF-A',
    is_reference_only: false
  });

  // New Copy Form
  const [newCopy, setNewCopy] = useState({
    shelf_location: 'MAIN-SHELF-A',
    status: 'available',
    is_reference_only: false,
    price: 39.99
  });

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const data = await api.getBooks({
        q: search || undefined,
        category_id: selectedCategory ? parseInt(selectedCategory) : undefined,
        limit: 50
      });
      setBooks(data.items);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Failed to fetch books', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await api.getCategories();
        setCategories(cats);
      } catch (e) {
        console.error(e);
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBooks();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, selectedCategory]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.createBook(newBook);
      setShowAddBookModal(false);
      setNewBook({
        isbn: '',
        title: '',
        subtitle: '',
        author_name: '',
        category_code: '004',
        publisher: '',
        publish_year: new Date().getFullYear(),
        initial_copies: 2,
        shelf_location: 'MAIN-SHELF-A',
        is_reference_only: false
      });
      fetchBooks();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create book');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddCopyModal) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.addBookCopy(showAddCopyModal, newCopy);
      setShowAddCopyModal(null);
      fetchBooks();
    } catch (err: any) {
      setModalError(err.message || 'Failed to add copy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Title, Author, ISBN, Call Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setModalError(null);
              setShowAddBookModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Catalogue New Book</span>
          </button>
          <button
            onClick={fetchBooks}
            title="Refresh Catalog"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{books.length}</strong> of{' '}
            <strong className="text-white">{total}</strong> titles in catalog
          </span>
          <span className="font-mono text-[11px] text-emerald-400">Multi-Copy Accession Model</span>
        </div>

        {loading && books.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
            Searching catalog records...
          </div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No books found matching search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Title & Subtitle</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4">ISBN</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Call Number</th>
                  <th className="py-3 px-4 text-center">Copies</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {books.map((b) => {
                  const isExpanded = expandedBookId === b.id;
                  return (
                    <React.Fragment key={b.id}>
                      <tr
                        className={`hover:bg-slate-800/50 transition-colors ${
                          isExpanded ? 'bg-slate-800/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setExpandedBookId(isExpanded ? null : b.id)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-medium text-white max-w-xs">
                          <div className="font-semibold text-slate-100">{b.title}</div>
                          {b.subtitle && <div className="text-[11px] text-slate-400">{b.subtitle}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{b.author_name || 'N/A'}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{b.isbn}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {b.category_code} - {b.category_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">{b.call_number || 'N/A'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {b.available_copies_count} / {b.copies_count} avail
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setModalError(null);
                              setShowAddCopyModal(b.id);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700 transition-colors"
                          >
                            + Add Copy
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Physical Copies Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-slate-950/70">
                          <td colSpan={8} className="p-4 pl-12 border-y border-slate-800">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Physical Copies ({b.items.length})</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Each copy holds independent accession & RFID binding
                                </span>
                              </div>

                              <div className="overflow-x-auto rounded border border-slate-800">
                                <table className="w-full text-left text-xs bg-slate-900">
                                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                                    <tr>
                                      <th className="py-2 px-3">Copy #</th>
                                      <th className="py-2 px-3">Accession Number</th>
                                      <th className="py-2 px-3">Barcode</th>
                                      <th className="py-2 px-3">Shelf Location</th>
                                      <th className="py-2 px-3">Circulation Status</th>
                                      <th className="py-2 px-3">Reference Rule</th>
                                      <th className="py-2 px-3">RFID EPC Tag</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800">
                                    {b.items.map((item) => (
                                      <tr key={item.id} className="hover:bg-slate-800/40">
                                        <td className="py-1.5 px-3 font-semibold text-slate-300">
                                          Copy {item.copy_number}
                                        </td>
                                        <td className="py-1.5 px-3 font-mono text-emerald-400 font-medium">
                                          {item.accession_number}
                                        </td>
                                        <td className="py-1.5 px-3 font-mono text-slate-400">
                                          {item.barcode}
                                        </td>
                                        <td className="py-1.5 px-3 text-slate-300">
                                          <span className="flex items-center space-x-1">
                                            <Layers className="w-3 h-3 text-cyan-400" />
                                            <span>{item.shelf_location}</span>
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                              item.status === 'available'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            }`}
                                          >
                                            {item.status}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3">
                                          {item.is_reference_only ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                              <Shield className="w-3 h-3 mr-1" /> Reference Only
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400">Loanable</span>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-3 font-mono text-[11px]">
                                          {item.rfid_tag_uid ? (
                                            <span className="inline-flex items-center space-x-1 text-cyan-300">
                                              <Radio className="w-3 h-3 text-cyan-400" />
                                              <span>{item.rfid_tag_uid}</span>
                                              <span
                                                className={`text-[9px] px-1 rounded ${
                                                  item.rfid_eas_bit
                                                    ? 'bg-rose-900/60 text-rose-300'
                                                    : 'bg-emerald-900/60 text-emerald-300'
                                                }`}
                                              >
                                                {item.rfid_eas_bit ? 'EAS-Armed' : 'EAS-Disarmed'}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 italic">Unbound (Ready in Batch 2)</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Catalogue New Book */}
      {showAddBookModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>Catalogue New Bibliographic Title</span>
              </h3>
              <button
                onClick={() => setShowAddBookModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBook} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">ISBN *</label>
                  <input
                    type="text"
                    required
                    placeholder="978-0134610993"
                    value={newBook.isbn}
                    onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Category Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="004, 620, 800..."
                    value={newBook.category_code}
                    onChange={(e) => setNewBook({ ...newBook, category_code: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Book title..."
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Subtitle</label>
                <input
                  type="text"
                  placeholder="Optional subtitle or edition detail..."
                  value={newBook.subtitle}
                  onChange={(e) => setNewBook({ ...newBook, subtitle: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Author Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Author name..."
                    value={newBook.author_name}
                    onChange={(e) => setNewBook({ ...newBook, author_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Publisher</label>
                  <input
                    type="text"
                    placeholder="Pearson / O'Reilly..."
                    value={newBook.publisher}
                    onChange={(e) => setNewBook({ ...newBook, publisher: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Initial Copies</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newBook.initial_copies}
                    onChange={(e) =>
                      setNewBook({ ...newBook, initial_copies: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Shelf Location</label>
                  <input
                    type="text"
                    value={newBook.shelf_location}
                    onChange={(e) => setNewBook({ ...newBook, shelf_location: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBook.is_reference_only}
                      onChange={(e) =>
                        setNewBook({ ...newBook, is_reference_only: e.target.checked })
                      }
                      className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
                    />
                    <span>Reference Only</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save & Generate Accessions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Copy to Existing Title */}
      {showAddCopyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Copy className="w-4 h-4 text-cyan-400" />
                <span>Add Physical Copy</span>
              </h3>
              <button
                onClick={() => setShowAddCopyModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddCopy} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Shelf Location</label>
                <input
                  type="text"
                  required
                  value={newCopy.shelf_location}
                  onChange={(e) => setNewCopy({ ...newCopy, shelf_location: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Status</label>
                <select
                  value={newCopy.status}
                  onChange={(e) => setNewCopy({ ...newCopy, status: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newCopy.is_reference_only}
                    onChange={(e) => setNewCopy({ ...newCopy, is_reference_only: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
                  />
                  <span>Mark as Reference Only (No loans permitted)</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCopyModal(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Physical Copy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
