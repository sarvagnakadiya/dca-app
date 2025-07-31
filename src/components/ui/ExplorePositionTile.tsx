import React from "react";
import Image from "next/image";

interface ExplorePositionTileProps {
  icon?: string;
  iconBgColor: string;
  name: string;
  currentPrice: string;
  price1YAgo: string; // e.g., "$0.01"
  ifInvestedAmount: string;
  ifCurrentValue: string;
}

const ExplorePositionTile: React.FC<ExplorePositionTileProps> = ({
  icon,
  iconBgColor,
  name,
  currentPrice,
  price1YAgo,
  ifInvestedAmount,
  ifCurrentValue,
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
        <span>1Y ago price: {price1YAgo}</span>
      </div>
    </div>
    <div className="border-t border-dashed border-[#353535] mb-4" />
    <div className="flex justify-between items-end">
      <div>
        <div className="uppercase text-gray-400 text-[6px] tracking-wider mb-0.5">
          If you invested
        </div>
        <div className="text-lg font-bold text-white leading-tight">
          {ifInvestedAmount}
        </div>
      </div>
      <div className="text-right">
        <div className="uppercase text-gray-400 text-[6px] tracking-wider mb-0.5">
          Current value
        </div>
        <div className="text-lg font-bold text-green-400 leading-tight">
          {ifCurrentValue}
        </div>
      </div>
    </div>
  </div>
);

export default ExplorePositionTile;
