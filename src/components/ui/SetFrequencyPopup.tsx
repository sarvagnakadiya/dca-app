import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";

interface SetFrequencyPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, frequency: string) => void;
}

export const SetFrequencyPopup: React.FC<SetFrequencyPopupProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState(10);
  const [frequency, setFrequency] = useState("Daily");

  const handleConfirm = () => {
    onConfirm(amount, frequency);
  };

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
      <div className="mb-6">
        <label className="block text-gray-400 mb-1">Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-md px-3 py-2"
        >
          <option value="Daily">Daily</option>
          <option value="Monthly">Monthly</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleConfirm}
      >
        Confirm
      </Button>
    </BottomSheetPopup>
  );
};
