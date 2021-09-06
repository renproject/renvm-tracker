export interface HistoricEvent {
    network: string;
    chain: string;
    symbol: string;
    timestamp: number;
    amount: string;
    to?: string;
    txHash?: string;
}
