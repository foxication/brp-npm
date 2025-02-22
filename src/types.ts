export type EntityId = number;
export type TypePath = string;

export type BrpResponse<R> = {
  jsonrpc: string;
  id: number;
  result?: R;
  error?: BrpError;
};

export type BrpError = {
  code: number;
  message: string;
  data?: BrpValue;
};

/** Keep in mind that `object` can be `null`. */
export type BrpValue = string | number | boolean | object | string[] | boolean[] | number[];

export type BrpGetWatchResult = {
  components: Record<TypePath, BrpValue>;
  removed: TypePath[];
  errors: Record<TypePath, BrpError>;
};

export type BrpGetWatchStrictResult = {
  components: Record<TypePath, BrpValue>;
  removed: TypePath[];
};

export type BrpListWatchResult = {
  added: TypePath[];
  removed: TypePath[];
};

export enum ServerVersion {
  IGNORE = 'IGNORE',
  V0_15 = '0.15',
  V0_16 = '0.16',
}
