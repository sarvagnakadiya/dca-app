import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

interface CreateTokenRequest {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isWrapped: boolean;
  wrappedName?: string;
  wrappedSymbol?: string;
  originalAddress?: string;
}

export async function POST(req: Request) {
  try {
    const {
      address,
      symbol,
      name,
      decimals,
      isWrapped,
      wrappedName,
      wrappedSymbol,
      originalAddress,
    }: CreateTokenRequest = await req.json();

    // Validation
    if (!address) {
      return NextResponse.json(
        { success: false, error: "Token address is required" },
        { status: 400 }
      );
    }

    if (!decimals) {
      return NextResponse.json(
        { success: false, error: "Token decimals is required" },
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
        decimals,
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
