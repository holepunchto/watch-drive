const Localwatch = require('localwatch')
const { Readable } = require('streamx')
const path = require('path')

module.exports = watch

class HyperdriveWatcher extends Readable {
  constructor (drive, key) {
    super({ highWaterMark: 0 })

    this.drive = drive
    this.key = key

    this._readCallback = null
    this._bumpBound = this._bump.bind(this)
    this._diff = null
    this._previous = 0
    this._maxBatchSize = 65536

    this.drive.core.on('append', this._bumpBound)
    this.drive.core.on('truncate', this._bumpBound)
  }

  _bump () {
    if (this._readCallback) {
      const cb = this._readCallback
      this._readCallback = null
      this._read(cb)
    }
  }

  async _open (cb) {
    try {
      await this.drive.update()
    } catch (err) {
      return cb(err)
    }

    this._previous = this.drive.version

    cb(null)
  }

  async _read (cb) {
    this._diff = this.drive.diff(this._previous, this.key, { update: false })
    this._previous = this.drive.version

    let result = []
    let pushed = false

    try {
      for await (const { left, right } of this._diff) {
        if (left) result.push({ type: 'update', key: left.key })
        else result.push({ type: 'delete', key: right.key })

        if (result.length < this._maxBatchSize) continue

        this.push(result)
        pushed = true
        result = []
      }
    } catch (err) {
      return cb(err)
    } finally {
      this._diff = null
    }

    if (result.length) {
      this.push(result)
      pushed = true
    }

    if (pushed) return cb(null)
    this._readCallback = cb
  }

  _predestroy () {
    if (this._diff) this._diff.destroy()
    this._diff = null
    this._bump()
  }

  _destroy (cb) {
    this._predestroy()
    this.drive.core.off('append', this._bumpBound)
    this.drive.core.off('truncate', this._bumpBound)
    cb(null)
  }
}

function watch (drive, key = '/') {
  return drive.core
    ? new HyperdriveWatcher(drive, key)
    : createLocalWatch(drive, key)
}

function createLocalWatch (drive, key) {
  const prefix = ('/' + key + '/').replace(/(^\/+)|(\/+$)+/g, '/')

  return new Localwatch(path.join(drive.root, key), { map: toKey })

  function toKey ({ type, filename }) {
    return { type, key: prefix + filename.slice(drive.root.length).replace(/\\/g, '/').replace(/^\/+/, '') }
  }
}
