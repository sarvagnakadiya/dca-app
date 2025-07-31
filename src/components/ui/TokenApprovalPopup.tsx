import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { USDC_ABI } from "~/lib/contracts/abi";

interface TokenApprovalPopupProps {
  open: boolean;
  onClose: () => void;
  onApprove: (amount: number) => void;
  token?: string;
  defaultAmount?: number;
  tokenOutAddress?: `0x${string}`;
  fid?: number;
}

const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const DCA_EXECUTOR_ADDRESS = "0x44E567a0C93F49E503900894ECc508153e6FB77c";
const quickAmounts = [5, 10, 50, 100, 500, 1000];

export const TokenApprovalPopup: React.FC<TokenApprovalPopupProps> = ({
  open,
  onClose,
  onApprove,
  token = "USDC",
  defaultAmount = 100,
  tokenOutAddress,
  fid,
}) => {
  const [amount, setAmount] = useState(defaultAmount);
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount();

  const { writeContractAsync: approveToken, isPending } = useWriteContract();

  // Check current allowance
  const { data: currentAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  const handleApprove = async () => {
    if (!address) return;

    try {
      setIsLoading(true);

      // Convert amount to USDC decimals (6 decimals)
      const amountInWei = BigInt(amount * 1000000);

      console.log("Approving USDC...");
      console.log("Amount:", amount, "USDC");
      console.log("Amount in wei:", amountInWei.toString());
      console.log("DCA Executor Address:", DCA_EXECUTOR_ADDRESS);

      const hash = await approveToken({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, amountInWei],
      });

      console.log("Approval transaction hash:", hash);

      // Update the approval amount in the database if we have the required data
      if (tokenOutAddress && fid) {
        try {
          const response = await fetch("/api/plan/updateApprovalAmount", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userAddress: address,
              tokenOutAddress,
              approvalAmount: amountInWei.toString(),
              fid,
            }),
          });

          const data = await response.json();

          if (!data.success) {
            console.error("Failed to update approval amount:", data.error);
          } else {
            console.log("Approval amount updated successfully:", data);
          }
        } catch (error) {
          console.error("Error updating approval amount:", error);
        }
      }

      // Call the onApprove callback with the amount
      onApprove(amount);
    } catch (error) {
      console.error("Error approving USDC:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold">Approve {token}</span>
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
      {currentAllowance && currentAllowance > 0n && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
          Current allowance: {Number(currentAllowance) / 1000000} USDC
        </div>
      )}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg text-gray-300 text-sm">
        Set a spending limit for your DCA investments. When the limit is
        reached, you can easily top it up or revoke access anytime for complete
        control over your automated purchases.
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full disabled:bg-gray-600 disabled:text-gray-400"
        onClick={handleApprove}
        disabled={isLoading || isPending}
      >
        {isLoading || isPending ? "Approving..." : `Approve ${amount} ${token}`}
      </Button>
    </BottomSheetPopup>
  );
};
