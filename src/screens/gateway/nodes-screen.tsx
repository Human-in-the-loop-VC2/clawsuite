import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertDiamondIcon,
  ArrowTurnBackwardIcon,
  ServerStack01Icon,
} from '@hugeicons/core-free-icons'
import { EmptyState } from '@/components/empty-state'

type NodeEntry = {
  id?: string
  name?: string
  platform?: string
  status?: string
  lastSeen?: number
  version?: string
}

type NodesData = {
  nodes?: NodeEntry[]
}

function timeAgo(ts: number | undefined, t: any) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('common.justNow')
  if (mins < 60) return t('common.minutesAgo', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('common.hoursAgo', { count: hrs })
  return t('common.daysAgo', { count: Math.floor(hrs / 24) })
}

export function NodesScreen() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['gateway', 'nodes'],
    queryFn: async () => {
      const res = await fetch('/api/gateway/nodes')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gateway error')
      return json.data as NodesData
    },
    refetchInterval: 15_000,
    retry: 1,
  })

  const lastUpdated = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt).toLocaleTimeString()
    : null
  const nodes = query.data?.nodes || []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-primary-200">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-ink">{t('gateway.nodes.title')}</h1>
          <span className="text-[11px] text-primary-500">
            {t('gateway.nodes.pairedCount', { count: nodes.length })}
          </span>
          {query.isFetching && !query.isLoading ? (
            <span className="text-[10px] text-primary-500 animate-pulse">
              {t('gateway.nodes.syncing')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated ? (
            <span className="text-[10px] text-primary-500">
              {t('gateway.nodes.updated', { time: lastUpdated })}
            </span>
          ) : null}
          <span
            className={`inline-block size-2 rounded-full ${query.isError ? 'bg-red-500' : query.isSuccess ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {query.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-2 text-primary-500">
              <div className="size-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              <span className="text-sm">{t('gateway.nodes.connecting')}</span>
            </div>
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <HugeiconsIcon
              icon={AlertDiamondIcon}
              size={24}
              strokeWidth={1.5}
              className="text-red-500"
            />
            <p className="text-sm text-primary-600">
              {query.error instanceof Error
                ? query.error.message
                : t('gateway.nodes.failed')}
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
            >
              <HugeiconsIcon
                icon={ArrowTurnBackwardIcon}
                size={14}
                strokeWidth={1.5}
              />
              {t('common.retry')}
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={ServerStack01Icon}
            title={t('gateway.nodes.empty.title')}
            description={t('gateway.nodes.empty.description')}
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-primary-200 text-left">
                <th className="pb-2 text-[11px] font-medium text-primary-500 uppercase tracking-wider">
                  {t('gateway.nodes.table.node')}
                </th>
                <th className="pb-2 text-[11px] font-medium text-primary-500 uppercase tracking-wider">
                  {t('gateway.nodes.table.platform')}
                </th>
                <th className="pb-2 text-[11px] font-medium text-primary-500 uppercase tracking-wider">
                  {t('gateway.nodes.table.status')}
                </th>
                <th className="pb-2 text-[11px] font-medium text-primary-500 uppercase tracking-wider">
                  {t('gateway.nodes.table.version')}
                </th>
                <th className="pb-2 text-[11px] font-medium text-primary-500 uppercase tracking-wider text-right">
                  {t('gateway.nodes.table.lastSeen')}
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, i) => (
                <tr
                  key={node.id || i}
                  className="border-b border-primary-100 hover:bg-primary-50 transition-colors"
                >
                  <td className="py-3">
                    <div className="font-medium text-ink">
                      {node.name || node.id || t('gateway.nodes.nodeIndex', { index: i + 1 })}
                    </div>
                    {node.id ? (
                      <div className="text-[11px] text-primary-500 font-mono">
                        {node.id}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 text-primary-600">
                    {node.platform || '—'}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`inline-block size-2 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-primary-400'}`}
                      />
                      {node.status ? t(`gateway.nodes.status.${node.status}`) : t('common.unknown')}
                    </span>
                  </td>
                  <td className="py-3 text-primary-600">
                    {node.version || '—'}
                  </td>
                  <td className="py-3 text-primary-600 text-right">
                    {timeAgo(node.lastSeen, t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
