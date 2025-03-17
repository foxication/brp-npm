// Test of basic usage of library
import test from 'node:test';
import assert from 'assert';
import {
  BrpGetWatchResult,
  BrpGetWatchStrictResult,
  BrpListWatchResult,
  BrpValue,
  BrpValueWrapped,
  ServerVersion,
} from '../src/types';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { BevyRemoteProtocol } from '../src/protocol';
import { short } from '../src';

test('short TypePath', () => {
  assert.strictEqual(short('Crypto'), 'Crypto');
  assert.strictEqual(short('bevy_ecs::something::Crypto'), 'Crypto');
  assert.strictEqual(short('bevy_ecs::something::Crypto<hell::Satan>'), 'Crypto');
});
test('BrpValueWrapped methods', () => {
  // basic
  assert.strictEqual(new BrpValueWrapped(1).get(), 1);
  assert.strictEqual(new BrpValueWrapped('hello').get(), 'hello');
  assert.strictEqual(new BrpValueWrapped(true).get(), true);
  assert.strictEqual(new BrpValueWrapped(null).get(), null);

  // objects
  const data0 = new BrpValueWrapped({ word1: 'hello', word2: 'world' });
  assert.deepStrictEqual(data0.get(), { word1: 'hello', word2: 'world' });
  assert.strictEqual(data0.get(['word1']), 'hello');
  assert.strictEqual(data0.get(['word2']), 'world');

  // arrays
  const data1 = new BrpValueWrapped(['hello', 'world']);
  assert.deepStrictEqual(data1.get(), ['hello', 'world']);
  assert.strictEqual(data1.get([0]), 'hello');
  assert.strictEqual(data1.get([1]), 'world');

  // hybrid
  assert.strictEqual(new BrpValueWrapped({ person: [0, 1, 2, 3, 4, 5] }).get(['person', 1]), 1);
  assert.strictEqual(new BrpValueWrapped([0, 1, { person: 'Vladimir' }, 3, 4, 5]).get([2, 'person']), 'Vladimir');

  // mutation
  const data2 = new BrpValueWrapped({ first: 'Hello,', middle: 'cruel', last: 'world!' });
  data2.set(['middle'], 'fantasy');
  assert.deepStrictEqual(data2.get(), { first: 'Hello,', middle: 'fantasy', last: 'world!' });

  data2.set(['middle'], ['f', 'u', 'n']);
  assert.deepStrictEqual(data2.get(), { first: 'Hello,', middle: ['f', 'u', 'n'], last: 'world!' });
});
test_with_server('server/manifest/v0.15/Cargo.toml', ServerVersion.V0_15);
test_with_server('server/manifest/main/Cargo.toml', ServerVersion.V0_16);

export function test_with_server(manifestPath: string, version: ServerVersion) {
  test(`testing ${manifestPath}`, async (t) => {
    var isCompiled = false;
    await t.test('server compilation', async (t) => {
      const compilation = await spawnSync('cargo', ['build', '--manifest-path', manifestPath]);
      if (compilation.status != 0)
        assert.fail('compilation error(' + compilation.status?.toString() + '):\n' + compilation.output);
      isCompiled = true;
    });

    var isRunning = false;
    var isTestFinished = false;
    var server: ChildProcessWithoutNullStreams | undefined;
    await t.test('server start', { skip: !isCompiled }, async (t) => {
      server = spawn('cargo', ['run', '--manifest-path', manifestPath]);
      server.on('exit', (code) => {
        assert.ok(isTestFinished, `server exited before tests are finished: ${code ?? 0}`);
      });
      isRunning = true;
    });

    const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, version);
    const isV0_15 = protocol.serverVersion === ServerVersion.V0_15;
    const isV0_16 = protocol.serverVersion === ServerVersion.V0_16;

    var isConnected = false;
    await t.test('connection with server', { skip: !isRunning, timeout: 30 * 1000 }, async (t) => {
      const attempt_interval = 500;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      assert.ok(server);
      while (!server.exitCode) {
        await sleep(attempt_interval);
        const components = await protocol.list().catch(() => null);
        if (components) if (components.result) break;
      }
      isConnected = true;
    });

    await t.test('testing protocol', { skip: !isConnected }, async (t) => {
      await t.test('get & get_strict', async (t) => test_get(protocol));
      await t.test('query_empty', async (t) => test_query_empty(protocol));
      await t.test('query_by_components', async (t) => test_query_by_components(protocol));
      await t.test('list_entity', async (t) => test_list_entity(protocol));
      await t.test('list_all', async (t) => test_list_all(protocol));
      await t.test('insert & remove', async (t) => test_insert_then_remove(protocol));
      await t.test('spawn & destroy', async (t) => test_spawn_then_destroy(protocol));
      await t.test('reparent', { skip: isV0_15 }, async (t) => test_reparent(protocol));
      await t.test('get+watch', async (t) => test_get_watch(protocol));
      await t.test('get+watch (strict)', async (t) => test_get_watch_strict(protocol));
      await t.test('list+watch', async (t) => test_list_watch(protocol));
      await t.test('list+watch (all)', { todo: true }, async (t) => {});
    });

    isTestFinished = true;
    server?.kill();
  });
}

