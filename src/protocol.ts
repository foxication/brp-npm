// Bevy Remote Protocol Client
// https://docs.rs/bevy/latest/bevy/remote/index.html

import { URL } from 'url';
import {
  BrpResponse,
  EntityId,
  TypePath,
  BrpGetWatchResult,
  BrpGetWatchStrictResult,
  BrpListWatchResult,
  ServerVersion,
  BrpObject,
  BrpErrors,
} from './types';
import { TextDecoder } from 'util';

function reverseMap(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in map) {
    const value = map[key];
    result[value] = key;
  }
  return result;
}

function collectMaps(maps: Array<Record<string, string>>) {
  const collection: Record<string, string> = {};
  for (const map of maps) {
    for (const key in map) {
      collection[key] = map[key];
    }
  }
  return collection;
}

export class BevyRemoteProtocol {
  static DEFAULT_URL = new URL('http://127.0.0.1:15702');
  static INTERNAL_TO_V0_15: Record<string, string> = {
    'bevy_ecs::hierarchy::Children': 'bevy_hierarchy::components::children::Children',
    'bevy_ecs::name::Name': 'bevy_core::name::Name',
  };
  static INTERNAL_TO_V0_16: Record<string, string> = {};
  static ANY_TO_INTERNAL = collectMaps([reverseMap(this.INTERNAL_TO_V0_15), reverseMap(this.INTERNAL_TO_V0_16)]);

  private static decoder = new TextDecoder();
  private id: number;
  public url: URL;
  public serverVersion: ServerVersion;

  constructor(url: URL, version: ServerVersion) {
    this.id = 0;
    this.url = url;
    this.serverVersion = version;
  }

  private nextId() {
    return this.id++; // starting from 0
  }

  private translateToInternal(message: string): string {
    const table = (() => {
      if (this.serverVersion === ServerVersion.IGNORE) return {};
      return BevyRemoteProtocol.ANY_TO_INTERNAL;
    })();

    for (const search in table) {
      message = message.replace(new RegExp(search, 'g'), table[search]);
    }
    return message;
  }

  private translateToSpecificVersion(message: string): string {
    const table = (() => {
      switch (this.serverVersion) {
        case ServerVersion.V0_15:
          return BevyRemoteProtocol.INTERNAL_TO_V0_15;
        case ServerVersion.V0_16:
          return BevyRemoteProtocol.INTERNAL_TO_V0_16;
        default:
          return {}; // ignore
      }
    })();

    for (const search in table) {
      message = message.replace(new RegExp(search, 'g'), table[search]);
    }
    return message;
  }

