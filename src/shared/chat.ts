export type ChatLine = { kind: 'you' | 'agent' | 'status' | 'error' | 'done'; text: string; costUsd?: number }
