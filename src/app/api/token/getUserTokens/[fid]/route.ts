import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import axios from "axios";

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

    // Fetch data from GeckoTerminal API for each token and add plan status
    const tokensWithUserData = await Promise.all(
      tokens.map(async (token) => {
        try {
          const response = await axios.get(
            `https://api.geckoterminal.com/api/v2/networks/base/tokens/${token.address}`
          );

          const geckoData = response.data.data.attributes;

          return {
            ...token,
            hasActivePlan: tokenPlanMap.has(token.address) || false,
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
          };
        } catch (error) {
          // If GeckoTerminal API call fails, return token without Gecko data
          console.error(
            `Failed to fetch GeckoTerminal data for token ${token.address}:`,
            error
          );
          return {
            ...token,
            hasActivePlan: tokenPlanMap.has(token.address) || false,
          };
        }
      })
    );

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
