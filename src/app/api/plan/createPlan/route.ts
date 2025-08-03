import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { keccak256, encodePacked } from "viem";

export async function POST(req: Request) {
  try {
    const {
      userAddress,
      tokenOutAddress,
      recipient,
      amountIn,
      frequency,
      fid,
    } = await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenOutAddress,
      recipient,
      amountIn,
      frequency,
      fid,
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

    // Generate planHash offchain: keccak256(abi.encodePacked(tokenOut, recipient))
    const planHash = keccak256(
      encodePacked(["address", "address"], [tokenOutAddress, recipient])
    );

    // Find or create user - check by both wallet and fid to avoid conflicts
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ wallet: userAddress }, ...(fid ? [{ fid: Number(fid) }] : [])],
      },
    });

    if (!user) {
      // Create new user if doesn't exist
      user = await prisma.user.create({
        data: {
          wallet: userAddress,
          fid: fid ? Number(fid) : null,
        },
      });
    } else if (user.wallet !== userAddress) {
      // If user exists but with different wallet, update the wallet
      user = await prisma.user.update({
        where: { wallet: user.wallet },
        data: { wallet: userAddress },
      });
    }

    // Validate tokenOut exists (we only need tokenOut for the plan)
    const tokenOut = await prisma.token.findUnique({
      where: { address: tokenOutAddress },
    });

    if (!tokenOut) {
      return NextResponse.json(
        {
          success: false,
          error: "Token out not found",
        },
        { status: 404 }
      );
    }

    // Check if plan already exists
    const existingPlan = await prisma.dCAPlan.findUnique({
      where: { planHash },
    });

    if (existingPlan) {
      // If plan exists but is inactive, reactivate it
      if (!existingPlan.active) {
        const reactivatedPlan = await prisma.dCAPlan.update({
          where: { planHash },
          data: {
            active: true,
            amountIn,
            frequency,
            lastExecutedAt: 0, // Reset execution time for new investment
            createdAt: new Date(), // Reset creation time for reactivated plan
          },
          include: {
            user: true,
            tokenOut: true,
          },
        });

        return NextResponse.json(
          {
            success: true,
            data: reactivatedPlan,
            message: "Plan reactivated successfully",
          },
          { status: 200 }
        );
      }

      // If plan exists and is active, return error
      return NextResponse.json(
        {
          success: false,
          error: "Plan already exists and is active",
        },
        { status: 409 }
      );
    }

    const newPlan = await prisma.dCAPlan.create({
      data: {
        planHash,
        userWallet: user.wallet,
        tokenOutAddress,
        recipient,
        amountIn,
        frequency,
        lastExecutedAt: 0,
      },
      include: {
        user: true,
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
