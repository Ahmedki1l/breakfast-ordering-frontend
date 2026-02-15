import React from 'react';

export function Skeleton({ width, height, circle, style }) {
  return (
    <div
      className="skeleton"
      style={{
        width: width || '100%',
        height: height || 16,
        borderRadius: circle ? '50%' : 'var(--radius-sm)',
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, style }) {
  return (
    <div className="skeleton-card" style={style}>
      <Skeleton height={14} width="40%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? '60%' : '100%'}
          style={{ marginBottom: 8 }}
        />
      ))}
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div className="container">
      <div className="card-glass">
        {/* Info grid */}
        <div className="header-info">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="info-item">
              <Skeleton height={10} width="50%" style={{ marginBottom: 8 }} />
              <Skeleton height={18} width="70%" />
            </div>
          ))}
        </div>
        {/* Order cards */}
        <Skeleton height={14} width="30%" style={{ marginBottom: 16 }} />
        <SkeletonCard style={{ marginBottom: 12 }} />
        <SkeletonCard style={{ marginBottom: 12 }} />
      </div>
    </div>
  );
}
