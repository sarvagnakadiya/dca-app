import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress, tokenOutAddress, amountIn, frequency, fid } =
      await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenOutAddress,
      amountIn,
      frequency,
      fid,
    };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => value === undefined || value === null)
      .map(([key]) => key);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields", missingFields },
        { status: 400 }
      );
    }

    // Find user by FID (following getPlan pattern)
    const user = await prisma.user.findUnique({
      where: { fid: parseInt(fid.toString()) },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Find token
    const tokenOut = await prisma.token.findUnique({
      where: { address: tokenOutAddress },
    });
    if (!tokenOut) {
      return NextResponse.json(
        { success: false, error: "Token not found" },
        { status: 404 }
      );
    }

    // Find the existing active plan
    const existingPlan = await prisma.dCAPlan.findFirst({
      where: {
        userWallet: user.wallet,
        tokenOutAddress: tokenOut.address,
        active: true,
      },
    });
    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: "No active plan found for this token pair" },
        { status: 404 }
      );
    }

    // Update amountIn and frequency
    const updatedPlan = await prisma.dCAPlan.update({
      where: { planHash: existingPlan.planHash },
      data: { amountIn, frequency },
      include: { user: true, tokenOut: true },
    });

    return NextResponse.json(
      { success: true, data: updatedPlan },
      { status: 200 }
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
