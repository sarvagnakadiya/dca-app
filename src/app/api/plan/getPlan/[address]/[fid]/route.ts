import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import axios from "axios";

export async function GET(
  req: Request,
  context: { params: Promise<{ address: string; fid: string }> }
) {
  try {
    const { address, fid } = await context.params;

    // Find the user by FID
    const user = await prisma.user.findUnique({
      where: { fid: parseInt(fid) },
    });

    // Find the token in our database
    const token = await prisma.token.findUnique({
      where: { address },
      include: {
        plansOut: user
          ? {
              where: {
                active: true,
                userId: user.id,
              },
            }
          : undefined,
      },
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

    // Fetch data from GeckoTerminal API
    try {
      const response = await axios.get(
        `https://api.geckoterminal.com/api/v2/networks/base/tokens/${address}`
      );

      const geckoData = response.data.data.attributes;

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
          hasActivePlan: token.plansOut?.length > 0,
        },
      });
    } catch (error) {
      // If GeckoTerminal API call fails, return token without Gecko data
      console.error(
        `Failed to fetch GeckoTerminal data for token ${address}:`,
        error
      );
      return NextResponse.json({
        success: true,
        data: {
          ...token,
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
