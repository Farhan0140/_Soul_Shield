export default function SkeletonCard() {
  return (
    <div className="rounded-2xl border-2 border-border bg-surface p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-border" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-border rounded w-3/4" />
          <div className="h-3 bg-bg rounded w-1/2" />
          <div className="h-5 bg-bg rounded-full w-20 mt-2" />
        </div>
      </div>
    </div>
  );
}