import React from "react";

interface PositionTileProps {
  icon: string;
  iconBgColor: string;
  name: string;
  currentPrice: string;
  timeInfo: string;
  investedAmount?: string;
  currentValue?: string;
  isExplore?: boolean;
  ifInvestedAmount?: string;
  ifCurrentValue?: string;
}

const PositionTile: React.FC<PositionTileProps> = ({
  icon,
  iconBgColor,
  name,
  currentPrice,
  timeInfo,
  investedAmount,
  currentValue,
  isExplore = false,
  ifInvestedAmount,
  ifCurrentValue,
}) => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-8 h-8 ${iconBgColor} rounded-full flex items-center justify-center text-white font-bold text-sm`}
          >
            {icon}
          </div>
          <span className="font-medium">{name}</span>
          <span className="text-gray-400 text-sm">{currentPrice}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <span>📅</span>
          <span>{timeInfo}</span>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        {isExplore ? (
          <>
            <div>
              <div className="text-gray-400">If you invested</div>
              <div className="text-white">{ifInvestedAmount}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400">Current value</div>
              <div className="text-green-400">{ifCurrentValue}</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-gray-400">Total invested</div>
              <div className="text-white">{investedAmount}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400">Current value</div>
              <div className="text-white">{currentValue}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PositionTile;
