interface SkeletonRowProps {
  width?: string
  height?: string
  className?: string
  rounded?: 'sm' | 'md' | 'full'
}

export function SkeletonRow({
  width = '100%',
  height = '14px',
  className = '',
  rounded = 'sm',
}: SkeletonRowProps) {
  const radiusClass =
    rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-md' : 'rounded-sm'

  return (
    <span
      aria-hidden="true"
      className={`skeleton-shimmer block ${radiusClass} ${className}`}
      style={{ width, height }}
    />
  )
}

interface SkeletonStackProps {
  count?: number
  rowHeight?: string
  gap?: string
}

export function SkeletonStack({ count = 6, rowHeight = '52px', gap = '8px' }: SkeletonStackProps) {
  return (
    <div role="status" aria-label="Loading records" className="flex flex-col" style={{ gap }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} width="100%" height={rowHeight} rounded="sm" />
      ))}
    </div>
  )
}
