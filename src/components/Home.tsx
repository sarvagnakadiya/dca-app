import React from "react";
import PositionTile from "./ui/PositionTile";

const Home = () => {
  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-medium">Home</h1>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-gray-400">💰</span>
            <span>$2,000</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500"></div>
        </div>
      </div>

      {/* Portfolio Balance Section */}
      <div className="mb-8">
        <div className="text-gray-400 text-sm mb-2">Portfolio balance</div>
        <div className="text-4xl font-light mb-4">$3,234.43</div>

        {/* Time Period Selector */}
        <div className="flex space-x-4 text-sm mb-6">
          <button className="text-orange-400 border-b border-orange-400 pb-1">
            7D
          </button>
          <button className="text-gray-400 hover:text-white">1M</button>
          <button className="text-gray-400 hover:text-white">1Y</button>
          <button className="text-gray-400 hover:text-white">5Y</button>
        </div>

        {/* Chart */}
        <div className="relative h-32 mb-8">
          <svg className="w-full h-full" viewBox="0 0 400 120">
            <defs>
              <linearGradient
                id="chartGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line
              x1="0"
              y1="20"
              x2="400"
              y2="20"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="40"
              x2="400"
              y2="40"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="60"
              x2="400"
              y2="60"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="80"
              x2="400"
              y2="80"
              stroke="#333"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="100"
              x2="400"
              y2="100"
              stroke="#333"
              strokeWidth="0.5"
            />

            {/* Chart path */}
            <path
              d="M 0 80 Q 80 75 120 70 T 200 65 Q 280 60 320 55 T 400 45"
              fill="url(#chartGradient)"
              stroke="#f97316"
              strokeWidth="2"
              fillRule="evenodd"
            />
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-12">
            <span>$3100</span>
            <span>$500</span>
            <span>$200</span>
            <span>$100</span>
          </div>
        </div>
      </div>

      {/* DCA Positions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">DCA Positions</h2>

        <PositionTile
          icon="₿"
          iconBgColor="bg-orange-500"
          name="Bitcoin"
          currentPrice="$106,093.76"
          timeInfo="7 years ago"
          investedAmount="$3,234.43"
          currentValue="$3,234.43"
        />

        <PositionTile
          icon="Ξ"
          iconBgColor="bg-blue-500"
          name="Ethereum"
          currentPrice="$4,000.34"
          timeInfo="3 years ago"
          investedAmount="$3,234.43"
          currentValue="$3,234.43"
        />

        <PositionTile
          icon="S"
          iconBgColor="bg-gradient-to-r from-purple-400 to-pink-400"
          name="Solana"
          currentPrice="$4,000.34"
          timeInfo="1 years ago"
          investedAmount="$3,234.43"
          currentValue="$3,234.43"
        />
      </div>

      {/* Explore More Tokens */}
      <div>
        <h2 className="text-lg font-medium mb-4">Explore more tokens</h2>

        <PositionTile
          icon="P"
          iconBgColor="bg-purple-600"
          name="Pol"
          currentPrice="$0.59"
          timeInfo="1 years ago: $0.01"
          isExplore={true}
          ifInvestedAmount="$100"
          ifCurrentValue="$1,380"
        />

        <PositionTile
          icon="P"
          iconBgColor="bg-purple-600"
          name="Pol"
          currentPrice="$0.59"
          timeInfo="1 years ago: $0.01"
          isExplore={true}
          ifInvestedAmount="$100"
          ifCurrentValue="$1,380"
        />
      </div>
    </div>
  );
};

export default Home;
