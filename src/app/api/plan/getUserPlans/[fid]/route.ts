import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await context.params;

    // First verify if user exists
    const user = await prisma.user.findUnique({
      where: { fid: Number(fid) },
    });

    // Get all tokens
    const tokens = await prisma.token.findMany();

    // Get user's active plans if user exists
    const userPlans = user
      ? await prisma.dCAPlan.findMany({
          where: {
            userId: user.id,
            active: true,
          },
          include: {
            tokenIn: true,
            tokenOut: true,
          },
        })
      : [];

    // Create a map of token addresses to their plan status
    const tokenPlanMap = new Map();
    userPlans.forEach((plan) => {
      tokenPlanMap.set(plan.tokenIn.address, true);
      tokenPlanMap.set(plan.tokenOut.address, true);
    });

    // Add plan status to tokens
    const tokensWithUserData = tokens.map((token) => ({
      ...token,
      hasActivePlan: tokenPlanMap.has(token.address) || false,
    }));

    return NextResponse.json({
      success: true,
      data: tokensWithUserData,
    });
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
