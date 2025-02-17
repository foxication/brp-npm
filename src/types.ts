export type EntityId = number;
export type TypePath = string;
export type Value = any;

export type RpcResponse<R> = {
  jsonrpc: string;
  id: number;
  result?: R;
  error?: BevyError;
};

export type BevyError = {
  code: number;
  message: string;
  data?: any;
};

export type BevyGetWatchResult = {
  components: Record<TypePath, any>;
  removed: TypePath[];
  errors: Record<TypePath, BevyError>;
};

export type BevyGetWatchStrictResult = {
  components: Record<TypePath, any>;
  removed: TypePath[];
};

export type BevyListWatchResult = {
  added: TypePath[];
  removed: TypePath[];
};

export enum BevyVersion {
  IGNORE = 'ignore',
  V0_15 = '0.15',
  V0_16 = '0.16',
}
