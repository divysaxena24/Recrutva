import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY ? "exists" : "missing",
    secret: process.env.CLOUDINARY_API_SECRET ? "exists" : "missing",
  });
}