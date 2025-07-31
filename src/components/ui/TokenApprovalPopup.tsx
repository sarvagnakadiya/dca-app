import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";

interface TokenApprovalPopupProps {
  open: boolean;
  onClose: () => void;
  onApprove: (amount: number) => void;
  token?: string;
  defaultAmount?: number;
}

const quickAmounts = [5, 10, 50, 100, 500, 1000];

export const TokenApprovalPopup: React.FC<TokenApprovalPopupProps> = ({
  open,
  onClose,
  onApprove,
  token = "USDC",
  defaultAmount = 100,
}) => {
  const [amount, setAmount] = useState(defaultAmount);

  const handleApprove = () => {
    onApprove(amount);
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
      <div className="mb-4 p-3 bg-gray-800 rounded-lg text-gray-300 text-sm">
        Set a spending limit for your DCA investments. When the limit is
        reached, you can easily top it up or revoke access anytime for complete
        control over your automated purchases.
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleApprove}
      >
        Approve {amount} {token}
      </Button>
    </BottomSheetPopup>
  );
};
