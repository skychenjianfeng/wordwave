import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
  overscan?: number;
}

export default function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  className = '',
  overscan = 5,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={`overflow-y-auto ${className}`}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={vi.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: vi.size,
              transform: `translateY(${vi.start}px)`,
            }}
          >
            {renderRow(items[vi.index], vi.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
