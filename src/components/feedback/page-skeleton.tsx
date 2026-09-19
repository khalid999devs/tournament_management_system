type PageSkeletonProps = {
  label: string;
  blocks?: number;
};

export function PageSkeleton({ label, blocks = 3 }: PageSkeletonProps) {
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
      <div className="page-skeleton-grid">
        {Array.from({ length: blocks }, (_, index) => (
          <div className="skeleton skeleton-card" key={index} />
        ))}
      </div>
    </div>
  );
}
