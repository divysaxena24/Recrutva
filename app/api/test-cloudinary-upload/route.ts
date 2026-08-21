import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function GET() {
  try {
    // Minimal 1x1 transparent PNG
    const testBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await cloudinary.uploader.upload(testBase64, {
      folder: "recrutva/test",
      resource_type: "image",
      public_id: `diag_${Date.now()}`,
    });

    // Clean up
    await cloudinary.uploader.destroy(result.public_id, {
      resource_type: "image",
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
    });
  } catch (err: unknown) {
    const cloudErr = err as { message?: string; http_code?: number };
    console.error("Cloudinary upload diagnostic failed:", {
      message: cloudErr.message,
      http_code: cloudErr.http_code,
    });
    return NextResponse.json({
      success: false,
      error: cloudErr.message || "Unknown error",
      http_code: cloudErr.http_code,
    });
  }
}
