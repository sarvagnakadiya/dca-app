"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { useMiniApp } from "~/components/providers/FrameProvider";
import { useParams, useRouter } from "next/navigation";
import { SetFrequencyPopup } from "~/components/ui/SetFrequencyPopup";
import { TokenApprovalPopup } from "~/components/ui/TokenApprovalPopup";
import { BalanceDisplay } from "~/components/ui/BalanceDisplay";
import Image from "next/image";
import sdk from "@farcaster/frame-sdk";
import { useAccount, useWriteContract } from "wagmi";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";

interface TokenStats {
  oneYearAgo: number;
  invested: number;
  currentValue: number;
  percentChange: number;
  marketCap: number;
  fdv: number;
  circSupply: number;
  totalSupply: number;
}

interface Token {
  name: string;
  icon: string;
  price: number;
  symbol: string;
  decimals: number;
  stats: TokenStats;
  about: string;
  hasActivePlan: boolean;
  feeTier: number;
}

interface Plan {
  id: string;
  planId: number;
  userId: string;
  tokenInId: string;
  tokenOutId: string;
  recipient: string;
  amountIn: string;
  approvalAmount: string;
  frequency: number;
  lastExecutedAt: number;
  active: boolean;
  createdAt: string;
}

interface TokenApiResponse {
  success: boolean;
  data: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    image: string;
    isWrapped: boolean;
    wrappedName: string | null;
    wrappedSymbol: string | null;
    originalAddress: string | null;
    feeTier: number;
    plansOut: Array<Plan>;
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
    hasActivePlan: boolean;
    about?: string;
    totalInvestedValue: number;
    currentValue: number;
    percentChange: number;
    currentPrice: number;
  };
}

const TokenPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("1h");
  const { context, isSDKLoaded } = useMiniApp();
  const { address } = useAccount();
  const params = useParams();
  const router = useRouter();
  const tokenAddress = params?.address;
  const [showSetFrequency, setShowSetFrequency] = useState(false);
  const [showTokenApproval, setShowTokenApproval] = useState(false);
  const [showEditFrequency, setShowEditFrequency] = useState(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);

  // New state for foldable sections
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [isFrequencyExpanded, setIsFrequencyExpanded] = useState(false);
  const [isCancellingPlan, setIsCancellingPlan] = useState(false);

  const [frequencyData, setFrequencyData] = useState<{
    amount: number;
    frequency: string;
  } | null>(null);
  const [pendingPlanHash, setPendingPlanHash] = useState<string | undefined>(
    undefined
  );
  const [token, setToken] = useState<Token>({
    name: "",
    icon: "",
    price: 0,
    symbol: "",
    decimals: 0,
    stats: {
      oneYearAgo: 0,
      invested: 0,
      currentValue: 0,
      percentChange: 0,
      marketCap: 0,
      fdv: 0,
      circSupply: 0,
      totalSupply: 0,
    },
    about: "",
    hasActivePlan: false,
    feeTier: 3000,
  });

  const [isButtonDocked, setIsButtonDocked] = useState(false);
  const buttonDockRef = useRef<HTMLDivElement>(null);

  // Contract interaction for canceling plan
  const { writeContractAsync: cancelPlan, isPending: isCancelling } =
    useWriteContract();
  const DCA_EXECUTOR_ADDRESS = process.env
    .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

  const handleCancelPlan = async () => {
    if (!address || !tokenAddress) return;

    try {
      setIsCancellingPlan(true);

      const hash = await cancelPlan({
        address: DCA_EXECUTOR_ADDRESS,
        abi: DCA_ABI.abi,
        functionName: "cancelPlan",
        args: [tokenAddress as `0x${string}`],
      });

      console.log("Plan cancellation transaction hash:", hash);

      // Also delete the plan from the database
      if (context?.user?.fid) {
        try {
          const deleteResponse = await fetch("/api/plan/deletePlan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userAddress: address,
              tokenOutAddress: tokenAddress,
              fid: context.user.fid,
            }),
          });

          const deleteResult = await deleteResponse.json();
          if (deleteResult.success) {
            console.log("Plan deleted from database successfully");
          } else {
            console.error(
              "Failed to delete plan from database:",
              deleteResult.error
            );
          }
        } catch (dbError) {
          console.error("Error calling deletePlan API:", dbError);
        }
      }

      // Refetch plan data after cancellation
      if (context?.user?.fid) {
        const response = await fetch(
          `/api/plan/getPlan/${tokenAddress}/${context.user.fid}`
        );
        const result: TokenApiResponse = await response.json();
        if (result.success) {
          setToken((prev) => ({
            ...prev,
            hasActivePlan: result.data.hasActivePlan,
          }));
          if (result.data.plansOut && result.data.plansOut.length > 0) {
            setActivePlan(result.data.plansOut[0]);
          } else {
            setActivePlan(null);
          }
        }
      }
    } catch (error) {
      console.error("Error cancelling plan:", error);
    } finally {
      setIsCancellingPlan(false);
    }
  };

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
      if (tokenAddress && context?.user?.fid) {
        try {
          const response = await fetch(
            `/api/plan/getPlan/${tokenAddress}/${context.user.fid}`
          );
          const result: TokenApiResponse = await response.json();

          if (result.success) {
            const tokenData = result.data;
            console.log("Token data:", tokenData);
            console.log("hasActivePlan:", tokenData.hasActivePlan);
            console.log("plansOut:", tokenData.plansOut);
            console.log("plansOut length:", tokenData.plansOut?.length);
            setToken({
              name: tokenData.name,
              icon: tokenData.image_url || "₿", // Fallback to Bitcoin symbol if no image
              price: parseFloat(tokenData.price_usd) || 0,
              symbol: tokenData.symbol,
              decimals: tokenData.decimals,
              stats: {
                oneYearAgo: 0, // This data is not available in the API response
                invested: tokenData.totalInvestedValue || 0,
                currentValue: tokenData.currentValue || 0,
                percentChange: tokenData.percentChange || 0,
                marketCap: parseFloat(tokenData.total_reserve_in_usd) || 0,
                fdv: parseFloat(tokenData.fdv_usd) || 0,
                circSupply: parseFloat(tokenData.normalized_total_supply) || 0,
                totalSupply: parseFloat(tokenData.normalized_total_supply) || 0,
              },
              // about: `Information about ${tokenData.name} (${tokenData.symbol}) token.`,
              about:
                tokenData?.about ||
                `Information about ${tokenData.name} (${tokenData.symbol}) token.`,
              hasActivePlan: tokenData.hasActivePlan,
              feeTier: tokenData.feeTier,
            });
            // Set active plan if exists
            if (tokenData.plansOut && tokenData.plansOut.length > 0) {
              setActivePlan(tokenData.plansOut[0]);
            } else {
              setActivePlan(null);
            }
            await sdk.actions.ready({});
          }
        } catch (error) {
          console.error("Error fetching token data:", error);
        }
      }
    };

    fetchTokenData();
  }, [tokenAddress, context]);

  // Show loading if SDK is not loaded yet
  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-black text-white p-4 font-sans flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans flex flex-col relative">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push("/")}
            className="text-white hover:text-white transition-colors"
          >
            ←
          </button>
          <div className="flex items-center space-x-2">
            {token.icon ? (
              <Image
                src={token.icon}
                alt="Token Icon"
                className="w-8 h-8 rounded-full object-cover border-2 border-orange-700"
                width={32}
                height={32}
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-gray-700 bg-[#1E1E1F] flex items-center justify-center">
                <span className="text-lg">{token.name[0]}</span>
              </div>
            )}
            <span className="text-lg font-medium">{token.name}</span>
          </div>
        </div>
        <BalanceDisplay />
      </div>

      {/* Dots Row */}
      {/* <div className="flex justify-center items-center my-2">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="mx-0.5 text-2xl"
            style={{ color: "#3A3A3A" }}
          >
            •
          </span>
        ))}
      </div> */}

      {/* Price & Chart Section */}
      <div className="bg-[#131313] rounded-xl p-6 mb-6">
        <div className="text-gray-400 text-sm mb-1">Price</div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-4xl font-light">
              ${Number(token.price).toFixed(2)}
            </div>
          </div>
          <div className="flex space-x-1 bg-[#1E1E1F] rounded px-4">
            {["1H", "D", "W", "M"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                  selectedPeriod === period
                    ? "bg-black text-white"
                    : "text-white"
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
            src={`https://www.geckoterminal.com/base/pools/${tokenAddress}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=${getResolution(
              selectedPeriod
            )}`}
            frameBorder="0"
            allow="clipboard-write"
            allowFullScreen
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-[#131313] rounded-xl p-6 mb-6">
        <div className="text-lg font-medium mb-4">Stats</div>
        {token.hasActivePlan && token.stats.invested > 0 ? (
          <div className="bg-[#1E1E1F] rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="text-white text-sm">Total invested</div>
                <div className="text-white text-xl font-medium">
                  ${token.stats.invested.toFixed(1)}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <div
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      token.stats.percentChange >= 0
                        ? "bg-green-400/20 text-green-400"
                        : "bg-red-400/20 text-red-400"
                    }`}
                  >
                    {token.stats.percentChange >= 0 ? "+" : ""}
                    {token.stats.percentChange.toFixed(2)}%
                  </div>
                  <div className="text-white text-sm">Current value</div>
                </div>
                <div
                  className={`text-xl font-medium ${
                    token.stats.percentChange >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  ${token.stats.currentValue.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-white">Market cap</span>
            <span className="text-white font-medium">
              ${formatNumber(token.stats.marketCap)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white">FDV</span>
            <span className="text-white font-medium">
              ${formatNumber(token.stats.fdv)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white">Circulating supply</span>
            <span className="text-white font-medium">
              {formatNumber(token.stats.circSupply)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white">Total supply</span>
            <span className="text-white font-medium">
              {formatNumber(token.stats.totalSupply)}
            </span>
          </div>
        </div>
      </div>

      {/* Frequency Bubble (if active plan) - Now foldable */}
      {token.hasActivePlan && activePlan && (
        <div className="bg-[#131313] rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFrequencyExpanded(!isFrequencyExpanded)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  className={`transform transition-transform ${
                    isFrequencyExpanded ? "rotate-180" : ""
                  }`}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="text-lg font-medium">Frequency</span>
            </div>
            <button
              className="text-orange-400 text-base flex items-center gap-1 hover:underline"
              onClick={() => setShowEditFrequency(true)}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path
                  d="M15.232 5.232a3 3 0 1 1 4.243 4.243L7.5 21H3v-4.5l12.232-12.268Z"
                  stroke="#FF9100"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Edit
            </button>
          </div>

          {/* Always show amount and frequency */}
          <div className="bg-[#1E1E1F] rounded-lg p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Amount</span>
              <span className="text-white text-lg font-medium">
                ${Number(activePlan.amountIn) / 1_000_000}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Frequency</span>
              <span className="text-white text-lg font-medium">
                {(() => {
                  switch (activePlan.frequency) {
                    case 3600:
                      return "Hourly";
                    case 86400:
                      return "Daily";
                    case 604800:
                      return "Weekly";
                    case 2592000:
                      return "Monthly";
                    default:
                      // Handle minute-based frequencies
                      if (activePlan.frequency < 3600) {
                        return `${activePlan.frequency / 60} minutes`;
                      } else {
                        return `${activePlan.frequency / 3600}h`;
                      }
                  }
                })()}
              </span>
            </div>
          </div>

          {/* Only show danger zone when expanded */}
          {isFrequencyExpanded && (
            <div className="mt-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="text-red-400 text-sm mb-2">Danger Zone</div>
                <div className="text-gray-300 text-sm mb-3">
                  This will permanently stop your DCA position. You&apos;ll keep
                  any tokens you&apos;ve already purchased.
                </div>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg w-full disabled:bg-gray-600 disabled:text-white"
                  onClick={handleCancelPlan}
                  disabled={isCancelling || isCancellingPlan}
                >
                  {isCancelling || isCancellingPlan
                    ? "Cancelling..."
                    : "Stop Position"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* About Section - Now foldable */}
      <div className="bg-[#131313] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsAboutExpanded(!isAboutExpanded)}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              className={`transform transition-transform ${
                isAboutExpanded ? "rotate-180" : ""
              }`}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="text-lg font-medium">About</div>
        </div>

        <div className="text-gray-300 text-sm leading-relaxed">
          {isAboutExpanded ? (
            token.about
          ) : (
            <div>
              {token.about.length > 150
                ? `${token.about.substring(0, 150)}...`
                : token.about}
            </div>
          )}
        </div>
      </div>

      {/* Spacer for floating button */}
      <div className="h-24" />

      {/* Floating Invest Button (always visible) */}
      <div className="fixed bottom-0 left-0 w-full px-4 pb-4 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-4 rounded-xl w-full shadow-lg disabled:bg-gray-600 disabled:text-white"
            onClick={() => {
              if (token.hasActivePlan) {
                setShowTokenApproval(true);
              } else if (frequencyData) {
                setShowTokenApproval(true);
              } else {
                setShowSetFrequency(true);
              }
            }}
            disabled={!context?.user?.fid}
          >
            {token.hasActivePlan
              ? "Allow more USDC"
              : frequencyData
              ? "Approve USDC"
              : `Invest in ${token.symbol}`}
          </Button>
        </div>
      </div>
      <SetFrequencyPopup
        open={showSetFrequency}
        onClose={() => setShowSetFrequency(false)}
        onConfirm={(amount, frequency, planHash) => {
          setFrequencyData({ amount, frequency });
          setPendingPlanHash(planHash);
          setShowSetFrequency(false);
          setTimeout(() => setShowTokenApproval(true), 200);
        }}
        tokenOut={tokenAddress as `0x${string}`}
        fid={context?.user?.fid}
        feeTier={token.feeTier}
      />
      <TokenApprovalPopup
        open={showTokenApproval}
        onClose={() => setShowTokenApproval(false)}
        onApprove={(amount) => {
          setShowTokenApproval(false);
          setPendingPlanHash(undefined); // Clear the pending plan hash
          console.log("USDC approval completed for amount:", amount);
        }}
        token="USDC"
        defaultAmount={frequencyData?.amount || 100}
        tokenOutAddress={tokenAddress as `0x${string}`}
        fid={context?.user?.fid}
        planHash={pendingPlanHash}
      />
      {/* Edit Frequency Popup (reusing SetFrequencyPopup) */}
      <SetFrequencyPopup
        open={showEditFrequency}
        onClose={() => setShowEditFrequency(false)}
        onConfirm={async (amount, frequency, planHash) => {
          setShowEditFrequency(false);
          // Refetch plan data
          if (context?.user?.fid) {
            const response = await fetch(
              `/api/plan/getPlan/${tokenAddress}/${context.user.fid}`
            );
            const result: TokenApiResponse = await response.json();
            if (
              result.success &&
              result.data.plansOut &&
              result.data.plansOut.length > 0
            ) {
              setActivePlan(result.data.plansOut[0]);
            }
          }
        }}
        tokenOut={tokenAddress as `0x${string}`}
        fid={context?.user?.fid}
        feeTier={token.feeTier}
        // Pass initial values for edit mode
        initialAmount={
          activePlan ? Number(activePlan.amountIn) / 1_000_000 : 10
        }
        initialFrequency={(() => {
          if (!activePlan) return "Daily";
          switch (activePlan.frequency) {
            case 3600:
              return "Hourly";
            case 86400:
              return "Daily";
            case 604800:
              return "Weekly";
            case 2592000:
              return "Monthly";
            default:
              // Handle minute-based frequencies
              if (activePlan.frequency < 3600) {
                return `${activePlan.frequency / 60} minutes`;
              } else {
                return "Daily"; // fallback for unknown frequencies
              }
          }
        })()}
        editMode={true}
      />
    </div>
  );
};

export default TokenPage;
