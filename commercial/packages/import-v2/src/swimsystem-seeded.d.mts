export interface SeededEntry {
 readonly kind: 'seeded_entry';
 athleteExternalId: string;
 externalEventId: string;
 round: string;
 sex: string;
 event: string;
 eventDate: string;
 course: 'SCM' | 'LCM';
 seedTimeMs: number | null;
 heat: number;
 lane: number;
 scheduledAt: string;
 sourceUrl: string;
 retrievedAt: string;
 rawHash: string;
 parserVersion: string;
 sourceBlock: string;
}
export function parseSeededStartlist(input: {
 text: string;
 identity: {externalId: string};
 sourceUrl: string;
 retrievedAt: string;
 rawHash: string;
 timeZone?: string;
}): SeededEntry[];

export function scheduledInstant(date: string, time: string, timeZone: string): string;
