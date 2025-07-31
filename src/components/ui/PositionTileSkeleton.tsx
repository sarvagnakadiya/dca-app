import React from "react";

const PositionTileSkeleton: React.FC = () => (
  <div className="bg-[#1F1F1F] rounded-2xl p-4 mb-2 shadow-lg animate-pulse">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {/* Icon skeleton */}
        <div className="w-8 h-8 bg-gray-600 rounded-full animate-pulse" />
        {/* Name skeleton */}
        <div className="h-5 bg-gray-600 rounded w-20 animate-pulse" />
        {/* Price badge skeleton */}
        <div className="h-5 bg-gray-600 rounded-xl w-16 animate-pulse" />
      </div>
      <div className="flex items-center gap-1">
        {/* Calendar icon skeleton */}
        <div className="w-4 h-4 bg-gray-600 rounded animate-pulse" />
        {/* Date text skeleton */}
        <div className="h-3 bg-gray-600 rounded w-16 animate-pulse" />
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-dashed border-[#353535] mb-4" />

    {/* Bottom section */}
    <div className="flex justify-between items-end">
      <div>
        {/* Label skeleton */}
        <div className="h-2 bg-gray-600 rounded w-16 mb-1 animate-pulse" />
        {/* Value skeleton */}
        <div className="h-6 bg-gray-600 rounded w-20 animate-pulse" />
      </div>
      <div className="text-right">
        {/* Label skeleton */}
        <div className="h-2 bg-gray-600 rounded w-16 mb-1 animate-pulse" />
        {/* Value skeleton */}
        <div className="h-6 bg-gray-600 rounded w-20 animate-pulse" />
      </div>
    </div>
  </div>
);

export default PositionTileSkeleton;
