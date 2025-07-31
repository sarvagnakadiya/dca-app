import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await context.params;

    // Get all tokens
    const tokens = await prisma.token.findMany();

    // Filter out USDC token
    const filteredTokens = tokens.filter(
      (token) =>
        token.address.toLowerCase() !==
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    );

    // Get user's active plans by fid
    const userPlans = await prisma.dCAPlan.findMany({
      where: {
        user: {
          fid: Number(fid),
        },
        active: true,
      },
      include: {
        tokenIn: true,
        tokenOut: true,
      },
    });

    console.log("User plans:", userPlans);
    console.log("--------------------------------");

    // Create a map of token addresses to their plan status
    const tokenPlanMap = new Map();
    userPlans.forEach((plan) => {
      // Mark the token being sold/spent (tokenOut) as having an active plan
      tokenPlanMap.set(plan.tokenOut.address, true);
    });

    // Add plan status to tokens
    const tokensWithUserData = filteredTokens.map((token) => ({
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
