'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  ShoppingBag,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Clock,
  Layers,
  Repeat,
  MapPin,
  FileText,
  Boxes,
  Plus,
  Minus,
  Search
} from 'lucide-react';
import { INITIAL_PRODUCTS, OrderItem, WholesaleOrder } from '@/lib/orderStore';

interface NotificationDetail {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  subject?: string;
  idempotencyKey?: string;
  createdAt: string;
  sentAt?: string;
  retryCount?: number;
  attempts?: Array<{
    attemptNumber: number;
    provider: string;
    status: string;
    httpStatusCode: number;
    latencyMs: number;
    attemptedAt: string;
  }>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'logistics' | 'audit' | 'architecture'>('catalog');

  // Catálogo de Productos y Carrito
  const [products, setProducts] = useState<OrderItem[]>(INITIAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Datos de la Empresa Compradora
  const [buyerInfo, setBuyerInfo] = useState({
    companyName: 'Supermercados del Norte S.A.',
    ruc: '1792345678001',
    contactName: 'Ing. Gabriela Paredes',
    email: 'compras@superdelnorte.com',
    phone: '+593987654321',
    city: 'Quito',
    address: 'Av. 10 de Agosto N34-12 y Mariana de Jesús',
  });

  // Estado de Creación de Orden
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [orderEmailDetail, setOrderEmailDetail] = useState<NotificationDetail | null>(null);
  const [idempotencyAlert, setIdempotencyAlert] = useState<string | null>(null);
  const [isTestingOrderIdemp, setIsTestingOrderIdemp] = useState<boolean>(false);

  // Estado de Despacho Logístico (Tab 2)
  const [ordersListState, setOrdersListState] = useState<WholesaleOrder[]>([]);
  const [dispatchFormData, setDispatchFormData] = useState<Record<string, { truck: string; driver: string; eta: number }>>({});
  const [isDispatchingMap, setIsDispatchingMap] = useState<Record<string, boolean>>({});
  const [dispatchSmsDetails, setDispatchSmsDetails] = useState<Record<string, NotificationDetail>>({});
  const [dispatchIdempAlert, setDispatchIdempAlert] = useState<Record<string, string>>({});

  // Auditoría en Vivo (Tab 3)
  const [auditNotifications, setAuditNotifications] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<NotificationDetail | null>(null);

  // Auxiliares
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Cálculos de Carrito
  const cartItems = products.filter((p) => p.quantity > 0);
  const subtotal = cartItems.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0);
  const tax = subtotal * 0.15; // IVA 15%
  const total = subtotal + tax;

  const categories = ['Todos', 'Alimentos', 'Bebidas', 'Limpieza', 'Cuidado Personal'];

