import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import axios from "axios";
import { Decimal } from "@prisma/client/runtime/library";

// TypeScript interfaces for database models
interface DCAExecution {
  id: string;
  planId: string;
  amountIn: Decimal;
  tokenOutId: string;
  amountOut: Decimal;
  feeAmount: Decimal;
  priceAtTx: Decimal;
  txHash: string;
  executedAt: Date;
}

interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: Decimal;
  about?: string | null;
  image?: string | null;
  isWrapped: boolean;
  wrappedName?: string | null;
  wrappedSymbol?: string | null;
  originalAddress?: string | null;
  feeTier: number;
}

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
        executions: true,
      },
    });

    console.log("User plans:", userPlans);
    console.log("--------------------------------");

    // Create a map of token addresses to their plan status and execution data
    const tokenPlanMap = new Map();
    const tokenExecutionMap = new Map();
    const tokenPlanCreatedAtMap = new Map();

    userPlans.forEach((plan) => {
      // Mark the token being sold/spent (tokenOut) as having an active plan
      tokenPlanMap.set(plan.tokenOut.address, true);

      // Store the earliest createdAt for this token (in case of multiple plans)
      const tokenAddress = plan.tokenOut.address;
      if (
        !tokenPlanCreatedAtMap.has(tokenAddress) ||
        plan.createdAt < tokenPlanCreatedAtMap.get(tokenAddress)
      ) {
        tokenPlanCreatedAtMap.set(tokenAddress, plan.createdAt);
      }

      // Aggregate executions for this token
      if (!tokenExecutionMap.has(tokenAddress)) {
        tokenExecutionMap.set(tokenAddress, []);
      }
      tokenExecutionMap.get(tokenAddress).push(...plan.executions);
    });

    // Fetch current prices and calculate values for tokens with active plans
    const tokensWithUserData = await Promise.all(
      filteredTokens.map(async (token) => {
        const executions = tokenExecutionMap.get(token.address) || [];
        let totalInvestedValue = 0;
        let currentValue = 0;
        let percentChange = 0;
        let currentPrice = 0;

        // Get current token price for all tokens
        try {
          const response = await axios.get(
            `https://api.geckoterminal.com/api/v2/networks/base/tokens/${token.address}`
          );
          currentPrice =
            parseFloat(response.data.data.attributes.price_usd) || 0;
        } catch (error) {
          console.error(
            `Failed to fetch price for token ${token.address}:`,
            error
          );
          // If price fetch fails and we have executions, use the last execution price as fallback
          if (executions.length > 0) {
            const lastExecution = executions[executions.length - 1];
            currentPrice = Number(lastExecution.priceAtTx);
          }
        }

        // Calculate investment metrics only if there are executions
        if (executions.length > 0) {
          // Calculate total invested value (sum of all amountIn minus fees in USDC)
          totalInvestedValue = executions.reduce(
            (sum: number, execution: DCAExecution) => {
              const amountIn = Number(execution.amountIn) / 1_000_000; // Convert from USDC decimals (6)
              const feeAmount = Number(execution.feeAmount) / 1_000_000; // Convert from USDC decimals (6)
              return sum + (amountIn - feeAmount); // Subtract fees from investment amount
            },
            0
          );

          // Calculate current value (sum of all tokenOutAmount * current price)
          const totalTokenAmount = executions.reduce(
            (sum: number, execution: DCAExecution) => {
              return (
                sum +
                Number(execution.amountOut) /
                  Math.pow(10, Number(token.decimals))
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

        return {
          ...token,
          hasActivePlan: tokenPlanMap.has(token.address) || false,
          planCreatedAt: tokenPlanCreatedAtMap.get(token.address) || null,
          totalInvestedValue,
          currentValue,
          percentChange,
          currentPrice,
        };
      })
    );

    // Calculate portfolio-level metrics
    const portfolioCurrentValue = tokensWithUserData.reduce(
      (sum, token) => sum + token.currentValue,
      0
    );

    const portfolioInvestedAmount = tokensWithUserData.reduce(
      (sum, token) => sum + token.totalInvestedValue,
      0
    );

    const portfolioPercentChange =
      portfolioInvestedAmount > 0
        ? ((portfolioCurrentValue - portfolioInvestedAmount) /
            portfolioInvestedAmount) *
          100
        : 0;

    return NextResponse.json({
      success: true,
      data: tokensWithUserData,
      portfolio: {
        portfolioCurrentValue,
        portfolioInvestedAmount,
        portfolioPercentChange,
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
