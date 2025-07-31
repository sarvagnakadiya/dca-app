import React, { useState, useEffect } from "react";
import { useFrame } from "~/components/providers/FrameProvider";
import { useRouter } from "next/navigation";
import sdk from "@farcaster/frame-sdk";
import { BalanceDisplay } from "./ui/BalanceDisplay";
import InvestedPositionTile from "./ui/InvestedPositionTile";
import ExplorePositionTile from "./ui/ExplorePositionTile";
import PositionTileSkeleton from "./ui/PositionTileSkeleton";

interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  about: string | null;
  decimals: string;
  image: string;
  isWrapped: boolean;
  wrappedName: string;
  wrappedSymbol: string;
  originalAddress: string | null;
  feeTier: number;
  hasActivePlan: boolean;
  planCreatedAt: string;
  totalInvestedValue: number;
  currentValue: number;
  percentChange: number;
  currentPrice: number;
}

interface PortfolioData {
  portfolioCurrentValue: number;
  portfolioInvestedAmount: number;
  portfolioPercentChange: number;
}

// Utility function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  } else {
    return "Just started";
  }
};

// Utility function to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Utility function to format price
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

const Home = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7D");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const { context, isSDKLoaded } = useFrame();
  const router = useRouter();

  // Use portfolio data from API if available, otherwise fallback to calculated value
  const totalPortfolioBalance =
    portfolioData?.portfolioCurrentValue ||
    tokens
      .filter((token) => token.hasActivePlan)
      .reduce((sum, token) => sum + token.currentValue, 0);

  useEffect(() => {
    console.log("fetching tokens");
    console.log("context:::", context);
    const fetchTokens = async () => {
      if (!context?.user?.fid) return;

      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/plan/getUserPlans/${context.user.fid}`
        );
        const result = await response.json();
        if (result.success) {
          console.log("Fetched tokens:", result.data);
          console.log("Portfolio data:", result.portfolio);
          console.log(
            "Tokens with active plans:",
            result.data.filter((token: Token) => token.hasActivePlan)
          );
          console.log(
            "Tokens without active plans:",
            result.data.filter((token: Token) => !token.hasActivePlan)
          );
          setTokens(result.data);
          setPortfolioData(result.portfolio || null);
          await sdk.actions.ready({});
        }
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [context]);

  // Show loading if SDK is not loaded yet
  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-medium">Home</h1>
        <div className="flex items-center space-x-3">
          <BalanceDisplay />
        </div>
      </div>

      {/* Portfolio Balance Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-gray-400 text-sm mb-2">Portfolio balance</div>
            <div className="text-4xl font-light">
              {formatCurrency(totalPortfolioBalance)}
            </div>
            {portfolioData && (
              <div className="flex items-center space-x-4 mt-2 text-sm">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Invested:</span>
                  <span className="text-white">
                    {formatCurrency(portfolioData.portfolioInvestedAmount)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Change:</span>
                  <span
                    className={
                      portfolioData.portfolioPercentChange >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {portfolioData.portfolioPercentChange >= 0 ? "+" : ""}
                    {portfolioData.portfolioPercentChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Time Period Selector */}
          <div className="flex space-x-4 text-sm">
            <button
              onClick={() => setSelectedPeriod("7D")}
              className={`pb-1 ${
                selectedPeriod === "7D"
                  ? "text-orange-400 border-b border-orange-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setSelectedPeriod("1M")}
              className={`pb-1 ${
                selectedPeriod === "1M"
                  ? "text-orange-400 border-b border-orange-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              1M
            </button>
            <button
              onClick={() => setSelectedPeriod("1Y")}
              className={`pb-1 ${
                selectedPeriod === "1Y"
                  ? "text-orange-400 border-b border-orange-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              1Y
            </button>
            <button
              onClick={() => setSelectedPeriod("5Y")}
              className={`pb-1 ${
                selectedPeriod === "5Y"
                  ? "text-orange-400 border-b border-orange-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              5Y
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-32 mb-8">
          <svg className="w-full h-full" viewBox="0 0 400 120">
            <defs>
              <linearGradient
                id="chartGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line
              x1="0"
              y1="20"
              x2="400"
              y2="20"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="40"
              x2="400"
              y2="40"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="60"
              x2="400"
              y2="60"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="80"
              x2="400"
              y2="80"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="100"
              x2="400"
              y2="100"
              stroke="#333"
              strokeWidth="0.5"
            />

            {/* Chart path */}
            <path
              d="M 0 80 Q 80 75 120 70 T 200 65 Q 280 60 320 55 T 400 45"
              fill="url(#chartGradient)"
              stroke="#f97316"
              strokeWidth="2"
              fillRule="evenodd"
            />
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-12">
            <span>{formatCurrency(totalPortfolioBalance * 1.1)}</span>
            <span>{formatCurrency(totalPortfolioBalance * 0.8)}</span>
            <span>{formatCurrency(totalPortfolioBalance * 0.6)}</span>
            <span>{formatCurrency(totalPortfolioBalance * 0.4)}</span>
          </div>
        </div>
      </div>

      {/* DCA Positions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">DCA Positions</h2>

        {isLoading ? (
          // Show skeleton loading while fetching data
          <>
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
          </>
        ) : tokens.filter((token) => token.hasActivePlan).length > 0 ? (
          tokens
            .filter((token) => token.hasActivePlan)
            .map((token) => (
              <div
                key={token.id}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => router.push(`/token/${token.address}`)}
              >
                <InvestedPositionTile
                  icon={token.image || token.symbol[0]}
                  iconBgColor="bg-orange-500"
                  name={token.name}
                  currentPrice={formatPrice(token.currentPrice)}
                  startedAgo={formatTimeAgo(token.planCreatedAt)}
                  investedAmount={formatCurrency(token.totalInvestedValue)}
                  currentValue={formatCurrency(token.currentValue)}
                />
              </div>
            ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No active DCA positions yet</p>
            <p className="text-sm mt-2">Start your first DCA plan below</p>
          </div>
        )}
      </div>

      {/* Explore More Tokens */}
      <div>
        <h2 className="text-lg font-medium mb-4">Explore more tokens</h2>

        {isLoading ? (
          // Show skeleton loading while fetching data
          <>
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
          </>
        ) : (
          tokens
            .filter((token) => !token.hasActivePlan)
            .map((token) => (
              <div
                key={token.id}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => router.push(`/token/${token.address}`)}
              >
                <ExplorePositionTile
                  icon={token.image}
                  iconBgColor="bg-purple-600"
                  name={token.name}
                  currentPrice={formatPrice(token.currentPrice)}
                  price1YAgo={formatPrice(token.currentPrice * 0.8)} // Placeholder - you might want to add this to your API
                  ifInvestedAmount={formatCurrency(1000)} // Placeholder - you might want to add this to your API
                  ifCurrentValue={formatCurrency(
                    1000 * (1 + token.percentChange / 100)
                  )} // Calculate based on percent change
                />
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Home;
