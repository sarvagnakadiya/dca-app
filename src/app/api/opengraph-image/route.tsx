import { NextResponse } from "next/server";
import { join } from "path";
import { promises as fs } from "fs";

export async function GET() {
  // Path to the frame.png in the public directory
  const imagePath = join(process.cwd(), "public", "frame.png");
  try {
    const imageBuffer = await fs.readFile(imagePath);
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Image not found", { status: 404 });
  }
}
