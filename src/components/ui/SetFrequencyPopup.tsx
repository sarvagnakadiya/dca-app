import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { DCA_ABI } from "~/lib/contracts/abi";
import { base } from "viem/chains";
import { waitForTransactionReceipt } from "viem/actions";
import { createPublicClient, http } from "viem";

interface SetFrequencyPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, frequency: string) => void;
  tokenOut: `0x${string}`;
  fid?: number;
}

const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const quickAmounts = [5, 10, 50, 100, 500, 1000];

// Create a public client for waiting for transaction receipt
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// TODO: Temporary function to get the best pool for any token with USDC
const getBestPool = (tokenAddress: `0x${string}`): { feeTier: number } => {
  // Static mappings based on the comments in the code
  const poolMappings: Record<string, { feeTier: number }> = {
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf": {
      feeTier: 500,
    },
    "0xcbD06E5A2B0C65597161de254AA074E489dEb510": {
      feeTier: 3000,
    },
    "0x4200000000000000000000000000000000000006": {
      feeTier: 3000,
    },
  };

  // Return the mapped pool if it exists, otherwise return a default
  return (
    poolMappings[tokenAddress.toLowerCase()] || {
      feeTier: 3000, // Default fee tier
    }
  );
};

export const SetFrequencyPopup: React.FC<SetFrequencyPopupProps> = ({
  open,
  onClose,
  onConfirm,
  tokenOut,
  fid,
}) => {
  const [amount, setAmount] = useState(10);
  const [frequency, setFrequency] = useState("Daily");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { address } = useAccount();
  const DCA_EXECUTOR_ADDRESS = "0x44E567a0C93F49E503900894ECc508153e6FB77c";

  const {
    writeContractAsync: createPlan,
    isPending,
    error,
    isSuccess,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    data: receipt,
    isSuccess: isConfirmed,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  // Debug logs
  React.useEffect(() => {
    console.log("Debug - txHash:", txHash);
    console.log("Debug - isConfirmed:", isConfirmed);
    console.log("Debug - isConfirming:", isConfirming);
    console.log("Debug - receipt:", receipt);
  }, [txHash, isConfirmed, isConfirming, receipt]);

  const getDurationInSeconds = (frequency: string): number => {
    const now = Math.floor(Date.now() / 1000);
    switch (frequency) {
      case "Hourly":
        return now + 3600; // 1 hour
      case "Daily":
        return now + 86400; // 24 hours
      case "Weekly":
        return now + 604800; // 7 days
      case "Monthly":
        return now + 2592000; // 30 days
      default:
        return now + 86400; // Default to daily
    }
  };

  const handleConfirm = async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      console.log("Creating plan...");
      console.log("USDC_ADDRESS", USDC_ADDRESS);
      console.log("tokenOut", tokenOut);
      console.log("address", address);

      // Get the best pool for the token pair
      const bestPool = getBestPool(tokenOut);
      console.log("Best pool:", bestPool);

      const hash = await createPlan({
        address: DCA_EXECUTOR_ADDRESS as `0x${string}`,
        abi: DCA_ABI,
        functionName: "createPlan",
        args: [USDC_ADDRESS, tokenOut, address],
      });

      console.log("Txn hash:", hash);
      setTxHash(hash);

      const receipt = await waitForTransactionReceipt(publicClient, {
        hash: hash,
      });
      console.log("Receipt received:", receipt);

      const planCreatedEvent = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === DCA_EXECUTOR_ADDRESS.toLowerCase() &&
          log.topics[0] ===
            "0x96a20ecfde31e96fea1bd76dd04311297b8590465d3f75c15b07c059ea43e9b5"
      );

      if (!planCreatedEvent) throw new Error("PlanCreated event not found");

      const planIdHex = planCreatedEvent.topics[2];
      const planId = parseInt(planIdHex as `0x${string}`, 16);

      console.log("PlanId:", planId);

      // Call API with the extracted planId
      const response = await fetch("/api/plan/createPlan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          tokenInAddress: USDC_ADDRESS,
          tokenOutAddress: tokenOut,
          recipient: address,
          amountIn: amount * 1000000, // Convert to wei for USDC (6 decimals)
          approvalAmount: 0,
          frequency: getDurationInSeconds(frequency),
          feeTier: bestPool.feeTier, // Use dynamic fee tier from best pool
          fid: fid,
          planId: planId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create plan in database");
      }

      console.log("Plan created successfully with planId:", planId);
      onConfirm(amount, frequency);
      setIsLoading(false);

      // Wait for transaction confirmation and extract planId
      // The planId will be extracted in the useEffect below when receipt is available
    } catch (error) {
      console.error("Error creating plan:", error);
      setIsLoading(false);
    }
  };

  // Extract planId from transaction receipt when confirmed
  // React.useEffect(() => {
  //   console.log("Main useEffect triggered");
  //   console.log("isConfirmed:", isConfirmed);
  //   console.log("receipt:", receipt);
  //   console.log("txHash:", txHash);

  //   if (isConfirmed && receipt && txHash) {
  //     console.log("Transaction confirmed, extracting planId from logs...");

  //     // Get the best pool for the token pair
  //     const bestPool = getBestPool(tokenOut);

  //     // Look for the PlanCreated event
  //     const planCreatedEvent = receipt.logs.find((log) => {
  //       // Check if this log is from our DCA contract
  //       return (
  //         log.address.toLowerCase() === DCA_EXECUTOR_ADDRESS.toLowerCase() &&
  //         log.topics[0] ===
  //           "0x96a20ecfde31e96fea1bd76dd04311297b8590465d3f75c15b07c059ea43e9b5"
  //       );
  //     });

  //     if (planCreatedEvent) {
  //       console.log("Found PlanCreated event:", planCreatedEvent);

  //       // Extract planId from the second topic (index 1)
  //       // PlanCreated (index_topic_1 address user, index_topic_2 uint256 planId, index_topic_3 address tokenIn, address tokenOut, address recipient)
  //       const planIdHex = planCreatedEvent.topics[2]; // planId is at index 2 (second indexed parameter)
  //       const planId = parseInt(planIdHex as `0x${string}`, 16);

  //       console.log("Extracted planId:", planId);

  //       // Call API with the extracted planId
  //       const callApiWithPlanId = async () => {
  //         try {
  //           const response = await fetch("/api/plan/createPlan", {
  //             method: "POST",
  //             headers: {
  //               "Content-Type": "application/json",
  //             },
  //             body: JSON.stringify({
  //               userAddress: address,
  //               tokenInAddress: USDC_ADDRESS,
  //               tokenOutAddress: tokenOut,
  //               recipient: address,
  //               amountIn: amount * 1000000, // Convert to wei for USDC (6 decimals)
  //               approvalAmount: 0,
  //               frequency: getDurationInSeconds(frequency),
  //               feeTier: bestPool.feeTier, // Use dynamic fee tier from best pool
  //               fid: fid,
  //               planId: planId, // Include the extracted planId
  //               transactionHash: txHash,
  //             }),
  //           });

  //           const data = await response.json();

  //           if (!data.success) {
  //             throw new Error(
  //               data.error || "Failed to create plan in database"
  //             );
  //           }

  //           console.log("Plan created successfully with planId:", planId);
  //           onConfirm(amount, frequency);
  //         } catch (error) {
  //           console.error("Error calling API with planId:", error);
  //         } finally {
  //           setIsLoading(false);
  //         }
  //       };

  //       callApiWithPlanId();
  //     } else {
  //       console.error("PlanCreated event not found in transaction logs");
  //       console.log("All logs:", receipt.logs);
  //       setIsLoading(false);
  //     }
  //   } else {
  //     console.log(
  //       "Condition not met - isConfirmed:",
  //       isConfirmed,
  //       "receipt:",
  //       !!receipt,
  //       "txHash:",
  //       !!txHash
  //     );
  //   }
  // }, [
  //   isConfirmed,
  //   receipt,
  //   address,
  //   tokenOut,
  //   amount,
  //   frequency,
  //   fid,
  //   onConfirm,
  // ]);

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold">Set frequency</span>
        <button className="text-orange-400 text-lg" onClick={onClose}>
          × Close
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-gray-400 mb-1">Amount</label>
        <Input
          type="number"
          value={amount}
          min={1}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-gray-800 text-white border-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            className={`py-2 rounded-lg text-lg font-medium transition-colors bg-gray-800 text-white hover:bg-orange-500 hover:text-black ${
              amount === amt ? "bg-orange-500 text-black" : ""
            }`}
            onClick={() => setAmount(amt)}
          >
            ${amt}
          </button>
        ))}
      </div>
      <div className="mb-6">
        <label className="block text-gray-400 mb-1">Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-md px-3 py-2"
        >
          <option value="Hourly">Hourly</option>
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleConfirm}
        disabled={isLoading}
      >
        {isLoading ? "Creating Plan..." : "Confirm"}
      </Button>
    </BottomSheetPopup>
  );
};
