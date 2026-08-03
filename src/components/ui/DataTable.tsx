import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export interface Column<T> {
  /** Stable id for the column. Doubles as the default sort accessor. */
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
  /** Optional explicit sort key. Falls back to `row[key]` when omitted. */
  sortValue?: (row: T) => string | number
  className?: string
  align?: 'left' | 'center' | 'right'
}

type Direction = 'asc' | 'desc'

const ALIGN: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function readSortValue<T>(row: T, column: Column<T>): string | number {
  if (column.sortValue) return column.sortValue(row)
  const raw = (row as Record<string, unknown>)[column.key]
  if (typeof raw === 'number') return raw
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

/**
 * Client-side table: sort, paginate, and scroll horizontally on its own so the
 * page body never picks up a sideways scrollbar.
 */
export function DataTable<T>({
  rows,
  columns,
  pageSize = 25,
  emptyMessage = 'Nothing to show here.',
  getRowKey,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  pageSize?: number
  emptyMessage?: string
  getRowKey?: (row: T, index: number) => string | number
  className?: string
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [direction, setDirection] = useState<Direction>('desc')
  const [page, setPage] = useState(0)

  // A filter change can shrink the list out from under the current page.
  useEffect(() => {
    setPage(0)
  }, [rows, sortKey, direction])

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey)
    if (!column) return rows

    const copy = [...rows]
    copy.sort((a, b) => {
      const left = readSortValue(a, column)
      const right = readSortValue(b, column)
      if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left
      }
      const compared = String(left).localeCompare(String(right))
      return direction === 'asc' ? compared : -compared
    })
    return copy
  }, [rows, columns, sortKey, direction])

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * pageSize
  const visible = sorted.slice(start, start + pageSize)

  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return
    if (sortKey === column.key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column.key)
      setDirection('desc')
    }
  }

  if (total === 0) {
    return (
      <div
        className={cn(
          'rounded-card border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center text-sm text-slate-500',
          className
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-slate-200 bg-white', className)}>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr>
              {columns.map((column) => {
                const active = sortKey === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                      ALIGN[column.align ?? 'left'],
                      column.className
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors duration-150 ease-out hover:text-nexus-indigo',
                          active && 'text-nexus-indigo'
                        )}
                      >
                        {column.header}
                        {active ? (
                          direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden />
                          )
                        ) : (
                          <ArrowDown className="h-3 w-3 opacity-25" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, start + index) : start + index}
                className="border-b border-slate-100 transition-colors duration-150 ease-out last:border-b-0 hover:bg-slate-50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-nexus-indigo',
                      ALIGN[column.align ?? 'left'],
                      column.className
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="tabular text-xs text-slate-500">
          {start + 1} to {Math.min(start + pageSize, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Prev
          </Button>
          <span className="tabular text-xs text-slate-500">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
