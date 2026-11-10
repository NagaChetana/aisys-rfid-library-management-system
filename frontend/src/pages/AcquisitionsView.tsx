import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  BookOpen,
  Calendar,
  DollarSign,
  AlertCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { Supplier, PurchaseOrder, SerialSubscription } from '../types';

export const AcquisitionsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers' | 'serials'>('orders');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serials, setSerials] = useState<SerialSubscription[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showNewSerialModal, setShowNewSerialModal] = useState(false);
  const [showReceiveSerialModal, setShowReceiveSerialModal] = useState(false);

  // Active item for receiving
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<number | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<SerialSubscription | null>(null);

  // Forms
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  });

  const [orderForm, setOrderForm] = useState({
    supplier_id: 0,
    expected_delivery_date: '',
    notes: '',
    items: [{ title: '', author: '', isbn: '', quantity: 1, unit_price: 0 }]
  });

  const [receiveForm, setReceiveForm] = useState({
    quantity_to_receive: 1,
    shelf_location: 'MAIN-SHELF-A',
    create_catalog_records: true
  });

  const [serialForm, setSerialForm] = useState({
    subscription_code: '',
    title: '',
    issn: '',
    supplier_id: 0,
    frequency: 'Monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    annual_cost: 0,
    shelf_location: 'PERIODICALS-BAY-1'
  });

  const [serialIssueForm, setSerialIssueForm] = useState({
    volume: 'Vol. 1',
    issue_number: 'No. 1',
    publication_date: new Date().toISOString().split('T')[0],
    status: 'received'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderRes, suppRes, serialRes] = await Promise.all([
        api.getPurchaseOrders(),
        api.getSuppliers(),
        api.getSerialSubscriptions()
      ]);
      setOrders(orderRes || []);
      setSuppliers(suppRes || []);
      setSerials(serialRes || []);
      if (suppRes && suppRes.length > 0) {
        setOrderForm(prev => ({ ...prev, supplier_id: suppRes[0].id }));
        setSerialForm(prev => ({ ...prev, supplier_id: suppRes[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch acquisitions data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    try {
      await api.createSupplier(supplierForm);
      setSuccessMsg(`Supplier '${supplierForm.name}' created successfully`);
      setShowNewSupplierModal(false);
      setSupplierForm({ name: '', contact_person: '', email: '', phone: '', address: '' });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier');
    }
  };

  const handleAddItemToOrder = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { title: '', author: '', isbn: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const handleRemoveOrderItem = (index: number) => {
    if (orderForm.items.length <= 1) return;
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateOrderItem = (index: number, field: string, value: any) => {
    setOrderForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.supplier_id || orderForm.items.some(i => !i.title.trim())) {
      setError('Please provide a supplier and at least one item title.');
      return;
    }
    try {
      await api.createPurchaseOrder({
        supplier_id: Number(orderForm.supplier_id),
        expected_delivery_date: orderForm.expected_delivery_date || undefined,
        notes: orderForm.notes || undefined,
        items: orderForm.items.map(i => ({
          ...i,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0
        }))
      });
      setSuccessMsg('Purchase order generated successfully.');
      setShowNewOrderModal(false);
      setOrderForm({
        supplier_id: suppliers[0]?.id || 0,
        expected_delivery_date: '',
        notes: '',
        items: [{ title: '', author: '', isbn: '', quantity: 1, unit_price: 0 }]
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
    }
  };

  const handleOpenReceive = (order: PurchaseOrder, itemId: number) => {
    setSelectedOrder(order);
    setSelectedOrderItemId(itemId);
    const item = order.items.find(i => i.id === itemId);
    const remaining = item ? item.quantity - item.received_quantity : 1;
    setReceiveForm({
      quantity_to_receive: remaining > 0 ? remaining : 1,
      shelf_location: 'MAIN-SHELF-A',
      create_catalog_records: true
    });
    setShowReceiveModal(true);
  };

  const handleExecuteReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrderItemId) return;
    try {
      const res = await api.receivePurchaseOrderItem(selectedOrder.id, {
        item_id: selectedOrderItemId,
        quantity_to_receive: Number(receiveForm.quantity_to_receive),
        shelf_location: receiveForm.shelf_location,
        create_catalog_records: receiveForm.create_catalog_records
      });
      setSuccessMsg(`Received ${receiveForm.quantity_to_receive} copies into catalog. Accession numbers generated.`);
      setShowReceiveModal(false);
      setSelectedOrder(null);
      setSelectedOrderItemId(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to receive purchase order items');
    }
  };

  const handleCreateSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialForm.subscription_code.trim() || !serialForm.title.trim()) {
      setError('Please provide subscription code and title');
      return;
    }
    try {
      await api.createSerialSubscription({
        ...serialForm,
        supplier_id: serialForm.supplier_id ? Number(serialForm.supplier_id) : undefined,
        annual_cost: Number(serialForm.annual_cost) || 0
      });
      setSuccessMsg(`Serial subscription '${serialForm.title}' created.`);
      setShowNewSerialModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create serial subscription');
    }
  };

  const handleOpenReceiveSerial = (serial: SerialSubscription) => {
    setSelectedSerial(serial);
    setShowReceiveSerialModal(true);
  };

  const handleExecuteReceiveSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSerial) return;
    try {
      await api.receiveSerialIssue(selectedSerial.id, serialIssueForm);
      setSuccessMsg(`Serial issue ${serialIssueForm.volume} ${serialIssueForm.issue_number} received.`);
      setShowReceiveSerialModal(false);
      setSelectedSerial(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to record serial issue');
    }
  };

  // Filtered lists
  const q = searchQuery.trim().toLowerCase();

  const filteredOrders = orders.filter(
    o =>
      !q ||
      o.po_number.toLowerCase().includes(q) ||
      o.supplier_name?.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      o.items.some(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.author?.toLowerCase().includes(q) ||
          i.isbn?.toLowerCase().includes(q)
      )
  );

  const filteredSuppliers = suppliers.filter(
    s =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.contact_person?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
  );

  const filteredSerials = serials.filter(
    s =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.subscription_code.toLowerCase().includes(q) ||
      (s.issn && s.issn.toLowerCase().includes(q)) ||
      s.shelf_location.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Purchase Orders</p>
            <p className="text-2xl font-bold text-white mt-1">{orders.length}</p>
            <p className="text-[11px] text-emerald-400 mt-0.5">
              {orders.filter(o => o.status === 'received').length} Completed
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Pending Orders</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {orders.filter(o => o.status === 'ordered' || o.status === 'partially_received').length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting physical delivery</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Registered Vendors</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{suppliers.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Active book & serial suppliers</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Periodicals / Serials</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{serials.length}</p>
            <p className="text-[11px] text-indigo-300 mt-0.5">Active subscriptions</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline hover:text-white">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="underline hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Navigation tabs & action toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setActiveTab('orders'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Purchase Orders ({orders.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('suppliers'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
              activeTab === 'suppliers'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Suppliers ({suppliers.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('serials'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2 ${
              activeTab === 'serials'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Serials & Periodicals ({serials.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
            />
          </div>

          {activeTab === 'orders' && (
            <button
              onClick={() => setShowNewOrderModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create PO</span>
            </button>
          )}

          {activeTab === 'suppliers' && (
            <button
              onClick={() => setShowNewSupplierModal(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          )}

          {activeTab === 'serials' && (
            <button
              onClick={() => setShowNewSerialModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subscription</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh Acquisitions Data"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading && orders.length === 0 && suppliers.length === 0 ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-400" />
          <span>Loading acquisitions records...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: PURCHASE ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                  {orders.length === 0
                    ? "No purchase orders registered yet. Click 'Create PO' to start acquisitions."
                    : "No purchase orders match your search. Try a different keyword."}
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-emerald-400 text-sm">{order.po_number}</span>
                        <span className="text-xs text-slate-300 font-semibold">• {order.supplier_name || `Supplier #${order.supplier_id}`}</span>
                        <span className="text-xs text-slate-400">Order Date: {order.order_date}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          order.status === 'received'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : order.status === 'partially_received'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : order.status === 'ordered'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                          Total: ${Number(order.total_cost || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* PO Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Title / Item</th>
                            <th className="py-2 px-3">Author</th>
                            <th className="py-2 px-3">ISBN</th>
                            <th className="py-2 px-3 text-center">Ordered</th>
                            <th className="py-2 px-3 text-center">Received</th>
                            <th className="py-2 px-3 text-right">Unit Price</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {order.items.map(item => {
                            const isFullyReceived = item.received_quantity >= item.quantity;
                            return (
                              <tr key={item.id} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 font-medium text-white">{item.title}</td>
                                <td className="py-2.5 px-3 text-slate-300">{item.author || '—'}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-400">{item.isbn || '—'}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-300">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`font-bold ${isFullyReceived ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {item.received_quantity}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                                  ${Number(item.unit_price || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {!isFullyReceived && (
                                    <button
                                      onClick={() => handleOpenReceive(order, item.id)}
                                      className="px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-colors inline-flex items-center space-x-1"
                                    >
                                      <PackageCheck className="w-3.5 h-3.5" />
                                      <span>Receive Copy</span>
                                    </button>
                                  )}
                                  {isFullyReceived && (
                                    <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Complete</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.length === 0 ? (
                <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                  {suppliers.length === 0
                    ? "No suppliers registered yet. Add a supplier to get started."
                    : "No suppliers match your search. Try a different keyword."}
                </div>
              ) : (
                filteredSuppliers.map(supplier => (
                  <div key={supplier.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{supplier.name}</h4>
                        <p className="text-xs text-slate-400">{supplier.contact_person || 'General Contact'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        supplier.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                      {supplier.email && (
                        <div className="flex items-center space-x-2 text-slate-400">
                          <span className="text-slate-500 font-mono text-[10px]">Email:</span>
                          <span className="text-slate-300">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center space-x-2 text-slate-400">
                          <span className="text-slate-500 font-mono text-[10px]">Phone:</span>
                          <span className="text-slate-300">{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center space-x-2 text-slate-400">
                          <span className="text-slate-500 font-mono text-[10px]">Address:</span>
                          <span className="text-slate-300 truncate">{supplier.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: SERIALS & PERIODICALS */}
          {activeTab === 'serials' && (
            <div className="space-y-4">
              {filteredSerials.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
                  {serials.length === 0
                    ? "No active serial subscriptions. Click 'Add Subscription' to track periodicals."
                    : "No serial subscriptions match your search. Try a different keyword."}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredSerials.map(serial => (
                    <div key={serial.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-indigo-400">{serial.subscription_code}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {serial.frequency}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-sm mt-1">{serial.title}</h4>
                          {serial.issn && (
                            <p className="text-[11px] text-slate-400 font-mono">ISSN: {serial.issn}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpenReceiveSerial(serial)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Record Issue</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Shelf Location</span>
                          <span className="font-medium text-emerald-400">{serial.shelf_location}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Active Term</span>
                          <span className="font-mono text-[11px] text-slate-300">{serial.start_date} → {serial.end_date}</span>
                        </div>
                      </div>

                      {serial.issues && serial.issues.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/60">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">Recent Received Issues</p>
                          <div className="flex flex-wrap gap-1.5">
                            {serial.issues.map(issue => (
                              <span key={issue.id} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono">
                                {issue.volume} {issue.issue_number} ({issue.status})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showNewSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <span>Register New Supplier / Vendor</span>
            </h3>
            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Oxford University Press Distribution"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={supplierForm.contact_person}
                  onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Sarah Jenkins"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                    placeholder="sales@oup.org"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                    placeholder="+1 800-555-0199"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Address / Notes</label>
                <textarea
                  rows={2}
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Shipping address and account number"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSupplierModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <span>Create Purchase Order (Procurement)</span>
            </h3>
            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Select Supplier *</label>
                  <select
                    value={orderForm.supplier_id}
                    onChange={e => setOrderForm({ ...orderForm, supplier_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={orderForm.expected_delivery_date}
                    onChange={e => setOrderForm({ ...orderForm, expected_delivery_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-semibold uppercase text-[10px]">Order Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddItemToOrder}
                    className="text-emerald-400 hover:text-emerald-300 font-medium text-xs flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {orderForm.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          required
                          placeholder="Book Title *"
                          value={item.title}
                          onChange={e => handleUpdateOrderItem(idx, 'title', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Author"
                          value={item.author}
                          onChange={e => handleUpdateOrderItem(idx, 'author', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-center">
                      <div className="col-span-2 sm:col-span-2">
                        <input
                          type="text"
                          placeholder="ISBN (Optional)"
                          value={item.isbn}
                          onChange={e => handleUpdateOrderItem(idx, 'isbn', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleUpdateOrderItem(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price $"
                          value={item.unit_price}
                          onChange={e => handleUpdateOrderItem(idx, 'unit_price', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                        />
                        {orderForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOrderItem(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={orderForm.notes}
                  onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  placeholder="Special cataloging or delivery requirements"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Generate Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE ORDER ITEM */}
      {showReceiveModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              <span>Receive Physical Item into Catalog</span>
            </h3>
            <p className="text-xs text-slate-300">
              Receiving for <span className="font-mono text-emerald-400">{selectedOrder.po_number}</span>.
              New physical copies will automatically receive sequential accession numbers and barcodes.
            </p>

            <form onSubmit={handleExecuteReceive} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={receiveForm.quantity_to_receive}
                  onChange={e => setReceiveForm({ ...receiveForm, quantity_to_receive: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Target Shelf Location</label>
                <input
                  type="text"
                  required
                  value={receiveForm.shelf_location}
                  onChange={e => setReceiveForm({ ...receiveForm, shelf_location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="create_catalog"
                  checked={receiveForm.create_catalog_records}
                  onChange={e => setReceiveForm({ ...receiveForm, create_catalog_records: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="create_catalog" className="text-slate-300">
                  Auto-create bibliographic book and item copy records
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Confirm Receipt & Accession
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SERIAL */}
      {showNewSerialModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>New Periodical / Serial Subscription</span>
            </h3>
            <form onSubmit={handleCreateSerial} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SUB-ACM-01"
                    value={serialForm.subscription_code}
                    onChange={e => setSerialForm({ ...serialForm, subscription_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">ISSN</label>
                  <input
                    type="text"
                    placeholder="0001-0782"
                    value={serialForm.issn}
                    onChange={e => setSerialForm({ ...serialForm, issn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Publication Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Communications of the ACM"
                  value={serialForm.title}
                  onChange={e => setSerialForm({ ...serialForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Frequency</label>
                  <select
                    value={serialForm.frequency}
                    onChange={e => setSerialForm({ ...serialForm, frequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Shelf Bay</label>
                  <input
                    type="text"
                    value={serialForm.shelf_location}
                    onChange={e => setSerialForm({ ...serialForm, shelf_location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={serialForm.start_date}
                    onChange={e => setSerialForm({ ...serialForm, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={serialForm.end_date}
                    onChange={e => setSerialForm({ ...serialForm, end_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSerialModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE SERIAL ISSUE */}
      {showReceiveSerialModal && selectedSerial && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <span>Record Incoming Serial Issue</span>
            </h3>
            <p className="text-xs text-slate-300">
              For subscription: <span className="text-white font-semibold">{selectedSerial.title}</span> ({selectedSerial.subscription_code})
            </p>
            <form onSubmit={handleExecuteReceiveSerial} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Volume</label>
                  <input
                    type="text"
                    required
                    value={serialIssueForm.volume}
                    onChange={e => setSerialIssueForm({ ...serialIssueForm, volume: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Issue Number</label>
                  <input
                    type="text"
                    required
                    value={serialIssueForm.issue_number}
                    onChange={e => setSerialIssueForm({ ...serialIssueForm, issue_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Publication Date</label>
                <input
                  type="date"
                  required
                  value={serialIssueForm.publication_date}
                  onChange={e => setSerialIssueForm({ ...serialIssueForm, publication_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveSerialModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold"
                >
                  Save Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