  // Cargar órdenes y auditoría cuando sea necesario
  useEffect(() => {
    if (activeTab === 'logistics') {
      fetchOrders();
    } else if (activeTab === 'audit') {
      fetchAuditList();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrdersListState(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchAuditList = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/notifications?pageSize=15');
      if (res.ok) {
        const data = await res.json();
        setAuditNotifications(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching audit:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newQty = Math.max(0, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      })
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert('Agregue al menos un producto al carrito mayorista.');
      return;
    }

    setIsPlacingOrder(true);
    setIdempotencyAlert(null);

    const generatedOrderId = `DIST-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: generatedOrderId,
          ...buyerInfo,
          items: cartItems,
          subtotal,
          tax,
          total,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error registrando orden');
      }

      setConfirmedOrder({
        orderId: generatedOrderId,
        ...buyerInfo,
        items: [...cartItems],
        subtotal,
        tax,
        total,
        notification: data.notification,
        idempotencyKey: data.idempotencyKey,
      });

      // Poll email notification
      if (data.notification?.id) {
        pollEmailDetail(data.notification.id);
      }

      // Resetear cantidades
      setProducts((prev) => prev.map((p) => ({ ...p, quantity: 0 })));
    } catch (error: any) {
      alert(`Error al emitir orden: ${error.message}`);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const pollEmailDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`);
      if (res.ok) {
        const detail = await res.json();
        setOrderEmailDetail(detail);
        if (detail.status === 'PENDING' || detail.status === 'PROCESSING' || detail.status === 'Pending') {
          setTimeout(() => pollEmailDetail(id), 1500);
        }
      }
    } catch (e) {
      console.error('Error polling email detail:', e);
    }
  };

  // Demostración de Idempotencia en Orden (Email)
  const handleTestOrderIdempotency = async () => {
    if (!confirmedOrder) return;
    setIsTestingOrderIdemp(true);
    setIdempotencyAlert(null);

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: confirmedOrder.orderId,
          ...buyerInfo,
          items: confirmedOrder.items,
          subtotal: confirmedOrder.subtotal,
          tax: confirmedOrder.tax,
          total: confirmedOrder.total,
          forceDuplicateDemo: true,
        }),
      });

      const data = await res.json();
      if (data.isDuplicateReplay) {
        setIdempotencyAlert(
          `🛡️ IDEMPOTENCIA DETECTADA: Notify API interceptó la solicitud con clave '${data.idempotencyKey}'. Devolvió 200 OK con el comprobante de compra original sin generar dobles facturas ni duplicar emails.`
        );
      } else {
        setIdempotencyAlert(`Respuesta: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Error en prueba de idempotencia: ${e.message}`);
    } finally {
      setIsTestingOrderIdemp(false);
    }
  };

  // Despacho Logístico (SMS)
  const handleDispatchOrder = async (orderId: string, phone: string) => {
    setIsDispatchingMap((prev) => ({ ...prev, [orderId]: true }));
    const form = dispatchFormData[orderId] || {
      truck: 'CAM-08 Isuzu 10T',
      driver: 'Carlos Valdivieso',
      eta: 2,
    };

    try {
      const res = await fetch(`/api/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckNumber: form.truck,
          driverName: form.driver,
          etaHours: form.eta,
          phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error despachando orden');
      }

      if (data.notification?.id) {
        pollSmsDetail(orderId, data.notification.id);
      }

      fetchOrders();
    } catch (e: any) {
      alert(`Error despachando: ${e.message}`);
    } finally {
      setIsDispatchingMap((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const pollSmsDetail = async (orderId: string, notifId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}`);
      if (res.ok) {
        const detail = await res.json();
        setDispatchSmsDetails((prev) => ({ ...prev, [orderId]: detail }));
        if (detail.status === 'PENDING' || detail.status === 'PROCESSING' || detail.status === 'Pending') {
          setTimeout(() => pollSmsDetail(orderId, notifId), 1500);
        }
      }
    } catch (e) {
      console.error('Error polling SMS detail:', e);
    }
  };

  // Demostración de Idempotencia en Despacho SMS
  const handleTestDispatchIdempotency = async (orderId: string, phone: string) => {
    try {
      const form = dispatchFormData[orderId] || {
        truck: 'CAM-08 Isuzu 10T',
        driver: 'Carlos Valdivieso',
        eta: 2,
      };

      const res = await fetch(`/api/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckNumber: form.truck,
          driverName: form.driver,
          etaHours: form.eta,
          phone,
        }),
      });

      const data = await res.json();
      if (data.isDuplicateReplay) {
        setDispatchIdempAlert((prev) => ({
          ...prev,
          [orderId]: `🛡️ SMS DUPLICADO EVITADO: Notify API detectó clave '${data.idempotencyKey}'. Previene cargos dobles en la red celular del operador.`,
        }));
      }
    } catch (e: any) {
      alert(`Error probando idempotencia SMS: ${e.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 to-blue-200 bg-clip-text text-transparent">
                  DistriLogix B2B
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                  Mayorista & Logística
                </span>
              </div>
              <p className="text-xs text-slate-400">Distribución de Consumo Masivo & Envíos</p>
            </div>
          </div>

          {/* Engine Status Badge */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-full shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-mono">Notify API: 52.15.152.202</span>
              <span className="text-emerald-400 font-semibold uppercase text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                AWS EC2
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Nav / Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 py-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Catálogo Mayorista ({cartItems.length} en carrito)</span>
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'logistics'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>Centro de Despacho (Salida de Bodega - SMS)</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Auditoría en Tiempo Real (Feed Notify API)</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Arquitectura Multicanal</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Tab 1: Catálogo Mayorista & Checkout */}
        {activeTab === 'catalog' && (
          <div className="space-y-8">
            {confirmedOrder ? (
              /* Vista de Confirmación de Orden */
              <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
                <div className="bg-gradient-to-r from-sky-950/60 to-slate-900 border border-sky-800/80 rounded-2xl p-6 sm:p-8 text-center space-y-3 shadow-xl">
                  <div className="mx-auto h-16 w-16 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    ¡Nota de Pedido Mayorista Registrada!
                  </h2>
                  <p className="text-sm text-slate-300 max-w-lg mx-auto">
                    La orden ha sido recepcionada por el centro de distribución. El comprobante oficial fue despachado vía <strong>Email</strong> con Notify API.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-sky-400" />
                      <span className="font-bold text-slate-200">Resumen de Factura Proforma</span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold uppercase">
                      En Preparación de Bodega
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">N° de Pedido</span>
                      <span className="font-mono font-bold text-slate-200 text-sm">{confirmedOrder.orderId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total a Pagar</span>
                      <span className="font-mono font-black text-sky-400 text-sm">
                        ${confirmedOrder.total.toFixed(2)} USD
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Empresa</span>
                      <span className="font-semibold text-slate-200 text-sm truncate block">{confirmedOrder.companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Destino</span>
                      <span className="text-slate-200 text-sm">{confirmedOrder.city}</span>
                    </div>
                  </div>

                  {/* Tabla de ítems pedidos */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3 text-center">Cant. Bultos</th>
                          <th className="py-2.5 px-3 text-right">P. Unitario</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                        {confirmedOrder.items.map((it: OrderItem) => (
                          <tr key={it.id}>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                              {it.name} <span className="text-slate-500 text-[11px]">({it.unit})</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-right">${it.unitPrice.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right text-sky-400">
                              ${(it.quantity * it.unitPrice).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Panel de Seguimiento Email con Notify API */}
                  <div className="border border-sky-500/20 bg-sky-950/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-sky-400" />
                        <span className="text-xs font-bold text-sky-300">
                          Notificación por Email (Notify API en AWS)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            orderEmailDetail?.status === 'DELIVERED' ||
                            orderEmailDetail?.status === 'SENT' ||
                            orderEmailDetail?.status === 'Sent'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {orderEmailDetail?.status || confirmedOrder.notification?.status}
                        </span>
                        <button
                          onClick={() => pollEmailDetail(confirmedOrder.notification.id)}
                          className="text-slate-400 hover:text-slate-200 p-1"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 block">ID Notificación:</span>
                        <span className="text-slate-300 truncate block">
                          {confirmedOrder.notification?.id}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Llave de Idempotencia:</span>
                        <span className="text-sky-300 flex items-center space-x-1">
                          <span>{confirmedOrder.idempotencyKey}</span>
                          <button
                            onClick={() => copyToClipboard(confirmedOrder.idempotencyKey)}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </span>
                      </div>
                    </div>

                    {orderEmailDetail?.attempts && orderEmailDetail.attempts.length > 0 && (
                      <div className="border-t border-slate-800/80 pt-2 text-[11px] text-slate-400 flex justify-between">
                        <span>Proveedor: <strong className="text-slate-200">{orderEmailDetail.attempts[0].provider}</strong></span>
                        <span>Latencia: <strong className="text-emerald-400 font-mono">{orderEmailDetail.attempts[0].latencyMs} ms</strong></span>
                      </div>
                    )}
                  </div>

                  {idempotencyAlert && (
                    <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-xs text-amber-200 flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>{idempotencyAlert}</div>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isTestingOrderIdemp}
                      onClick={handleTestOrderIdempotency}
                      className="flex-1 py-3 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-center space-x-2 transition"
                    >
                      {isTestingOrderIdemp ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Verificando Idempotencia en AWS...</span>
                        </>
                      ) : (
                        <>
                          <Repeat className="h-4 w-4" />
                          <span>Simular Doble Clic en Orden (Probar Idempotencia)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('logistics')}
                      className="py-3 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center justify-center space-x-2"
                    >
                      <Truck className="h-4 w-4" />
                      <span>Ir a Despacho Logístico (Enviar SMS)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmedOrder(null)}
                      className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      Nuevo Pedido
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Catálogo y Carrito */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Columna Izquierda: Filtros y Catálogo de Productos */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Buscador y Categorías */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex space-x-1.5 overflow-x-auto pb-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-xs px-3 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                            selectedCategory === cat
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid de Productos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 font-semibold uppercase tracking-wider">
                              {p.category}
                            </span>
                            <span className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>Stock B2B Disponible</span>
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-slate-100">{p.name}</h3>
                          <p className="text-xs text-slate-400 font-medium">Presentación: {p.unit}</p>
                        </div>

                        <div className="border-t border-slate-800/80 pt-4 mt-4 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Precio Mayorista</span>
                            <span className="text-xl font-black text-sky-400 font-mono">
                              ${p.unitPrice.toFixed(2)}
                            </span>
                          </div>

                          {/* Control de Cantidad */}
                          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(p.id, -1)}
                              disabled={p.quantity === 0}
                              className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 transition"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-sm text-slate-200">
                              {p.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(p.id, 1)}
                              className="h-7 w-7 rounded-lg bg-sky-600 hover:bg-sky-500 flex items-center justify-center text-white transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Columna Derecha: Formulario de Checkout y Carrito */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 sticky top-24">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <ShoppingBag className="h-5 w-5 text-sky-400" />
                      <span>Resumen de Pedido Mayorista</span>
                    </h2>

                    {/* Resumen del Carrito */}
                    <div className="space-y-3">
                      {cartItems.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">
                          No has seleccionado bultos aún. Usa los controles (+) del catálogo.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                          {cartItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-center text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80"
                            >
                              <div className="truncate mr-2">
                                <span className="font-semibold text-slate-200 block truncate">{item.name}</span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {item.quantity} x ${item.unitPrice.toFixed(2)}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-sky-400">
                                ${(item.quantity * item.unitPrice).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-400">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA (15%):</span>
                          <span className="font-mono text-slate-200">${tax.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-slate-800/80 pt-2 flex justify-between items-baseline font-bold text-base text-slate-100">
                          <span>Total Orden:</span>
                          <span className="font-mono text-xl text-sky-400 font-black">
                            ${total.toFixed(2)} USD
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Formulario de Facturación B2B */}
                    <form onSubmit={handlePlaceOrder} className="space-y-3 border-t border-slate-800 pt-4">
                      <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                        Datos del Cliente Mayorista
                      </span>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Razón Social</label>
                        <input
                          type="text"
                          required
                          value={buyerInfo.companyName}
                          onChange={(e) => setBuyerInfo({ ...buyerInfo, companyName: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">RUC Fiscal</label>
                          <input
                            type="text"
                            required
                            value={buyerInfo.ruc}
                            onChange={(e) => setBuyerInfo({ ...buyerInfo, ruc: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Ciudad Destino</label>
                          <input
                            type="text"
                            required
                            value={buyerInfo.city}
                            onChange={(e) => setBuyerInfo({ ...buyerInfo, city: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Dirección de Entrega</label>
                        <input
                          type="text"
                          required
                          value={buyerInfo.address}
                          onChange={(e) => setBuyerInfo({ ...buyerInfo, address: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                          <span>Correo (Factura / Nota de Pedido)</span>
                          <Mail className="h-3 w-3 text-slate-500" />
                        </label>
                        <input
                          type="email"
                          required
                          value={buyerInfo.email}
                          onChange={(e) => setBuyerInfo({ ...buyerInfo, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                          <span>Teléfono Móvil (Avisos de Despacho SMS)</span>
                          <Smartphone className="h-3 w-3 text-slate-500" />
                        </label>
                        <input
                          type="tel"
                          required
                          value={buyerInfo.phone}
                          onChange={(e) => setBuyerInfo({ ...buyerInfo, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPlacingOrder || cartItems.length === 0}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-sky-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-4"
                      >
                        {isPlacingOrder ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Emitiendo Orden & Email Notify API...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirmar Pedido Mayorista</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Centro de Despacho Logístico (SMS) */}
        {activeTab === 'logistics' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-sky-400" />
                  <span>Control de Despachos & Notificaciones SMS en Ruta</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Asigna transportistas a los pedidos mayoristas y emite alertas celulares automáticas al cliente mediante <strong>Notify API</strong>.
                </p>
              </div>
              <button
                onClick={fetchOrders}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center space-x-2 border border-slate-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Actualizar Órdenes</span>
              </button>
            </div>

            {ordersListState.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <Package className="h-10 w-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-300">No hay órdenes registradas todavía</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Ve a la pestaña <strong>Catálogo Mayorista</strong>, selecciona productos y confirma una compra para verla reflejada aquí y despacharla con SMS.
                </p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
                >
                  Ir al Catálogo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {ordersListState.map((order) => {
                  const smsDetail = dispatchSmsDetails[order.orderId];
                  const idempAlert = dispatchIdempAlert[order.orderId];
                  const currentForm = dispatchFormData[order.orderId] || {
                    truck: 'CAM-08 Isuzu 10T',
                    driver: 'Carlos Valdivieso',
                    eta: 2,
                  };

                  return (
                    <div
                      key={order.orderId}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
                    >
                      {/* Cabecera de Orden */}
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-sky-400 text-base">
                              {order.orderId}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                order.status === 'DISPATCHED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {order.status === 'DISPATCHED' ? 'En Ruta' : 'En Bodega'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-300 font-medium block mt-1">
                            {order.companyName} (RUC: {order.ruc})
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-200 text-sm">
                          ${order.total.toFixed(2)} USD
                        </span>
                      </div>

                      {/* Datos de Entrega */}
                      <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <MapPin className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                          <span>{order.city} - {order.address}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Smartphone className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="font-mono">{order.phone}</span>
                        </div>
                      </div>

                      {/* Asignación de Despacho (Si aún no está en ruta) */}
                      {order.status !== 'DISPATCHED' ? (
                        <div className="space-y-3 pt-1">
                          <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                            Asignación de Transporte de Bodega:
                          </span>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Camión de Carga</label>
                              <select
                                value={currentForm.truck}
                                onChange={(e) =>
                                  setDispatchFormData({
                                    ...dispatchFormData,
                                    [order.orderId]: { ...currentForm, truck: e.target.value },
                                  })
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                              >
                                <option value="CAM-08 Isuzu 10T">CAM-08 Isuzu 10T</option>
                                <option value="CAM-03 Hino 5T">CAM-03 Hino 5T</option>
                                <option value="FUR-12 Van Express">FUR-12 Van Express</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Chofer Designado</label>
                              <input
                                type="text"
                                value={currentForm.driver}
                                onChange={(e) =>
                                  setDispatchFormData({
                                    ...dispatchFormData,
                                    [order.orderId]: { ...currentForm, driver: e.target.value },
                                  })
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isDispatchingMap[order.orderId]}
                            onClick={() => handleDispatchOrder(order.orderId, order.phone)}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                          >
                            {isDispatchingMap[order.orderId] ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span>Despachando & Enviando SMS Notify API...</span>
                              </>
                            ) : (
                              <>
                                <Truck className="h-4 w-4" />
                                <span>Despachar a Ruta (Enviar SMS al Cliente)</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        /* Estado Despachado & Panel de Rastreo SMS */
                        <div className="space-y-3 pt-1">
                          <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3 text-xs space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-emerald-400 flex items-center space-x-1.5">
                                <Truck className="h-4 w-4" />
                                <span>Mercadería en Transporte</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                {order.dispatchDetails?.truckNumber}
                              </span>
                            </div>
                            <div className="text-slate-300 text-[11px]">
                              Chofer: <strong>{order.dispatchDetails?.driverName}</strong> | Tiempo Estimado: <strong>{order.dispatchDetails?.etaHours} horas</strong>
                            </div>
                          </div>

                          {/* Badge de Rastreo SMS */}
                          <div className="bg-sky-950/20 border border-sky-500/20 rounded-xl p-3 text-xs space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sky-300 flex items-center space-x-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-sky-400" />
                                <span>SMS Enviado vía Notify API:</span>
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  smsDetail?.status === 'DELIVERED' ||
                                  smsDetail?.status === 'SENT' ||
                                  smsDetail?.status === 'Sent'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {smsDetail?.status || 'SENT'}
                              </span>
                            </div>

                            {smsDetail?.attempts && smsDetail.attempts.length > 0 && (
                              <div className="text-[11px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
                                <span>Operador: {smsDetail.attempts[0].provider}</span>
                                <span className="text-emerald-400">{smsDetail.attempts[0].latencyMs} ms</span>
                              </div>
                            )}
                          </div>

                          {/* Alerta de idempotencia */}
                          {idempAlert && (
                            <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 text-xs text-amber-200">
                              {idempAlert}
                            </div>
                          )}

                          {/* Botón de Demostración de Idempotencia SMS */}
                          <button
                            type="button"
                            onClick={() => handleTestDispatchIdempotency(order.orderId, order.phone)}
                            className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center justify-center space-x-2 transition"
                          >
                            <Repeat className="h-3.5 w-3.5" />
                            <span>Simular Reenvío Accidental de SMS (Idempotencia)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Auditoría en Tiempo Real (Feed Notify API) */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-sky-400" />
                  <span>Auditoría en Tiempo Real de Notify API</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Notificaciones transaccionales multicanal (Email y SMS) registradas en MongoDB Atlas desde AWS EC2.
                </p>
              </div>
              <button
                onClick={fetchAuditList}
                disabled={isLoadingAudit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center space-x-2 border border-slate-700 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                <span>Actualizar Feed</span>
              </button>
            </div>

            {/* Tabla de Notificaciones */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Canal</th>
                      <th className="py-3.5 px-4">Destinatario</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4">Llave Idempotencia</th>
                      <th className="py-3.5 px-4">Intentos</th>
                      <th className="py-3.5 px-4">Fecha Creación</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {auditNotifications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          {isLoadingAudit
                            ? 'Cargando registros desde AWS Notify API...'
                            : 'No hay notificaciones registradas todavía. ¡Emite un pedido o despacho!'}
                        </td>
                      </tr>
                    ) : (
                      auditNotifications.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.channel === 'Sms' || item.channel === 'SMS'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              }`}
                            >
                              {item.channel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-200">
                            {item.recipient}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'DELIVERED' || item.status === 'SENT' || item.status === 'Sent'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : item.status === 'FAILED' || item.status === 'Failed'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-[150px]">
                            {item.idempotencyKey || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono">{item.retryCount ?? 1}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedAuditItem(item)}
                              className="text-sky-400 hover:text-sky-300 font-medium"
                            >
                              Detalles
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal de Detalle */}
            {selectedAuditItem && (
              <div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-sky-400" />
                      <span>Detalle de Notificación</span>
                    </h3>
                    <button
                      onClick={() => setSelectedAuditItem(null)}
                      className="text-slate-400 hover:text-slate-200 text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div><span className="text-slate-500">ID:</span> <span className="text-slate-200">{selectedAuditItem.id}</span></div>
                    <div><span className="text-slate-500">Canal:</span> <span className="text-slate-200">{selectedAuditItem.channel}</span></div>
                    <div><span className="text-slate-500">Destinatario:</span> <span className="text-slate-200">{selectedAuditItem.recipient}</span></div>
                    <div><span className="text-slate-500">Asunto:</span> <span className="text-slate-200">{selectedAuditItem.subject || '—'}</span></div>
                    <div><span className="text-slate-500">Llave Idempotencia:</span> <span className="text-slate-200">{selectedAuditItem.idempotencyKey || '—'}</span></div>
                    <div><span className="text-slate-500">Creado:</span> <span className="text-slate-200">{selectedAuditItem.createdAt}</span></div>
                    <div><span className="text-slate-500">Entregado:</span> <span className="text-slate-200">{selectedAuditItem.sentAt || 'Pendiente'}</span></div>
                  </div>

                  {selectedAuditItem.attempts && selectedAuditItem.attempts.length > 0 && (
                    <div className="border-t border-slate-800 pt-3">
                      <h4 className="text-xs font-semibold text-slate-300 mb-2">Intentos de Entrega:</h4>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {selectedAuditItem.attempts.map((att, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950 p-2 rounded-lg text-[11px] font-mono flex justify-between"
                          >
                            <span>#{att.attemptNumber} ({att.provider})</span>
                            <span className="text-emerald-400">{att.status} ({att.latencyMs}ms)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedAuditItem(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Arquitectura Multicanal */}
        {activeTab === 'architecture' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center space-x-2">
                <Layers className="h-6 w-6 text-sky-400" />
                <span>Arquitectura Multicanal de Distribución</span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Estrategia de comunicación B2B combinando canales transaccionales pesados (Email) y operacionales urgentes (SMS).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Mail className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">Canal EMAIL: Comprobantes & Packing List</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ideal para información legal, contratos y desglose detallado de facturación proforma con tablas de productos, montos con IVA y direcciones fiscales. Idempotente bajo la clave <code className="text-sky-300">order-po-{'{orderId}'}</code>.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">Canal SMS: Alertas Operativas de Despacho</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Alta prioridad y lectura inmediata (&lt; 3 minutos). Notifica al transportista y al jefe de bodega del comprador cuando el camión sale del muelle con nombre de chofer y tiempo estimado de llegada.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Flujo de Eventos Logísticos en la Plataforma
              </h3>
              <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-300 space-y-2 border border-slate-800 overflow-x-auto">
                <p className="text-sky-400">1. [Comprador] Agrega 5 bultos de mercadería y emite orden de compra</p>
                <p className="text-slate-400">2. [Next.js API] Solicita Token JWT OAuth2 (app_bancamovil_prod)</p>
                <p className="text-sky-300">3. [Notify API @ AWS] Emite Email con desglose tributario (Status: 202 Accepted)</p>
                <p className="text-emerald-400">4. [Worker] Despacha el correo de confirmación de pedido al comprador</p>
                <p className="text-amber-400">5. [Bodeguero] Asigna camión CAM-08 y pulsa &quot;Despachar a Ruta&quot;</p>
                <p className="text-purple-400">6. [Next.js API] Emite SMS transaccional a Notify API con Idempotency-Key</p>
                <p className="text-emerald-400">7. [Worker] Entrega el SMS al operador celular en 20ms</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <Boxes className="h-4 w-4 text-sky-500" />
            <span>DistriLogix B2B &copy; 2026 - Distribuidora Mayorista & Logística</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Notify API v1.0.0</span>
            <span>•</span>
            <span>AWS EC2 Elastic IP: 52.15.152.202</span>
            <span>•</span>
            <span>Next.js 14 + Tailwind CSS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
