import { NextResponse } from 'next/server';

export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY ? 'exists' : 'missing',
    secret: process.env.CLOUDINARY_API_SECRET ? 'exists' : 'missing',
  });
}
