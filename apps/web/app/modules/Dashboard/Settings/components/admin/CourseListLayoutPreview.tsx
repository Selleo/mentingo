interface CourseListLayoutPreviewProps {
  type: "classic" | "modern";
}

export function CourseListLayoutPreview({ type }: CourseListLayoutPreviewProps) {
  if (type === "modern") {
    return (
      <div className="bg-white rounded border border-[#e5e7eb] p-4 h-[400px] overflow-hidden">
        {/* Hero Section Skeleton */}
        <div className="relative h-[140px] bg-gradient-to-br from-[#6b7280] to-[#9ca3af] rounded overflow-hidden mb-4">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent"></div>
          <div className="absolute bottom-4 left-4 space-y-2">
            <div className="h-[8px] w-[80px] bg-white/50 rounded"></div>
            <div className="h-[14px] w-[180px] bg-white/70 rounded"></div>
            <div className="h-[10px] w-[140px] bg-white/50 rounded"></div>
            <div className="flex gap-2 mt-2">
              <div className="h-[6px] w-[40px] bg-white/40 rounded"></div>
              <div className="h-[6px] w-[40px] bg-white/40 rounded"></div>
              <div className="h-[6px] w-[40px] bg-white/40 rounded"></div>
            </div>
          </div>
        </div>

        {/* Continue Learning Section */}
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-semibold text-[#374151]">Continue learning</p>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 bg-[#f3f4f6] rounded p-2 space-y-1.5">
                <div className="h-[30px] bg-[#e5e7eb] rounded"></div>
                <div className="h-[6px] w-full bg-[#e5e7eb] rounded"></div>
                <div className="h-[6px] w-[80%] bg-[#e5e7eb] rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Courses Section */}
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-semibold text-[#374151]">Top 5 courses</p>
          <div className="flex gap-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex-1 bg-[#f3f4f6] rounded p-2 space-y-1.5">
                <div className="h-[50px] bg-[#e5e7eb] rounded relative">
                  <div className="absolute top-1 left-1.5 text-[24px] font-bold text-[#9ca3af]">
                    {num}
                  </div>
                </div>
                <div className="h-[6px] w-full bg-[#e5e7eb] rounded"></div>
                <div className="h-[6px] w-[70%] bg-[#e5e7eb] rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Grid */}
        <div className="space-y-2">
          <div className="h-[8px] w-[90px] bg-[#d1d5db] rounded"></div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-[35px] bg-[#e5e7eb] rounded"></div>
                <div className="h-[5px] w-full bg-[#f3f4f6] rounded"></div>
                <div className="h-[5px] w-[60%] bg-[#f3f4f6] rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Classic Layout
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-4 h-[400px] overflow-hidden">
      {/* Continue learning section */}
      <div className="space-y-2 mb-4">
        <p className="text-[11px] font-semibold text-[#374151]">Continue learning</p>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 bg-[#f3f4f6] rounded p-2 space-y-1.5">
              <div className="h-[50px] bg-[#e5e7eb] rounded"></div>
              <div className="h-[6px] w-full bg-[#e5e7eb] rounded"></div>
              <div className="h-[6px] w-[70%] bg-[#e5e7eb] rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Available courses section */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-[#374151]">Available courses</p>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-[#f3f4f6] rounded p-2 space-y-1.5">
              <div className="h-[50px] bg-[#e5e7eb] rounded"></div>
              <div className="h-[6px] w-full bg-[#e5e7eb] rounded"></div>
              <div className="h-[6px] w-[85%] bg-[#e5e7eb] rounded"></div>
              <div className="h-[6px] w-[60%] bg-[#e5e7eb] rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
