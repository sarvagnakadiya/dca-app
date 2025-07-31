"use client";
import React, { useState } from "react";
import { Button } from "~/components/ui/Button";
import { useFrame } from "~/components/providers/FrameProvider";
import { useParams, useRouter } from "next/navigation";
import { SetFrequencyPopup } from "~/components/ui/SetFrequencyPopup";
import { TokenApprovalPopup } from "~/components/ui/TokenApprovalPopup";
import Image from "next/image";
import sdk from "@farcaster/frame-sdk";

interface TokenStats {
  oneYearAgo: number;
  invested: number;
  currentValue: number;
  marketCap: number;
  fdv: number;
  circSupply: number;
  totalSupply: number;
}

interface Token {
  name: string;
  icon: string;
  price: number;
  stats: TokenStats;
  about: string;
}

interface TokenApiResponse {
  success: boolean;
  data: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    isWrapped: boolean;
    wrappedName: string;
    wrappedSymbol: string;
    originalAddress: string;
    cg_name: string;
    cg_symbol: string;
    decimals: number;
    image_url: string;
    coingecko_coin_id: string;
    normalized_total_supply: string;
    price_usd: string;
    fdv_usd: string;
    total_reserve_in_usd: string;
    volume_usd: {
      h24: string;
    };
  };
}

const TokenPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("1h");
  const { context } = useFrame();
  const params = useParams();
  const router = useRouter();
  const address = params?.address;
  const [showSetFrequency, setShowSetFrequency] = useState(false);
  const [showTokenApproval, setShowTokenApproval] = useState(false);

  const [frequencyData, setFrequencyData] = useState<{
    amount: number;
    frequency: string;
  } | null>(null);
  const [token, setToken] = useState<Token>({
    name: "",
    icon: "",
    price: 0,
    stats: {
      oneYearAgo: 0,
      invested: 0,
      currentValue: 0,
      marketCap: 0,
      fdv: 0,
      circSupply: 0,
      totalSupply: 0,
    },
    about: "",
  });

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toString(); // for peasants with <1k
  };

  // Map periods to GeckoTerminal resolution parameters
  const getResolution = (period: string) => {
    switch (period) {
      case "1H":
        return "1h";
      case "D":
        return "1d";
      case "W":
        return "1w";
      case "M":
        return "1month";
      default:
        return "15m";
    }
  };

  React.useEffect(() => {
    const fetchTokenData = async () => {
      if (address) {
        try {
          const response = await fetch(
            `/api/plan/getPlan/${address}/${context?.user?.fid}`
          );
          const result: TokenApiResponse = await response.json();

          if (result.success) {
            const tokenData = result.data;
            console.log(tokenData);
            setToken({
              name: tokenData.name,
              icon: tokenData.image_url || "₿", // Fallback to Bitcoin symbol if no image
              price: parseFloat(tokenData.price_usd) || 0,
              stats: {
                oneYearAgo: 0, // This data is not available in the API response
                invested: 100, // This is a static value
                currentValue: 1380, // This is a static value
                marketCap: parseFloat(tokenData.total_reserve_in_usd) || 0,
                fdv: parseFloat(tokenData.fdv_usd) || 0,
                circSupply: parseFloat(tokenData.normalized_total_supply) || 0,
                totalSupply: parseFloat(tokenData.normalized_total_supply) || 0,
              },
              about: `Information about ${tokenData.name} (${tokenData.symbol}) token.`,
            });
            await sdk.actions.ready({});
          }
        } catch (error) {
          console.error("Error fetching token data:", error);
        }
      }
    };

    fetchTokenData();
  }, [address, context]);

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ←
          </button>
          <div className="flex items-center space-x-2">
            {token.icon ? (
              <Image
                src={token.icon}
                alt="Token Icon"
                className="w-8 h-8 rounded-full object-cover border-2 border-gray-700"
                width={32}
                height={32}
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
                <span className="text-lg">{token.name[0]}</span>
              </div>
            )}
            <span className="text-lg font-medium">{token.name}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1 text-sm">
            <span className="mr-1">💳</span>
            <span>$2,000</span>
          </div>
          {context?.user?.pfpUrl ? (
            <Image
              src={context.user.pfpUrl}
              alt="Profile"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-700"
            />
          ) : (
            <span className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center text-lg">
              🐷
            </span>
          )}
        </div>
      </div>

      {/* Price & Chart Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-4xl font-light">
              ${Number(token.price).toFixed(1)}
            </div>
          </div>
          <div className="flex space-x-2 bg-gray-800 rounded-lg p-1">
            {["1H", "D", "W", "M"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? "bg-black text-white"
                    : "text-gray-400"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        {/* GeckoTerminal Chart */}
        <div className="relative h-[400px] mt-2">
          <iframe
            height="100%"
            width="100%"
            id="geckoterminal-embed"
            title="GeckoTerminal Embed"
            src={`https://www.geckoterminal.com/base/pools/${address}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=${getResolution(
              selectedPeriod
            )}`}
            frameBorder="0"
            allow="clipboard-write"
            allowFullScreen
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="text-lg font-medium mb-4">Stats</div>
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-gray-400 text-sm">1 years ago price</div>
            <div className="text-white text-lg">
              ${formatNumber(token.stats.oneYearAgo)}
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div>
              <div className="text-gray-400 text-sm">If you invested</div>
              <div className="text-white text-xl font-medium">
                ${formatNumber(token.stats.invested)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Current value</div>
              <div className="text-green-400 text-xl font-medium">
                ${formatNumber(token.stats.currentValue)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-400">Market cap</span>
            <span className="text-white font-medium">
              ${formatNumber(token.stats.marketCap)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">FDV</span>
            <span className="text-white font-medium">
              ${formatNumber(token.stats.fdv)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">Circulating supply</span>
            <span className="text-white font-medium">
              {formatNumber(token.stats.circSupply)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">Total supply</span>
            <span className="text-white font-medium">
              {formatNumber(token.stats.totalSupply)}
            </span>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="text-lg font-medium mb-2">About</div>
        <div className="text-gray-300 text-sm leading-relaxed">
          {token.about}
        </div>
      </div>

      {/* Invest Button */}
      <div className="mt-auto">
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-4 rounded-xl w-full"
          onClick={() => {
            if (frequencyData) {
              setShowTokenApproval(true);
            } else {
              setShowSetFrequency(true);
            }
          }}
        >
          {frequencyData ? "Approve USDC" : "Invest in Pol"}
        </Button>
      </div>
      <SetFrequencyPopup
        open={showSetFrequency}
        onClose={() => setShowSetFrequency(false)}
        onConfirm={(amount, frequency) => {
          setFrequencyData({ amount, frequency });
          setShowSetFrequency(false);
          setTimeout(() => setShowTokenApproval(true), 200); // slight delay for smooth transition
        }}
      />
      <TokenApprovalPopup
        open={showTokenApproval}
        onClose={() => setShowTokenApproval(false)}
        onApprove={(amount) => {
          setShowTokenApproval(false);
          // console.log("amount", amount);
          // TODO: Call USDC approval logic here
          // You can use frequencyData for the previous step's data if available
        }}
        token="USDC"
        defaultAmount={frequencyData?.amount || 100}
      />
    </div>
  );
};

export default TokenPage;
