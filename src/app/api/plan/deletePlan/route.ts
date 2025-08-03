import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress, tokenOutAddress, fid } = await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenOutAddress,
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

    // Find the active plan for this user and token
    const existingPlan = await prisma.dCAPlan.findFirst({
      where: {
        userWallet: user.wallet,
        tokenOutAddress: tokenOutAddress.toLowerCase(),
        active: true,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: "No active plan found for this token" },
        { status: 404 }
      );
    }

    // Delete all executions related to this plan first
    await prisma.dCAExecution.deleteMany({
      where: { planHash: existingPlan.planHash },
    });

    // Mark the plan as inactive instead of deleting
    await prisma.dCAPlan.update({
      where: { planHash: existingPlan.planHash },
      data: { active: false },
    });

    return NextResponse.json({
      success: true,
      message:
        "Plan deactivated successfully and all related executions deleted",
      deactivatedPlan: {
        planHash: existingPlan.planHash,
        userWallet: existingPlan.userWallet,
        tokenOutAddress: existingPlan.tokenOutAddress,
      },
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete plan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
