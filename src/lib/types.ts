import { Decimal } from "@prisma/client/runtime/library";

// TypeScript interfaces for database models
export interface DCAExecution {
  txHash: string;
  planHash: string;
  amountIn: Decimal;
  tokenOutAddress: string;
  amountOut: Decimal;
  feeAmount: Decimal;
  executedAt: Date;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: Decimal;
  about?: string | null;
  image?: string | null;
  isWrapped: boolean;
  wrappedName?: string | null;
  wrappedSymbol?: string | null;
  originalAddress?: string | null;
  price?: Decimal | null;
  fdv?: Decimal | null;
  marketcap?: Decimal | null;
  volume24h?: Decimal | null;
  price1yAgo?: Decimal | null;
  totalSupply?: Decimal | null;
}

export interface DCAPlan {
  planHash: string;
  userWallet: string;
  tokenOutAddress: string;
  recipient: string;
  amountIn: Decimal;
  frequency: number;
  lastExecutedAt: number;
  active: boolean;
  createdAt: Date;
  executions: DCAExecution[];
}
