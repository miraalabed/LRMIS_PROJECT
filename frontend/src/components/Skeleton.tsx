type SkeletonBlockProps = {
  width?: string;
  height?: string;
  className?: string;
};

export function SkeletonBlock({ width = '100%', height = '16px', className = '' }: SkeletonBlockProps) {
  return <span className={`skeleton-block ${className}`} style={{ width, height }} />;
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <section className="card-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card">
          <SkeletonBlock width="44%" height="14px" />
          <SkeletonBlock width="30%" height="34px" />
          <SkeletonBlock width="72%" height="12px" />
        </div>
      ))}
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <SkeletonMetricGrid />
      <div className="skeleton-card">
        <div className="skeleton-header-row">
          <div>
            <SkeletonBlock width="120px" height="12px" />
            <SkeletonBlock width="230px" height="24px" />
          </div>
          <SkeletonBlock width="130px" height="34px" />
        </div>
        <div className="skeleton-timeline">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index}>
              <SkeletonBlock height="6px" />
              <SkeletonBlock width="78%" height="12px" />
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-card">
        <div className="skeleton-header-row">
          <div>
            <SkeletonBlock width="130px" height="12px" />
            <SkeletonBlock width="220px" height="24px" />
          </div>
          <SkeletonBlock width="120px" height="34px" />
        </div>
        <div className="skeleton-table">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index}>
              <SkeletonBlock width="24%" />
              <SkeletonBlock width="18%" />
              <SkeletonBlock width="20%" />
              <SkeletonBlock width="16%" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function DetailsSkeleton() {
  return (
    <>
      <div className="skeleton-card">
        <SkeletonBlock width="110px" height="12px" />
        <SkeletonBlock width="260px" height="28px" />
        <div className="skeleton-timeline">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index}>
              <SkeletonBlock height="6px" />
              <SkeletonBlock width="82%" height="12px" />
            </div>
          ))}
        </div>
      </div>
      <section className="details-two-column">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton-card">
            <SkeletonBlock width="48%" height="24px" />
            <div className="skeleton-detail-grid">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div key={itemIndex}>
                  <SkeletonBlock width="54%" height="12px" />
                  <SkeletonBlock width="86%" height="16px" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <div className="skeleton-card">
        <SkeletonBlock width="130px" height="12px" />
        <SkeletonBlock width="320px" height="24px" />
        <div className="details-two-column">
          <div className="skeleton-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} height="46px" />
            ))}
          </div>
          <div className="skeleton-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} height="54px" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
