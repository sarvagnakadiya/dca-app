import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress, tokenOutAddress, approvalAmount, fid } =
      await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenOutAddress,
      approvalAmount,
      fid,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => value === undefined || value === null)
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { wallet: userAddress },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    // Find the token
    const tokenOut = await prisma.token.findUnique({
      where: { address: tokenOutAddress },
    });

    if (!tokenOut) {
      return NextResponse.json(
        {
          success: false,
          error: "Token not found",
        },
        { status: 404 }
      );
    }

    // Find the existing plan for this user and token pair
    const existingPlan = await prisma.dCAPlan.findFirst({
      where: {
        userId: user.id,
        tokenOutId: tokenOut.id,
        active: true,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        {
          success: false,
          error: "No active plan found for this token pair",
        },
        { status: 404 }
      );
    }

    // Update the approval amount
    const updatedPlan = await prisma.dCAPlan.update({
      where: {
        id: existingPlan.id,
      },
      data: {
        approvalAmount,
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
        data: updatedPlan,
      },
      { status: 200 }
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
