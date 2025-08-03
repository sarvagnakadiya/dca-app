import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { DCAExecution, DCAPlan, Token } from "~/lib/types";

export async function GET(
  req: Request,
  context: { params: Promise<{ address: string; fid: string }> }
) {
  try {
    const { address, fid } = await context.params;
    const normalizedAddress = address.toLowerCase();

    // Find the user by FID
    const user = await prisma.user.findUnique({
      where: { fid: parseInt(fid) },
    });

    // Find the token in our database
    const token: Token | null = await prisma.token.findUnique({
      where: { address: normalizedAddress },
    });

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Token not found",
        },
        { status: 404 }
      );
    }

    // Get user's plans for this token if user exists (only for calculations)
    let userPlans: DCAPlan[] = [];
    if (user) {
      userPlans = await prisma.dCAPlan.findMany({
        where: {
          tokenOutAddress: normalizedAddress,
          userWallet: user.wallet,
          active: true,
        },
        include: {
          executions: true,
        },
      });
    }

    console.log("User plans:", userPlans);
    console.log("--------------------------------");

    // Get current price and metrics from token model
    console.log(`Raw token data for ${token.symbol}:`, {
      price: token.price,
      priceType: typeof token.price,
      marketcap: token.marketcap,
      volume24h: token.volume24h,
    });

    // Convert Decimal types to numbers properly
    const currentPrice = token.price ? Number(token.price.toString()) : 0;
    const fdvUsd = token.fdv ? Number(token.fdv.toString()) : 0;
    const marketCapUsd = token.marketcap
      ? Number(token.marketcap.toString())
      : 0;
    const volume24h = token.volume24h ? Number(token.volume24h.toString()) : 0;
    const totalSupply = token.totalSupply
      ? Number(token.totalSupply.toString())
      : 0;

    // Calculate investment metrics
    let totalInvestedValue = 0;
    let currentValue = 0;
    let percentChange = 0;

    if (userPlans.length > 0) {
      // Get all executions for this token from user's plans
      const allExecutions = userPlans.flatMap(
        (plan: DCAPlan) => plan.executions
      );

      if (allExecutions.length > 0) {
        // Calculate total invested value (sum of all amountIn minus fees in USDC)
        totalInvestedValue = allExecutions.reduce(
          (sum: number, execution: DCAExecution) => {
            const amountIn = Number(execution.amountIn) / 1_000_000; // Convert from USDC decimals (6)
            const feeAmount = Number(execution.feeAmount) / 1_000_000; // Convert from USDC decimals (6)
            return sum + (amountIn - feeAmount); // Subtract fees from investment amount
          },
          0
        );

        // Calculate current value (sum of all tokenOutAmount * current price)
        const totalTokenAmount = allExecutions.reduce(
          (sum: number, execution: DCAExecution) => {
            return (
              sum +
              Number(execution.amountOut) / Math.pow(10, Number(token.decimals))
            );
          },
          0
        );

        currentValue = totalTokenAmount * currentPrice;

        // Calculate percent change
        if (totalInvestedValue > 0) {
          percentChange =
            ((currentValue - totalInvestedValue) / totalInvestedValue) * 100;
        }
      }
    }

    // Return response with token model data
    return NextResponse.json({
      success: true,
      data: {
        ...token,
        totalInvestedValue,
        currentValue,
        percentChange,
        currentPrice,
        fdvUsd,
        marketCapUsd,
        volume24h,
        totalSupply,
        hasActivePlan: userPlans.length > 0,
        plansOut: userPlans,
      },
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