export async function test_get(protocol: BevyRemoteProtocol): Promise<void> {
  const reference_v0_15 = {
    components: {
      'bevy_ecs::name::Name': 'Parent Node',
      'server::FavoriteEntity': null,
      'server::Position': {
        x: 0,
        y: 0,
        z: 0,
      },
      'server::Shape': 'Circle',
    },
    errors: {},
  };
  const reference_v0_16 = {
    components: {
      'bevy_ecs::hierarchy::Children': [],
      'bevy_ecs::name::Name': 'Parent Node',
      'server::FavoriteEntity': null,
      'server::Position': {
        x: 0,
        y: 0,
        z: 0,
      },
      'server::Shape': 'Circle',
    },
    errors: {},
  };

  // recieve entityId of favorite entity
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(entity);

  // recieve components of favorite entity
  const type_paths = await (await protocol.list(entity)).result;
  assert.ok(type_paths);

  // get
  if (protocol.serverVersion === ServerVersion.V0_15) {
    const res = await protocol.get(
      entity,
      type_paths.filter((value) => {
        return value != 'bevy_ecs::hierarchy::Children';
      })
    );
    assert.ifError(res.error);
    assert.deepEqual(res.result, reference_v0_15);
  }
  if (protocol.serverVersion === ServerVersion.V0_16) {
    const res = await protocol.get(entity, type_paths);
    assert.ifError(res.error);
    assert.ok(res.result);
    if ('bevy_ecs::hierarchy::Children' in res.result.components)
      res.result.components['bevy_ecs::hierarchy::Children'] = [];
    assert.deepEqual(res.result, reference_v0_16);
  }

  // get (strict)
  if (protocol.serverVersion === ServerVersion.V0_15) {
    const res = await protocol.get_strict(
      entity,
      type_paths.filter((value) => {
        return value != 'bevy_ecs::hierarchy::Children';
      })
    );
    assert.ifError(res.error);
    assert.deepEqual(res.result, reference_v0_15.components);
  }
  if (protocol.serverVersion === ServerVersion.V0_16) {
    const res = await protocol.get_strict(entity, type_paths);
    assert.ifError(res.error);
    assert.ok(res.result);
    if ('bevy_ecs::hierarchy::Children' in res.result) res.result['bevy_ecs::hierarchy::Children'] = [];
    assert.deepEqual(res.result, reference_v0_16.components);
  }
}

export async function test_query_empty(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.query({});
  assert.ifError(response.error);
  assert.ok(response.result);

  for (var i = 0, l = response.result.length; i < l; i++) {
    response.result[i].entity = 0;
  }
  assert.deepEqual(response.result, Array(response.result.length).fill({ components: {}, entity: 0 }));
}

export async function test_query_by_components(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.query({ components: ['server::FavoriteEntity'] });
  assert.ok(response.result);
  assert.ifError(response.error);

  assert.strictEqual(response.result.length, 1);
  response.result[0].entity = 0;
  assert.deepEqual(response.result, [{ components: { 'server::FavoriteEntity': null }, entity: 0 }]);
}

export async function test_list_entity(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(entity);

  var response = await protocol.list(entity);
  assert.deepEqual(response.result?.sort(), [
    'bevy_ecs::hierarchy::Children',
    'bevy_ecs::name::Name',
    'server::FavoriteEntity',
    'server::Position',
    'server::Shape',
  ]);
}

export async function test_list_all(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.list();
  assert.ifError(response.error);
  if (protocol.serverVersion === ServerVersion.V0_15)
    assert.deepEqual(response.result?.sort(), [
      'bevy_ecs::name::Name',
      'server::Description',
      'server::ExistenceTime',
      'server::FavoriteEntity',
      'server::LovelyOne',
      'server::Position',
      'server::Shape',
    ]);
  if (protocol.serverVersion === ServerVersion.V0_16)
    assert.deepEqual(response.result?.sort(), [
      'bevy_ecs::hierarchy::ChildOf',
      'bevy_ecs::hierarchy::Children',
      'bevy_ecs::name::Name',
      'server::Description',
      'server::ExistenceTime',
      'server::FavoriteEntity',
      'server::LovelyOne',
      'server::Position',
      'server::Shape',
    ]);
}

