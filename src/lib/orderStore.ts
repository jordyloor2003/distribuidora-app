// Almacén en memoria para pedidos mayoristas de DistriLogix

export interface OrderItem {
  id: string;
  name: string;
  category: string;
  unit: string; // ej: "Caja x 12", "Fardo x 24"
  unitPrice: number;
  quantity: number;
}

export interface WholesaleOrder {
  orderId: string;
  companyName: string;
  ruc: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED';
  createdAt: string;
  emailNotificationId?: string;
  smsNotificationId?: string;
  dispatchDetails?: {
    truckNumber: string;
    driverName: string;
    dispatchedAt: string;
    etaHours: number;
  };
}

export const INITIAL_PRODUCTS: OrderItem[] = [
  {
    id: 'prod-1',
    name: 'Aceite Vegetal La Favorita 1L',
    category: 'Alimentos',
    unit: 'Caja x 12 botellas',
    unitPrice: 28.5,
    quantity: 0,
  },
  {
    id: 'prod-2',
    name: 'Arroz Súper Extra Flor 50kg',
    category: 'Alimentos',
    unit: 'Saco 50 kg',
    unitPrice: 46.0,
    quantity: 0,
  },
  {
    id: 'prod-3',
    name: 'Azúcar Blanca Especial San Carlos',
    category: 'Alimentos',
    unit: 'Bulto 50 kg',
    unitPrice: 42.0,
    quantity: 0,
  },
  {
    id: 'prod-4',
    name: 'Coca-Cola Sabor Original 3 Litros',
    category: 'Bebidas',
    unit: 'Pack x 6 botellas',
    unitPrice: 16.8,
    quantity: 0,
  },
  {
    id: 'prod-5',
    name: 'Agua Mineral Güitig con Gas 500ml',
    category: 'Bebidas',
    unit: 'Caja x 24 unidades',
    unitPrice: 14.5,
    quantity: 0,
  },
  {
    id: 'prod-6',
    name: 'Detergente Industrial Deja Lavanda 5kg',
    category: 'Limpieza',
    unit: 'Fardo x 4 fundas',
    unitPrice: 38.0,
    quantity: 0,
  },
  {
    id: 'prod-7',
    name: 'Jabón Palmolive Naturals Aloe 120g',
    category: 'Cuidado Personal',
    unit: 'Caja Display x 36 unidades',
    unitPrice: 24.0,
    quantity: 0,
  },
];

const globalForOrders = globalThis as unknown as {
  ordersList?: WholesaleOrder[];
};

export const ordersList: WholesaleOrder[] = globalForOrders.ordersList || [];
if (process.env.NODE_ENV !== 'production') {
  globalForOrders.ordersList = ordersList;
}

export function saveOrder(order: WholesaleOrder) {
  ordersList.unshift(order);
}

export function findOrder(orderId: string): WholesaleOrder | undefined {
  return ordersList.find((o) => o.orderId === orderId);
}

export function updateOrder(orderId: string, updates: Partial<WholesaleOrder>): WholesaleOrder | null {
  const order = findOrder(orderId);
  if (!order) return null;
  Object.assign(order, updates);
  return order;
}
