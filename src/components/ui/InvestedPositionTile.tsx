import React from "react";
import Image from "next/image";

interface InvestedPositionTileProps {
  icon?: string;
  iconBgColor: string;
  name: string;
  currentPrice: string;
  startedAgo: string; // e.g., "7 years ago"
  investedAmount: string;
  currentValue: string;
}

const InvestedPositionTile: React.FC<InvestedPositionTileProps> = ({
  icon,
  iconBgColor,
  name,
  currentPrice,
  startedAgo,
  investedAmount,
  currentValue,
}) => (
  <div className="bg-[#1F1F1F] rounded-2xl p-4 mb-2 shadow-lg">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 ${iconBgColor} rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden`}
        >
          {icon ? (
            <Image
              src={icon}
              alt={name}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          ) : (
            name[0].toUpperCase()
          )}
        </div>
        <span className="text-base font-semibold text-white">{name}</span>
        <span className="bg-[#232323] text-white text-xs font-medium rounded-xl px-2 py-0.5 ml-1">
          {currentPrice}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3.75 7.5h16.5M4.5 21h15a.75.75 0 00.75-.75V7.5a.75.75 0 00-.75-.75h-15a.75.75 0 00-.75.75v12.75c0 .414.336.75.75.75z"
          />
        </svg>
        <span>{startedAgo}</span>
      </div>
    </div>
    <div className="border-t border-dashed border-[#353535] mb-4" />
    <div className="flex justify-between items-end">
      <div>
        <div className="uppercase text-gray-400 text-[10px] tracking-wider mb-0.5">
          Total Invested
        </div>
        <div className="text-lg font-bold text-white leading-tight">
          {investedAmount}
        </div>
      </div>
      <div className="text-right">
        <div className="uppercase text-gray-400 text-[10px] tracking-wider mb-0.5">
          Current value
        </div>
        <div className="text-lg font-bold text-white leading-tight">
          {currentValue}
        </div>
      </div>
    </div>
  </div>
);

export default InvestedPositionTile;
