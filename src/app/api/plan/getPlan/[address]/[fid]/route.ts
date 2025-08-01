import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import axios from "axios";
import { Decimal } from "@prisma/client/runtime/library";

// TypeScript interfaces for database models
interface DCAExecution {
  txHash: string;
  planHash: string;
  amountIn: Decimal;
  tokenOutAddress: string;
  amountOut: Decimal;
  feeAmount: Decimal;
  executedAt: Date;
}

interface DCAPlan {
  planHash: string;
  userWallet: string;
  tokenOutAddress: string;
  recipient: string;
  amountIn: Decimal;
  frequency: number;
  lastExecutedAt: number;
  active: boolean;
  createdAt: Date;
  executions: DCAExecution[];
}

interface Token {
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
}

interface GeckoTerminalData {
  name: string;
  symbol: string;
  decimals: number;
  image_url: string;
  coingecko_coin_id: string;
  normalized_total_supply: string;
  price_usd: string;
  fdv_usd: string;
  total_reserve_in_usd: string;
  volume_usd: string;
}

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
    const token = await prisma.token.findUnique({
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

    // Fetch data from GeckoTerminal API first
    let geckoData: GeckoTerminalData | null = null;
    let currentPrice = 0;

    try {
      const response = await axios.get(
        `https://api.geckoterminal.com/api/v2/networks/base/tokens/${normalizedAddress}`
      );
      geckoData = response.data.data.attributes;
      currentPrice = parseFloat(geckoData!.price_usd) || 0;
    } catch (error) {
      console.error(
        `Failed to fetch GeckoTerminal data for token ${normalizedAddress}:`,
        error
      );
    }

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

        // Use current price if available, otherwise fallback to last execution price
        if (currentPrice > 0) {
          // Calculate current value (sum of all tokenOutAmount * current price)
          const totalTokenAmount = allExecutions.reduce(
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
        } else {
          // Fallback to last execution price - note: we don't have priceAtTx in new schema
          // We'll use current price as 0 in this case
          const totalTokenAmount = allExecutions.reduce(
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
          if (totalInvestedValue > 0) {
            percentChange =
              ((currentValue - totalInvestedValue) / totalInvestedValue) * 100;
          }
        }
      }
    }

    // Return response with or without Gecko data
    if (geckoData !== null && geckoData !== undefined) {
      return NextResponse.json({
        success: true,
        data: {
          ...token,
          cg_name: geckoData.name,
          cg_symbol: geckoData.symbol,
          decimals: geckoData.decimals,
          image_url: geckoData.image_url,
          coingecko_coin_id: geckoData.coingecko_coin_id,
          normalized_total_supply: geckoData.normalized_total_supply,
          price_usd: geckoData.price_usd,
          fdv_usd: geckoData.fdv_usd,
          total_reserve_in_usd: geckoData.total_reserve_in_usd,
          volume_usd: geckoData.volume_usd,
          hasActivePlan: userPlans.length > 0,
          plansOut: userPlans,
          totalInvestedValue,
          currentValue,
          percentChange,
          currentPrice,
        },
      });
    } else {
      // Return token without Gecko data
      return NextResponse.json({
        success: true,
        data: {
          ...token,
          hasActivePlan: userPlans.length > 0,
          plansOut: userPlans,
          totalInvestedValue,
          currentValue,
          percentChange,
          currentPrice,
        },
      });
    }
  } catch (error: Error | unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
