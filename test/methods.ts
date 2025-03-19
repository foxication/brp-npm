import assert from 'assert';
import test from 'node:test';
import { short, BrpValueWrapped } from '../src';

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

  const data3 = new BrpValueWrapped(null);
  data3.set([], { description: 'replaced' });
  assert.deepStrictEqual(data3.get(), { description: 'replaced' });

  const data4 = new BrpValueWrapped(null);
  data4.set(undefined, { info: 'replaced' });
  assert.deepStrictEqual(data4.get(), { info: 'replaced' });

  // don't change input data
  const data5 = new BrpValueWrapped({ hello: 'some', cruel: 'things', world: 'hide' });
  const path = ['hello'];
  data5.get(path);
  data5.set(path, 'all');
  assert.deepStrictEqual(path, ['hello']);
});
