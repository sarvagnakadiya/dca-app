import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { USDC_ABI } from "~/lib/contracts/abi";
import { executeInitialInvestment, publicClient } from "~/lib/utils";
import { waitForTransactionReceipt } from "viem/actions";

interface TokenApprovalPopupProps {
  open: boolean;
  onClose: () => void;
  onApprove: (amount: number) => void;
  token?: string;
  defaultAmount?: number;
  tokenOutAddress?: `0x${string}`;
  fid?: number;
  planHash?: string; // Add planHash for initial investment execution
}

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const DCA_EXECUTOR_ADDRESS = process.env
  .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;
const quickAmounts = [5, 10, 50, 100, 500, 1000];

export const TokenApprovalPopup: React.FC<TokenApprovalPopupProps> = ({
  open,
  onClose,
  onApprove,
  token = "USDC",
  defaultAmount = 100,
  tokenOutAddress,
  fid,
  planHash,
}) => {
  const [amount, setAmount] = useState(defaultAmount);
  const [isLoading, setIsLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>("");
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

  // Function to check allowance with retry mechanism
  const checkAllowanceWithRetry = async (
    expectedAmount: bigint,
    maxRetries = 5
  ): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [
            address as `0x${string}`,
            DCA_EXECUTOR_ADDRESS as `0x${string}`,
          ],
        });

        console.log(
          `Allowance check attempt ${
            i + 1
          }: ${allowance.toString()}, Expected: ${expectedAmount.toString()}`
        );

        if (allowance >= expectedAmount) {
          console.log("Allowance confirmed:", allowance.toString());
          return true;
        }

        if (i < maxRetries - 1) {
          console.log(
            `Allowance not yet updated, waiting 2 seconds... (${
              i + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error checking allowance (attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    return false;
  };

  const handleApprove = async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      setApprovalStatus("Approving USDC...");

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
      setApprovalStatus("Waiting for approval confirmation...");

      // Wait for the approval transaction to be confirmed
      const receipt = await waitForTransactionReceipt(publicClient, {
        hash: hash,
      });

      console.log("Approval transaction confirmed:", receipt);
      setApprovalStatus("Approval confirmed! Waiting for state update...");

      // Add a delay to ensure blockchain state is updated
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Only execute initial investment if we have a planHash (indicating this is for a new plan)
      if (planHash) {
        console.log(
          "Executing initial investment after approval confirmation..."
        );

        // Convert amount to USDC decimals for allowance check
        const expectedAllowance = BigInt(amount * 1000000);

        // Check if allowance has been properly updated
        setApprovalStatus("Verifying allowance update...");
        const allowanceConfirmed = await checkAllowanceWithRetry(
          expectedAllowance
        );

        if (!allowanceConfirmed) {
          console.error("Allowance not properly updated after approval");
          setApprovalStatus(
            "Approval successful but allowance not yet reflected. Please try again in a few moments."
          );
          onApprove(amount);
          return;
        }

        console.log("USDC approval completed for amount:", amount);
        setApprovalStatus(
          "Allowance confirmed! Executing initial investment..."
        );

        // Add retry mechanism for database connection issues
        let investResult;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            investResult = await executeInitialInvestment(planHash);
            break; // Success, exit retry loop
          } catch (error) {
            retryCount++;
            console.log(`Investment attempt ${retryCount} failed:`, error);

            if (retryCount < maxRetries) {
              setApprovalStatus(
                `Investment failed, retrying... (${retryCount}/${maxRetries})`
              );
              // Wait 2 seconds before retrying
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        }

        if (investResult && investResult.success) {
          console.log(
            "Initial investment executed successfully:",
            investResult.txHash
          );
          setApprovalStatus("Initial investment executed successfully!");
        } else {
          console.error(
            "Failed to execute initial investment:",
            investResult?.error || "Unknown error"
          );
          setApprovalStatus(
            "Approval successful but investment failed. Please try again."
          );
        }
      } else {
        setApprovalStatus("Approval successful!");
      }

      // Call the onApprove callback with the amount
      onApprove(amount);
    } catch (error) {
      console.error("Error approving USDC:", error);
      setApprovalStatus("Approval failed. Please try again.");
    } finally {
      setIsLoading(false);
      // Clear status after a delay
      setTimeout(() => setApprovalStatus(""), 1000);
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
          value={amount.toString()}
          min={0.01}
          step={0.01}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-[#333333] text-white border-2 border-[#333333] rounded-md"
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
      {currentAllowance !== undefined && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
          Current allowance:{" "}
          {currentAllowance === 0n ? "0" : Number(currentAllowance) / 1000000}{" "}
          USDC
        </div>
      )}
      {approvalStatus && (
        <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm">
          {approvalStatus}
        </div>
      )}
      <div className="mb-4 p-3 bg-[#333333] rounded-lg text-gray-300 text-sm">
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
