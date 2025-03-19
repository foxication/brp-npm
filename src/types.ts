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
export type BrpErrors = { [key: TypePath]: BrpError };

export type BrpValue = string | number | boolean | null | BrpArray | BrpObject;
export type BrpArray = BrpValue[];
export type BrpObject = { [key: TypePath]: BrpValue };
export class BrpValueWrapped {
  private tree: BrpValue;

  constructor(tree: BrpValue) {
    this.tree = tree;
  }

  get(path: (TypePath | number)[] = []): BrpValue | undefined {
    return BrpValueWrapped.getBrpValue(this.tree, path);
  }
  set(path: (TypePath | number)[] = [], value: BrpValue) {
    if (path.length === 0) {
      this.tree = value;
      return;
    }
    BrpValueWrapped.setBrpValue(this.tree, path, value);
  }

  private static getBrpValue(value?: BrpValue, path: (TypePath | number)[] = []): BrpValue | undefined {
    if (value === undefined) return undefined;
    if (path.length === 0) return value;
    if (typeof value !== 'object' || value === null) return undefined;

    // Array
    const key = path[0];
    if (value instanceof Array) {
      if (typeof key !== 'number') return null;
      return BrpValueWrapped.getBrpValue(value[key], path.slice(1));
    }

    // Object
    if (typeof key !== 'string') return null;
    return BrpValueWrapped.getBrpValue(value[key], path.slice(1));
  }

  private static setBrpValue(value: BrpValue, path: (TypePath | number)[] = [], setter: BrpValue): void {
    if (path.length === 0) return;
    if (typeof value !== 'object' || value === null) return;

    // Array
    const key = path[0];
    if (value instanceof Array) {
      if (typeof key !== 'number') return;
      if (path.length === 1) {
        value[key] = setter;
        return;
      }
      BrpValueWrapped.setBrpValue(value[key], path.slice(1), setter);
      return;
    }

    // Object
    if (typeof key !== 'string') return;
    if (path.length === 1) {
      value[key] = setter;
      return;
    }
    BrpValueWrapped.setBrpValue(value[key], path.slice(1), setter);
  }
}

export type BrpGetWatchResult = {
  components: BrpObject;
  removed: TypePath[];
  errors: BrpErrors;
};

export type BrpGetWatchStrictResult = {
  components: BrpObject;
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
