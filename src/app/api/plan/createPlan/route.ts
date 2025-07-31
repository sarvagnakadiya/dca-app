import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const {
      userAddress,
      tokenInAddress,
      tokenOutAddress,
      recipient,
      amountIn,
      approvalAmount,
      frequency,
      planId,
      feeTier,
      fid,
    } = await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenInAddress,
      tokenOutAddress,
      recipient,
      amountIn,
      approvalAmount,
      frequency,
      planId,
      feeTier,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          missingFields,
        },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { wallet: userAddress },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await prisma.user.create({
        data: {
          wallet: userAddress,
          fid: fid ? Number(fid) : null,
        },
      });
    }

    // Validate tokens exist
    const [tokenIn, tokenOut] = await Promise.all([
      prisma.token.findUnique({ where: { address: tokenInAddress } }),
      prisma.token.findUnique({ where: { address: tokenOutAddress } }),
    ]);

    if (!tokenIn || !tokenOut) {
      return NextResponse.json(
        {
          success: false,
          error: "One or both tokens not found",
        },
        { status: 404 }
      );
    }

    const newPlan = await prisma.dCAPlan.create({
      data: {
        userId: user.id,
        tokenInId: tokenIn.id,
        tokenOutId: tokenOut.id,
        recipient,
        amountIn,
        approvalAmount,
        frequency,
        planId,
        feeTier,
        lastExecutedAt: 0,
      },
      include: {
        user: true,
        tokenIn: true,
        tokenOut: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: newPlan,
      },
      { status: 201 }
    );
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
