# watch-drive

Watch a Hyperdrive or a Localdrive and get the diff

```
npm install watch-drive
```

## Usage

``` js
const watch = require('watch-drive')

// returns a readable stream
const w = watch(drive, prefix)

for await (const { diff } of w) {
  for (const { type, key } of diff) {
    // type is either 'update' or 'delete'
    // key is the key that changed
    console.log(type, key)
  }
}
```

## License

Apache-2.0
