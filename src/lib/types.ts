export type Currency = "USD" | "ARS";
export type Market = "US" | "AR";
export type AssetType = "stock" | "etf" | "index";
export type DataFreshness = "realtime" | "delayed" | "historical" | "demo";
export type DataProviderId = "yahoo" | "demo";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "take_profit";
export type OrderStatus = "pending" | "filled" | "cancelled" | "rejected";
export type RealismLevel = "beginner" | "realistic" | "advanced";
export type TradingMode = "SIMULATION" | "LIVE";

export interface Asset {
  id: string;
  symbol: string;
  yahooSymbol: string;
  name: string;
  type: AssetType;
  market: Market;
  currency: Currency;
  exchange: string;
}

export interface Price {
  symbol: string;
  price: number;
  currency: Currency;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  previousClose: number | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  freshness: DataFreshness;
  provider: DataProviderId;
  lastUpdated: string;
  sourceLabel: string;
}

export interface HistoricalPrice {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface QuoteNewsItem {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

export interface FxRate {
  pair: "USDARS";
  rate: number;
  freshness: DataFreshness;
  provider: DataProviderId;
  lastUpdated: string;
  sourceLabel: string;
}

export interface MarketSnapshot {
  quote: Price;
  asset: Asset;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currency: Currency;
  openedAt: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: OrderStatus;
  createdAt: string;
  filledAt?: string;
  fillPrice?: number;
  commission?: number;
  rejectReason?: string;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission: number;
  total: number;
  currency: Currency;
  realizedPnl?: number;
  createdAt: string;
  realismLevel: RealismLevel;
}

export interface CashBalances {
  USD: number;
  ARS: number;
}

export interface EquityPoint {
  time: number;
  valueUsd: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: string;
  beginnerMode: boolean;
  displayCurrency: Currency;
  realismLevel: RealismLevel;
  interests: string[];
  initialCapital: CashBalances;
}

export interface CommissionConfig {
  usPercent: number;
  usMin: number;
  arPercent: number;
  arMin: number;
  spreadBps: number;
  slippageBps: number;
}

export interface SimulationSettings {
  tradingMode: TradingMode;
  commission: CommissionConfig;
}

export interface ChallengeProgress {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "active" | "completed" | "failed";
}

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
}

export interface Portfolio {
  cash: CashBalances;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  watchlist: WatchlistItem[];
  equityHistory: EquityPoint[];
  challenges: ChallengeProgress[];
  badges: string[];
  xp: number;
}

export interface SearchHit {
  asset: Asset;
  score: number;
}

export type ChartRange =
  | "1d"
  | "1w"
  | "1m"
  | "3m"
  | "6m"
  | "1y"
  | "5y"
  | "10y"
  | "max";

export interface ChartIntervalSpec {
  interval: "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo";
  period1: Date;
}

export type User = UserProfile;
export type Watchlist = WatchlistItem[];
export type { MarketDataProvider, HistoricalDataProvider } from "@/lib/market/provider";
