import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotification } from '@/lib/notifyClient';
import { saveOrder, WholesaleOrder } from '@/lib/orderStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      companyName,
      ruc,
      contactName,
      email,
      phone,
      address,
      city,
      items,
      subtotal,
      tax,
      total,
      forceDuplicateDemo,
    } = body;

    if (!orderId || !email || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Datos de orden incompletos o carrito vacío.' },
        { status: 400 }
      );
    }

    const idempotencyKey = `order-po-${orderId}`;

    const itemsRowsHtml = items
      .map(
        (it: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; text-align: left;"><strong>${it.name}</strong><br/><span style="color: #64748b; font-size: 11px;">${it.unit}</span></td>
          <td style="padding: 8px 12px; text-align: center;">${it.quantity}</td>
          <td style="padding: 8px 12px; text-align: right;">$${Number(it.unitPrice).toFixed(2)}</td>
          <td style="padding: 8px 12px; text-align: right;">$${(it.quantity * it.unitPrice).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const emailHtmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #ffffff;">
        <div style="border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0369a1; margin: 0;">DistriLogix S.A. - Mayorista & Logística</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Nota de Pedido Oficial & Confirmación de Compra</p>
        </div>

        <p>Estimado/a <strong>${contactName || 'Representante'}</strong> (${companyName}),</p>
        <p>Confirmamos la recepción de su pedido mayorista. Nuestro equipo de bodega iniciará el picking y empaque de los bultos para posterior despacho.</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 3px 0;"><strong>N° de Pedido:</strong> ${orderId}</p>
          <p style="margin: 3px 0;"><strong>Razón Social:</strong> ${companyName} (RUC: ${ruc})</p>
          <p style="margin: 3px 0;"><strong>Ciudad & Destino:</strong> ${city} - ${address}</p>
          <p style="margin: 3px 0;"><strong>Teléfono de Contacto:</strong> ${phone}</p>
          <p style="margin: 3px 0;"><strong>Fecha de Emisión:</strong> ${new Date().toLocaleString('es-EC')}</p>
        </div>

        <h3 style="color: #0f172a; margin-top: 20px; font-size: 14px;">Detalle de Mercadería Solicitada:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #0284c7; color: #ffffff;">
              <th style="padding: 8px 12px; text-align: left;">Producto / Empaque</th>
              <th style="padding: 8px 12px; text-align: center;">Cantidad</th>
              <th style="padding: 8px 12px; text-align: right;">P. Mayorista</th>
              <th style="padding: 8px 12px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 6px 12px; text-align: right; font-weight: bold;">Subtotal:</td>
              <td style="padding: 6px 12px; text-align: right;">$${Number(subtotal).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 6px 12px; text-align: right; font-weight: bold;">IVA (15%):</td>
              <td style="padding: 6px 12px; text-align: right;">$${Number(tax).toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f1f5f9; font-size: 15px;">
              <td colspan="3" style="padding: 10px 12px; text-align: right; font-weight: bold; color: #0284c7;">TOTAL ORDEN:</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #0284c7;">$${Number(total).toFixed(2)} USD</td>
            </tr>
          </tfoot>
        </table>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px; font-size: 12px; color: #1e40af; margin-top: 15px;">
          🔔 <strong>Notificación de Despacho:</strong> Recibirá un mensaje SMS automático en su teléfono celular cuando el camión de reparto salga de nuestras bodegas con el nombre del chofer asignado.
        </div>

        <p style="font-size: 11px; color: #94a3b8; margin-top: 24px;">Notificación transaccional emitida por el servicio de mensajería empresarial Notify API alojado en AWS EC2.</p>
      </div>
    `;

    // Despacho de Email a través de la Notify API con Template y Llave de Idempotencia
    const notifyResult = await dispatchNotification({
      channel: 'Email',
      recipient: email.trim(),
      templateCode: 'ORDER_CONFIRMATION',
      templateVariables: {
        contacto: String(contactName || 'Representante'),
        empresa: String(companyName),
        orderId: String(orderId),
        ruc: String(ruc),
        ciudad: String(city),
        direccion: String(address),
        total: Number(total).toFixed(2),
      },
      subject: `Confirmación de Pedido Mayorista #${orderId} - DistriLogix S.A.`,
      body: emailHtmlBody,
      idempotencyKey,
      priority: 'Normal',
      metadata: {
        orderId,
        companyName,
        ruc,
        total: String(total),
        system: 'distribuidora-app',
      },
    });

    // Guardar orden en almacén local si no es duplicado forzado
    if (!forceDuplicateDemo) {
      const newOrder: WholesaleOrder = {
        orderId,
        companyName,
        ruc,
        contactName,
        email,
        phone,
        address,
        city,
        items,
        subtotal,
        tax,
        total,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        emailNotificationId: notifyResult.id,
      };
      saveOrder(newOrder);
    }

    return NextResponse.json({
      success: true,
      orderId,
      notification: notifyResult,
      isDuplicateReplay: notifyResult.isIdempotentReplay,
      idempotencyKey,
      message: notifyResult.isIdempotentReplay
        ? '⚠️ Orden DUPLICADA detectada por Notify API. Retornando comprobante original sin duplicar correos.'
        : '✅ Pedido registrado exitosamente. Correo transaccional emitido mediante Notify API.',
    });
  } catch (error: any) {
    console.error('Error registrando orden mayorista:', error);
    return NextResponse.json(
      {
        error: 'Error registrando orden en Notify API',
        details: error?.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
