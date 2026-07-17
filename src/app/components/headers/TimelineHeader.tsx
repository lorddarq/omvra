/**
 * TimelineHeader Component
 *
 * Renders the month and day headers for the timeline.
 * Displays months and individual day cells with visual indicators
 * (e.g., today highlight).
 *
 * Props should be passed from parent TimelineView after calculating
 * dates, month widths, and day widths.
 */

import React from 'react';

interface TimelineHeaderProps {
  datesByMonth: Record<string, Date[]>;
  monthKeys?: string[];
  monthStartIndices?: Record<string, number>;
  monthWidths: Record<string, number>;
  dayWidths: number[];
  defaultDayWidth: number;
  totalTimelineWidth: number;
  endPadding: number;
  leadingSpacerWidth?: number;
  trailingSpacerWidth?: number;
  rowHeight: number;
  swimlaneCount: number;
  highlightToday?: boolean;
  headerRef: React.RefObject<HTMLDivElement>;
  onMonthResizeStart?: (monthKey: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onMonthReset?: (monthKey: string) => void;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
}

function getDayLabel(date: Date): string {
  return date.getDate().toString();
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function TimelineHeader({
  datesByMonth,
  monthKeys,
  monthStartIndices,
  monthWidths,
  dayWidths,
  defaultDayWidth,
  totalTimelineWidth,
  endPadding,
  leadingSpacerWidth = 0,
  trailingSpacerWidth = 0,
  rowHeight,
  swimlaneCount,
  highlightToday = true,
  headerRef,
  onMonthResizeStart,
  onMonthReset,
}: TimelineHeaderProps) {
  // Ordered month keys (from parent windowing if provided)
  const monthKeysOrdered = monthKeys && monthKeys.length > 0
    ? monthKeys
    : Object.keys(datesByMonth).sort((a, b) => {
        const ta = datesByMonth[a]?.[0]?.getTime() ?? 0;
        const tb = datesByMonth[b]?.[0]?.getTime() ?? 0;
        return ta - tb;
      });

  // Compute month metadata with indices for day width lookup
  const monthMeta: { key: string; dates: Date[]; width: number; startIndex: number }[] = [];
  let runningIndex = 0;
  monthKeysOrdered.forEach(k => {
    const md = datesByMonth[k] ?? [];
    const w = monthWidths[k] ?? md.length * defaultDayWidth;
    const absoluteStart = monthStartIndices?.[k] ?? runningIndex;
    monthMeta.push({ key: k, dates: md, width: w, startIndex: absoluteStart });
    runningIndex += md.length;
  });

  const timelineInnerStyle: React.CSSProperties = {
    minWidth: `${totalTimelineWidth + endPadding}px`,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  };

  return (
    <div
      ref={headerRef}
      className="hide-scrollbar"
      style={{ overflowX: 'visible', overflowY: 'visible', width: '100%' }}
    >
      <div style={timelineInnerStyle}>
        {/* Month headers and day rows */}
        <div style={{ display: 'flex', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%' }}>
            {leadingSpacerWidth > 0 && (
              <div
                className="months-leading-spacer flex-shrink-0"
                style={{ width: `${leadingSpacerWidth}px` }}
                aria-hidden
              />
            )}
            {monthMeta.map(m => (
              <div
                key={m.key}
                style={{ width: `${m.width}px` }}
                className="month-column"
              >
                {/* Month header */}
                <div
                  data-month-header
                  className="month-header relative"
                >
                  <span className="month-header-text">
                    {getMonthLabel(m.dates[0])}
                  </span>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-gray-300/40"
                    onMouseDown={(e) => onMonthResizeStart?.(m.key, e)}
                    onDoubleClick={() => onMonthReset?.(m.key)}
                    title="Drag to resize month. Double-click to reset."
                  />
                </div>

                {/* Day row */}
                <div
                  data-day-header
                  className="day-row timeline-day-scrub-handle"
                  style={{ height: `${rowHeight}px` }}
                >
                  {m.dates.map((d, i) => {
                    const globalIdx = m.startIndex + i;
                    const w = dayWidths[globalIdx] ?? defaultDayWidth;
                    const today = new Date();
                    const todayNoTime = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate()
                    );
                    const isToday = isSameDate(d, todayNoTime);
                    
                    // Check if this is a weekend or week start
                    const dayOfWeek = d.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isWeekStart = dayOfWeek === 1; // Monday

                    return (
                      <div
                        key={i}
                        className={`day-cell ${isWeekend ? 'weekend' : ''} ${isWeekStart ? 'week-start' : ''}`}
                        style={{ width: `${w}px` }}
                      >
                        <div
                          title={isToday ? 'Today' : isWeekend ? 'Weekend' : undefined}
                          aria-label={isToday ? 'Today' : isWeekend ? 'Weekend' : undefined}
                          className={`day-label ${
                            isToday ? 'today' : ''
                          } ${
                            isToday && highlightToday ? 'highlight' : ''
                          }`}
                        >
                          {getDayLabel(d)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-month swimlane placeholders (background grid) */}
                <div className="month-swimlanes absolute left-0 right-0 flex flex-col pointer-events-none">
                  {Array.from({ length: swimlaneCount }).map((_, si) => (
                    <div
                      key={si}
                      data-month-cell
                      className="month-swimlane-cell"
                      style={{
                        height: `${rowHeight}px`,
                        minHeight: `${rowHeight}px`,
                      }}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Trailing spacer */}
            <div
              className="months-end-spacer flex-shrink-0"
              style={{ width: `${trailingSpacerWidth + endPadding}px` }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
