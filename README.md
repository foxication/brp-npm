# Bevy-Remote-Protocol

## Installation

```
npm install bevy-remote-protocol
```

## Usage

You have to enable feature in your game project:

```toml
[dependencies]
bevy = { version = "0.15.1", features = ["bevy_remote"] }
```

And run process of remote communication:

```rust
fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(RemotePlugin::default())
        .add_plugins(RemoteHttpPlugin::default())
        .run();
}
```

In client you can call remote methods, as an example:

```typescript
import assert from 'assert';
import { BevyRemoteProtocol, BevyVersion } from 'bevy-remote-protocol';

const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, BevyVersion.V0_16);

async function spawn_entity() {
  const response = await protocol.spawn({
    'bevy_ecs::name::Name': 'Newborn Node',
    'server::Description': 'just created node by brp.spawn()',
    'server::Position': { x: 5, y: 5, z: 7 },
  });

  assert.ok(response.result);
  console.log('Entity is created:', response.result.entity);
}
```

All available methods of `BevyRemoteProtocol` you can find in [Bevy Docs: Remote](https://docs.rs/bevy/latest/bevy/remote/index.html)

## Support of old versions

Bevy-Remote-Protocol automatically translate all `TypePath` recieved from server of old version (0.15 as an example) to `TypePath` of latest version.

However you have to specify version of Bevy, to send correct requests.

If you don't want any translations, you can set version as `BevyVersion.ignore`.

## To Do

- [ ] Implement all tests
  - [ ] test `reparent` for v0.15 (is this possible?)
  - [ ] test `list+watch (all)`
