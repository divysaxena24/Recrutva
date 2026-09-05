import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await cloudinary.api.ping();
    return NextResponse.json({ success: true, cloud_name: result.cloud_name });
  } catch (err: unknown) {
    const cloudErr = err as { message?: string; http_code?: number };
    console.error('Cloudinary ping failed:', {
      message: cloudErr.message,
      http_code: cloudErr.http_code,
    });
    return NextResponse.json({
      success: false,
      error: cloudErr.message || 'Unknown error',
      http_code: cloudErr.http_code,
    });
  }
}
