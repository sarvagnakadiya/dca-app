import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const {
      address,
      symbol,
      name,
      isWrapped,
      wrappedName,
      wrappedSymbol,
      originalAddress,
    } = await req.json();

    // Validation
    if (!address) {
      return NextResponse.json(
        { success: false, error: "Token address is required" },
        { status: 400 }
      );
    }

    // Check if token with same address exists
    const existingToken = await prisma.token.findUnique({
      where: { address },
    });

    if (existingToken) {
      return NextResponse.json(
        { success: false, error: "Token with this address already exists" },
        { status: 409 }
      );
    }

    const newToken = await prisma.token.create({
      data: {
        address,
        symbol,
        name,
        isWrapped,
        wrappedName,
        wrappedSymbol,
        originalAddress,
      },
    });

    return NextResponse.json(
      { success: true, data: newToken },
      { status: 201 }
    );
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
