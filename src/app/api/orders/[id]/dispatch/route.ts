import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotification } from '@/lib/notifyClient';
import { findOrder, updateOrder } from '@/lib/orderStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json();
    const { truckNumber, driverName, etaHours, phone: fallbackPhone } = body;

    const order = findOrder(orderId);
    const targetPhone = order?.phone || fallbackPhone;

    if (!targetPhone) {
      return NextResponse.json(
        { error: 'No se encontró el teléfono del cliente para despachar el SMS.' },
        { status: 400 }
      );
    }

    const truck = truckNumber || 'CAM-08';
    const driver = driverName || 'Carlos Valdivieso';
    const eta = etaHours || 2;

    const idempotencyKey = `dispatch-sms-${orderId}`;

    const smsText = `DistriLogix: Pedido #${orderId} EN RUTA en camion ${truck}. Conductor: ${driver}. Llegada estimada en aprox ${eta} horas a ${order?.city || 'su sucursal'}.`;

    // Despacho de SMS mediante Notify API en AWS EC2 con Template y Llave de Idempotencia
    const notifyResult = await dispatchNotification({
      channel: 'Sms',
      recipient: targetPhone.trim(),
      templateCode: 'DISPATCH_TRACKING',
      templateVariables: {
        orderId: String(orderId),
        camion: String(truck),
        chofer: String(driver),
        ciudad: String(order?.city || 'su sucursal'),
        eta: String(eta),
      },
      body: smsText,
      idempotencyKey,
      priority: 'High',
      metadata: {
        orderId,
        truck,
        driver,
        flow: 'logistics_dispatch',
      },
    });

    if (order) {
      updateOrder(orderId, {
        status: 'DISPATCHED',
        smsNotificationId: notifyResult.id,
        dispatchDetails: {
          truckNumber: truck,
          driverName: driver,
          dispatchedAt: new Date().toISOString(),
          etaHours: eta,
        },
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      notification: notifyResult,
      isDuplicateReplay: notifyResult.isIdempotentReplay,
      idempotencyKey,
      message: notifyResult.isIdempotentReplay
        ? '⚠️ Alerta de despacho SMS DUPLICADA por Notify API. Se evitó doble costo de envío de mensaje celular.'
        : '🚚 Pedido despachado. Mensaje SMS de logística enviado al transportista y cliente.',
    });
  } catch (error: any) {
    console.error('Error despachando pedido mayorista:', error);
    return NextResponse.json(
      {
        error: 'Error despachando SMS en Notify API',
        details: error?.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
