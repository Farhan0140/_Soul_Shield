export default function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="h-5 bg-slate-100 rounded-full w-20 mt-2" />
        </div>
      </div>
    </div>
  );
}