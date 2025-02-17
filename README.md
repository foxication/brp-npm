# Bevy-Bridge

## Description

Bevy Remote Protocol Client

## Installation

```
npm install bevy-bridge
```

## API

```
get()
get_strict()
list()

so on...
```

## Example

```Node
import { BevyRemoteProtocol, BevyVersion } from 'bevy-bridge';

const protocol = new BevyRemoteProtocol(
  BevyRemoteProtocol.DEFAULT_URL,
  BevyVersion.V0_16
);

async function spawn_entity() {
  const response = await protocol.spawn({
    'bevy_ecs::name::Name': 'Newborn Node',
    'server::Description': 'just created node by brp.spawn()',
    'server::Position': { x: 5, y: 5, z: 7 },
  });
  assert.ok(response.result);
  const entity = response.result.entity;
}
```

## Development Dependencies

- `@types/node` to provide TypeScript with Node.js API types
- `esbuild` for bundle creation
- `tsx` for running code from cli
- `typescript` for type-check with the tsc command

## Commands

```powershell
# build package for node
npm run build

# run tests
npx tsx --test
```

## How to test

Run `npx tsx --test`. It will automatically compile and run examples,
while testing sending requests or recieving responses.

## Support of old versions

Bevy Bridge works on TypePaths of latest version.

To communicate with server on old versions, for example 0.15, Bevy Bridge
automatically does:

- translate TypePaths of 0.16 to 0.15 on sending request
- translate TypePaths of 0.15 to 0.16 on recieving response

## To Do

- [ ] Rename classes/variables
- [ ] Update `README.md`
  - [ ] Usage
  - [ ] Full API
  - [ ] How it works
    - [ ] Examples
    - [ ] Translation
  - [ ] Explanation of dependencies
  - [ ] Contribution
    - [ ] How to issue
    - [ ] How to pull request
    - [ ] How to format
    - [ ] How to test
- [ ] Publish on github
- [ ] Publish on npm
- [ ] Implement all tests
  - [ ] test `reparent` for v0.15 (is this possible?)
  - [ ] test `list+watch (all)`
