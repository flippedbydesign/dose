import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { DateStr } from '../lib/dates'
import { mergeDoseEvents, type MergedDoseEvent } from '../lib/merge'
import { generateSchedule } from '../lib/schedule'
import type { Protocol } from '../lib/types'

export interface ProtocolDoses {
  protocol: Protocol
  doses: MergedDoseEvent[]
}

/**
 * Live query: every active/paused/completed protocol's merged (generated +
 * persisted) dose events across [rangeStart, rangeEnd]. Paused protocols
 * generate nothing (schedule.ts), but their persisted history still surfaces.
 */
export function useScheduledDoses(rangeStart: DateStr, rangeEnd: DateStr, protocolIds?: string[]): ProtocolDoses[] | undefined {
  return useLiveQuery(async () => {
    const protocols = protocolIds
      ? await db.protocols.bulkGet(protocolIds)
      : await db.protocols.toArray()
    const validProtocols = protocols.filter((p): p is Protocol => !!p)

    const results: ProtocolDoses[] = []
    for (const protocol of validProtocols) {
      const occurrences = generateSchedule(protocol, rangeStart, rangeEnd)
      const persisted = await db.doseEvents
        .where('[protocolId+date]')
        .between([protocol.id, rangeStart], [protocol.id, rangeEnd], true, true)
        .toArray()
      results.push({ protocol, doses: mergeDoseEvents(occurrences, persisted) })
    }
    return results
  }, [rangeStart, rangeEnd, protocolIds?.join(',')])
}