export async function test_insert_then_remove(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(entity);

  var res_types = await protocol.list(entity);
  assert.deepEqual(res_types.result?.sort(), [
    'bevy_ecs::hierarchy::Children',
    'bevy_ecs::name::Name',
    'server::FavoriteEntity',
    'server::Position',
    'server::Shape',
  ]);

  var res_null = await protocol.insert(entity, { 'server::Description': 'Testing insertion and removing' });
  assert.ifError(res_null.result);
  assert.ifError(res_null.error);

  res_types = await protocol.list(entity);
  assert.deepEqual(res_types.result?.sort(), [
    'bevy_ecs::hierarchy::Children',
    'bevy_ecs::name::Name',
    'server::Description',
    'server::FavoriteEntity',
    'server::Position',
    'server::Shape',
  ]);

  res_null = await protocol.remove(entity, ['server::Description']);
  assert.ifError(res_null.result);
  assert.ifError(res_null.error);

  res_types = await protocol.list(entity);
  assert.deepEqual(res_types.result?.sort(), [
    'bevy_ecs::hierarchy::Children',
    'bevy_ecs::name::Name',
    'server::FavoriteEntity',
    'server::Position',
    'server::Shape',
  ]);
}

export async function test_spawn_then_destroy(protocol: BevyRemoteProtocol): Promise<void> {
  const lengthBefore = (await protocol.query({})).result?.length;
  assert.ok(lengthBefore);

  const spawn_res = await protocol.spawn({
    'bevy_ecs::name::Name': 'Newborn Node',
    'server::Description': 'just created node by brp.spawn()',
    'server::Position': {
      x: 5,
      y: 5,
      z: 7,
    },
  });
  assert.ok(spawn_res.result);
  assert.ok(typeof spawn_res.result.entity === 'number');
  assert.ifError(spawn_res.error);
  assert.strictEqual((await protocol.query({})).result?.length, lengthBefore + 1);

  const destroy_res = await protocol.destroy(spawn_res.result.entity);
  assert.ifError(destroy_res.result);
  assert.ifError(destroy_res.error);
  assert.strictEqual((await protocol.query({})).result?.length, lengthBefore);
}

export async function test_reparent(protocol: BevyRemoteProtocol): Promise<void> {
  const parent = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(parent);

  const child0 = (await protocol.spawn({ 'bevy_ecs::name::Name': 'test child 1' })).result?.entity;
  assert.ok(child0);
  const child1 = (await protocol.spawn({ 'bevy_ecs::name::Name': 'test child 2' })).result?.entity;
  assert.ok(child1);
  protocol.reparent([child0, child1], parent);

  const response = await protocol.query({
    components: ['bevy_ecs::hierarchy::Children'],
    filterWith: ['server::FavoriteEntity'],
  });
  assert.ok(response.result);

  const children: BrpValue = response.result[0].components['bevy_ecs::hierarchy::Children'];
  assert.ok(Array.isArray(children) && children.every((item) => typeof item === 'number'));
  assert.ok(children.includes(child0));
  assert.ok(children.includes(child1));

  await protocol.destroy(child0);
  await protocol.destroy(child1);
}

export async function test_get_watch(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::Description'] })).result?.[0].entity;
  assert.ok(entity);

  var changed: BrpGetWatchResult | undefined;
  const apply = { 'server::Description': 'here is updated description' };
  const controller = new AbortController();
  const observer = (arg: BrpGetWatchResult) => {
    changed = arg;
    controller.abort();
  };

  const promise = protocol.get_watch(entity, ['server::Description'], controller.signal, observer);
  await protocol.insert(entity, apply);

  await promise;
  assert.deepEqual(changed, {
    components: apply,
    errors: {},
    removed: [],
  });
}

export async function test_get_watch_strict(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::Description'] })).result?.[0].entity;
  assert.ok(entity);

  const apply = { 'server::Description': 'here is updated description' };
  const controller = new AbortController();
  const observer = (changed: BrpGetWatchStrictResult) => {
    assert.deepEqual(changed, { components: apply, removed: [] });
    controller.abort();
  };

  const promise = protocol.get_watch_strict(entity, ['server::Description'], controller.signal, observer);
  await protocol.insert(entity, apply);
  await promise;
}

export async function test_list_watch(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(entity);

  const to_insert = { 'server::Description': 'added new component (Description)' };
  const controller = new AbortController();
  const observer = (changed: BrpListWatchResult) => {
    assert.deepEqual(changed, { components: to_insert, removed: [] });
    controller.abort();
  };

  const promise = protocol.list_watch(controller.signal, observer, entity);
  await protocol.insert(entity, to_insert);
  await promise;

  // clear changes
  await protocol.remove(entity, ['server::Description']);
}

export async function test_list_watch_all(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0].entity;
  assert.ok(entity);

  const controller = new AbortController();
  const observer = (changed: BrpListWatchResult) => {
    assert.deepEqual(changed, undefined); // TODO: response
  };

  const promise = protocol.list_watch(controller.signal, observer);
  // TODO: register new component
  await promise;
  // TODO: clear changes
}
