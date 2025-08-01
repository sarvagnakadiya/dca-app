import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import { base } from "viem/chains";
import { waitForTransactionReceipt } from "viem/actions";
import { createPublicClient, http } from "viem";

interface SetFrequencyPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, frequency: string) => void;
  tokenOut: `0x${string}`;
  fid?: number;
  feeTier: number;
  initialAmount?: number;
  initialFrequency?: string;
  editMode?: boolean;
}

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const quickAmounts = [5, 10, 50, 100, 500, 1000];

// Create a public client for waiting for transaction receipt
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export const SetFrequencyPopup: React.FC<SetFrequencyPopupProps> = ({
  open,
  onClose,
  onConfirm,
  tokenOut,
  fid,
  feeTier,
  initialAmount = 10,
  initialFrequency = "Daily",
  editMode = false,
}) => {
  const [amount, setAmount] = useState(initialAmount);
  const [frequency, setFrequency] = useState(initialFrequency);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [amountError, setAmountError] = useState(false);
  const { address } = useAccount();
  const DCA_EXECUTOR_ADDRESS = process.env
    .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

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

  const getFrequencyInSeconds = (frequency: string): number => {
    switch (frequency) {
      case "Hourly":
        return 3600; // 1 hour
      case "Daily":
        return 86400; // 24 hours
      case "Weekly":
        return 604800; // 7 days
      case "Monthly":
        return 2592000; // 30 days
      default:
        return 86400; // Default to daily
    }
  };

  const handleConfirm = async () => {
    if (!address) return;
    if (!amount || amount === 0) {
      setAmountError(true);
      return;
    }

    try {
      setIsLoading(true);

      if (editMode) {
        // Update existing plan
        console.log("Updating plan frequency...");

        let freqSeconds = 86400;
        switch (frequency) {
          case "Hourly":
            freqSeconds = 3600;
            break;
          case "Daily":
            freqSeconds = 86400;
            break;
          case "Weekly":
            freqSeconds = 604800;
            break;
          case "Monthly":
            freqSeconds = 2592000;
            break;
          default:
            freqSeconds = 86400;
        }

        console.log("Updating plan frequency...");
        console.log("freqSeconds", freqSeconds);
        console.log("fid", fid);
        console.log("amount", amount);
        console.log("tokenOut", tokenOut);
        console.log("address", address);

        const response = await fetch("/api/plan/updateFrequency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            tokenOutAddress: tokenOut,
            amountIn: amount * 1_000_000,
            frequency: freqSeconds,
            fid: fid,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to update plan");
        }

        console.log("Plan updated successfully");
        onConfirm(amount, frequency);
        setIsLoading(false);
        return;
      }

      // Create new plan
      console.log("Creating plan...");
      console.log("USDC_ADDRESS", USDC_ADDRESS);
      console.log("tokenOut", tokenOut);
      console.log("address", address);
      console.log("feeTier:", feeTier);

      const hash = await createPlan({
        address: DCA_EXECUTOR_ADDRESS as `0x${string}`,
        abi: DCA_ABI.abi,
        functionName: "createPlan",
        args: [tokenOut, address],
      });

      console.log("Txn hash:", hash);
      setTxHash(hash);

      // Wait for transaction confirmation
      const receipt = await waitForTransactionReceipt(publicClient, {
        hash: hash,
      });
      console.log("Receipt received:", receipt);

      // Call API to create plan in database (planHash will be generated offchain)
      const response = await fetch("/api/plan/createPlan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress: tokenOut,
          recipient: address,
          amountIn: amount * 1000000, // Convert to wei for USDC (6 decimals)
          frequency: getFrequencyInSeconds(frequency),
          fid: fid,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create plan in database");
      }

      console.log("Plan created successfully");
      onConfirm(amount, frequency);
      setIsLoading(false);
    } catch (error) {
      console.error("Error creating plan:", error);
      setIsLoading(false);
    }
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold text-white">Set frequency</span>
        <button className="text-orange-400 text-lg" onClick={onClose}>
          × Close
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-gray-400 mb-1">Amount</label>
        <Input
          type="number"
          value={amount === 0 ? (amountError ? "" : "0") : amount}
          min={1}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              setAmount(0);
              setAmountError(true);
            } else {
              const num = Number(val);
              setAmount(num);
              setAmountError(num === 0);
            }
          }}
          className={`bg-[#333333] text-white border-2 rounded-md ${
            amountError ? "border-red-500" : "border-[#333333]"
          }`}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            className={`py-2 rounded-2xl text-lg font-medium transition-colors bg-[#333333] text-white hover:bg-orange-500 hover:text-white ${
              amount === amt ? "bg-orange-500 text-white" : ""
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
          className="w-full bg-[#333333] text-white border-none rounded-md px-3 py-2"
        >
          <option value="Hourly">Hourly</option>
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
        </select>
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleConfirm}
        disabled={isLoading}
      >
        {isLoading
          ? editMode
            ? "Updating Plan..."
            : "Creating Plan..."
          : "Confirm"}
      </Button>
    </BottomSheetPopup>
  );
};