  private requestWrapper(rpcMethod: string, rpcParams: any, signal?: AbortSignal): RequestInit {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: this.translateToSpecificVersion(
        JSON.stringify({
          jsonrpc: '2.0',
          id: this.nextId(),
          method: rpcMethod,
          params: rpcParams,
        })
      ),
      signal,
    };
  }

  private async request<R>(method: string, params: any): Promise<BrpResponse<R>> {
    // throws error if connection refused by url
    return await JSON.parse(
      this.translateToInternal(await (await fetch(this.url, this.requestWrapper(method, params))).text())
    );
  }

  private async requestStream<R>(
    method: string,
    params: any,
    signal: AbortSignal,
    observer: (arg: R) => void
  ): Promise<null> {
    // throws error if connection refused by url
    const response = await fetch(this.url, this.requestWrapper(method, params, signal));
    if (!response.body) return null;

    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
      for await (const chunk of response.body) {
        const decoded: string = BevyRemoteProtocol.decoder.decode(chunk);
        const translated = this.translateToInternal(decoded);
        const parsed = JSON.parse(translated.slice(decoded.indexOf('{')));
        if (parsed.result) observer(parsed.result);
      }
    } catch (error) {}
    return null;
  }

  /**
   * Retrieve the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `false` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `strict` (optional): A flag to enable strict mode which will fail if any one of the
   *   components is not present or can not be reflected.
   *
   * `result`:
   * - `components`: A map associating each type name to its value on the requested entity.
   * - `errors`: A map associating each type name with an error if it was not on the entity
   *   or could not be reflected.
   */
  public async get(
    entity: EntityId,
    components: TypePath[]
  ): Promise<BrpResponse<{ components: BrpObject; errors: BrpErrors }>> {
    return this.request('bevy/get', { entity, components, strict: false });
  }

  /**
   * Retrieve the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `true` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `strict` (optional): A flag to enable strict mode which will fail if any one of the
   *   components is not present or can not be reflected.
   *
   * `result`: A map associating each type name to its value on the requested entity.
   */
  public async get_strict(entity: EntityId, components: TypePath[]): Promise<BrpResponse<BrpObject>> {
    return this.request('bevy/get', { entity, components, strict: true });
  }

  /**
   * Perform a query over components in the ECS, returning all matching entities and their associated
   * component values.
   *
   * All of the arrays that comprise this request are optional, and when they are not provided, they
   * will be treated as if they were empty.
   *
   * `params`:
   * - `components` (optional): An array of [fully-qualified type names] of components to fetch.
   * - `option` (optional): An array of fully-qualified type names of components to fetch optionally.
   * - `has` (optional): An array of fully-qualified type names of components whose presence will be
   *   reported as boolean values.
   * - `with` (optional): An array of fully-qualified type names of components that must be present
   *   on entities in order for them to be included in results.
   * - `without` (optional): An array of fully-qualified type names of components that must *not* be
   *   present on entities in order for them to be included in results.
   *
   * `result`: An array, each of which is an object containing:
   * - `entity`: The ID of a query-matching entity.
   * - `components`: A map associating each type name from `components`/`option` to its value on the matching
   *   entity if the component is present.
   * - `has`: A map associating each type name from `has` to a boolean value indicating whether or not the
   *   entity has that component. If `has` was empty or omitted, this key will be omitted in the response.
   */
  public async query({
    components,
    option,
    has,
    filterWith,
    filterWithout,
  }: {
    components?: TypePath[];
    option?: TypePath[];
    has?: TypePath[];
    filterWith?: TypePath[];
    filterWithout?: TypePath[];
  }): Promise<BrpResponse<[{ entity: EntityId; components: BrpObject; has: { [key: TypePath]: boolean } }]>> {
    return this.request('bevy/query', {
      data: { components, option, has },
      filter: { with: filterWith, without: filterWithout },
    });
  }

  /**
   * Create a new entity with the provided components and return the resulting entity ID.
   *
   * `params`:
   * - `components`: A map associating each component's [fully-qualified type name] with its value.
   *
   * `result`:
   * - `entity`: The ID of the newly spawned entity.
   */
  public async spawn(components: BrpObject): Promise<BrpResponse<{ entity: EntityId }>> {
    return this.request('bevy/spawn', { components });
  }

  /**
   * Despawn the entity with the given ID.
   *
   * `params`:
   * - `entity`: The ID of the entity to be despawned.
   *
   * `result`: null.
   */
  public async destroy(entity: EntityId): Promise<BrpResponse<null>> {
    return this.request('bevy/destroy', { entity });
  }

  /**
   * Delete one or more components from an entity.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components should be removed.
   * - `components`: An array of [fully-qualified type names] of components to be removed.
   *
   * `result`: null.
   */
  public async remove(entity: EntityId, components: TypePath[]): Promise<BrpResponse<null>> {
    return this.request('bevy/remove', { entity, components });
  }

  /**
   * Insert one or more components into an entity.
   *
   * `params`:
   * - `entity`: The ID of the entity to insert components into.
   * - `components`: A map associating each component's fully-qualified type name with its value.
   *
   * `result`: null.
   */
  public async insert(entity: EntityId, components: BrpObject): Promise<BrpResponse<null>> {
    return this.request('bevy/insert', { entity, components });
  }

  /**
   * Assign a new parent to one or more entities.
   *
   * `params`:
   * - `entities`: An array of entity IDs of entities that will be made children of the `parent`.
   * - `parent` (optional): The entity ID of the parent to which the child entities will be assigned.
   *   If excluded, the given entities will be removed from their parents.
   *
   * `result`: null.
   */
  public async reparent(entities: EntityId[], parent?: EntityId): Promise<BrpResponse<null>> {
    return this.request('bevy/reparent', { entities, parent });
  }

  /**
   * List all registered components or all components present on an entity.
   *
   * When `params` is not provided, this lists all registered components. If `params` is provided,
   * this lists only those components present on the provided entity.
   *
   * `params` (optional):
   * - `entity`: The ID of the entity whose components will be listed.
   *
   * `result`: An array of fully-qualified type names of components.
   */
  public async list(entity?: EntityId): Promise<BrpResponse<TypePath[]>> {
    if (entity) return this.request('bevy/list', { entity });
    return this.request('bevy/list', null);
  }

  /**
   * Watch the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `false` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   *
   * `result`:
   * - `components`: A map of components added or changed in the last tick associating each type
   *   name to its value on the requested entity.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   * - `errors`: A map associating each type name with an error if it was not on the entity
   *   or could not be reflected.
   */
  public async get_watch(
    entity: EntityId,
    components: TypePath[],
    signal: AbortSignal,
    observer: (arg: BrpGetWatchResult) => void
  ): Promise<null> {
    return this.requestStream('bevy/get+watch', { entity, components, strict: false }, signal, observer);
  }

  /**
   * Watch the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `true` by default.
   * Response will fail if any one of the components is not present or can not be refleceted.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   *
   * `result`:
   * - `components`: A map of components added or changed in the last tick associating each type
   *   name to its value on the requested entity.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   */
  public async get_watch_strict(
    entity: EntityId,
    components: TypePath[],
    signal: AbortSignal,
    observer: (arg: BrpGetWatchStrictResult) => void
  ): Promise<null> {
    return this.requestStream('bevy/get+watch', { entity, components, strict: true }, signal, observer);
  }

  /**
   * Watch all components present on an entity.
   *
   * When `entity` is not provided, this lists all registered components. If `entity` is provided,
   * this lists only those components present on the provided entity.
   *
   * `params`:
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   * - `entity`: (optional) The ID of the entity whose components will be listed.
   *
   * `result`:
   * - `added`: An array of fully-qualified type names of components added to the entity in the
   *   last tick.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   */
  public async list_watch(
    signal: AbortSignal,
    observer: (arg: BrpListWatchResult) => void,
    entity?: EntityId
  ): Promise<null> {
    if (entity) return this.requestStream('bevy/list+watch', { entity }, signal, observer);
    return this.requestStream('bevy/list+watch', null, signal, observer);
  }
}
