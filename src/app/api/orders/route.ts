import { NextResponse } from 'next/server';
import { ordersList } from '@/lib/orderStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    orders: ordersList,
  });
}
