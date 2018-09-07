const assert = require('assert')
const { Map, List, fromJS } = require('immutable')
const Backend = require('../src/backend')
const uuid = require('../src/uuid')
const ROOT_ID = '00000000-0000-0000-0000-000000000000'

describe('Backend', () => {
  describe('incremental diffs', () => {
    it('should assign to a key in a map', () => {
      const actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'magpie'})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      assert.deepEqual(patch1, {diffs: [
        {action: 'set', obj: ROOT_ID, path: [], type: 'map', key: 'bird', value: 'magpie'}
      ]})
    })

    it('should make a conflict on assignment to the same key', () => {
      const change1 = Map({actor: 'actor1', seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'magpie'})
      )})
      const change2 = Map({actor: 'actor2', seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'blackbird'})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      const [s2, patch2] = Backend.applyChanges(s1, List.of(change2), true)
      assert.deepEqual(patch2, {diffs: [
        {action: 'set', obj: ROOT_ID, path: [], type: 'map', key: 'bird', value: 'blackbird',
          conflicts: [{actor: 'actor1', value: 'magpie'}]}
      ]})
    })

    it('should delete a key from a map', () => {
      const actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'magpie'})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'del', obj: ROOT_ID, key: 'bird'})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      const [s2, patch2] = Backend.applyChanges(s1, List.of(change2), true)
      assert.deepEqual(patch2, {diffs: [
        {action: 'remove', obj: ROOT_ID, path: [], type: 'map', key: 'bird'}
      ]})
    })

    it('should create nested maps', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeMap', obj: birds}),
        Map({action: 'set',     obj: birds,   key: 'wrens', value: 3}),
        Map({action: 'link',    obj: ROOT_ID, key: 'birds', value: birds})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      assert.deepEqual(patch1, {diffs: [
        {action: 'create', obj: birds,   type: 'map'},
        {action: 'set',    obj: birds,   type: 'map', path: null, key: 'wrens', value: 3},
        {action: 'set',    obj: ROOT_ID, type: 'map', path: [],   key: 'birds', value: birds, link: true}
      ]})
    })

    it('should assign to keys in nested maps', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeMap', obj: birds}),
        Map({action: 'set',     obj: birds,   key: 'wrens', value: 3}),
        Map({action: 'link',    obj: ROOT_ID, key: 'birds', value: birds})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'set',     obj: birds,   key: 'sparrows', value: 15})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      const [s2, patch2] = Backend.applyChanges(s1, List.of(change2), true)
      assert.deepEqual(patch2, {diffs: [
        {action: 'set', obj: birds, type: 'map', path: ['birds'], key: 'sparrows', value: 15}
      ]})
    })

    it('should create lists', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeList', obj: birds}),
        Map({action: 'ins',      obj: birds,   key: '_head',      elem: 1}),
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'chaffinch'}),
        Map({action: 'link',     obj: ROOT_ID, key: 'birds',      value: birds})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      assert.deepEqual(patch1, {diffs: [
        {action: 'create', obj: birds,   type: 'list'},
        {action: 'insert', obj: birds,   type: 'list', path: null, index: 0, value: 'chaffinch', elemId: `${actor}:1`},
        {action: 'set',    obj: ROOT_ID, type: 'map',  path: [],   key: 'birds', value: birds, link: true}
      ]})
    })

    it('should apply updates inside lists', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeList', obj: birds}),
        Map({action: 'ins',      obj: birds,   key: '_head',      elem: 1}),
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'chaffinch'}),
        Map({action: 'link',     obj: ROOT_ID, key: 'birds',      value: birds})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'greenfinch'})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      const [s2, patch2] = Backend.applyChanges(s1, List.of(change2), true)
      assert.deepEqual(patch2, {diffs: [
        {action: 'set', obj: birds, type: 'list', path: ['birds'], index: 0, value: 'greenfinch'}
      ]})
    })

    it('should delete list elements', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeList', obj: birds}),
        Map({action: 'ins',      obj: birds,   key: '_head',      elem: 1}),
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'chaffinch'}),
        Map({action: 'link',     obj: ROOT_ID, key: 'birds',      value: birds})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'del',      obj: birds,   key: `${actor}:1`})
      )})
      const [s1, patch1] = Backend.applyChanges(Backend.init(), List.of(change1), true)
      const [s2, patch2] = Backend.applyChanges(s1, List.of(change2), true)
      assert.deepEqual(patch2, {diffs: [
        {action: 'remove', obj: birds, type: 'list', path: ['birds'], index: 0}
      ]})
    })
  })

  describe('materializing from scratch', () => {
    it('should include the most recent value for a key', () => {
      const actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'magpie'})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'blackbird'})
      )})
      const [s, patch] = Backend.applyChanges(Backend.init(), List.of(change1, change2), false)
      assert.deepEqual(patch, {diffs: [
        {action: 'set', obj: ROOT_ID, type: 'map', key: 'bird', value: 'blackbird'}
      ]})
    })

    it('should include conflicting values for a key', () => {
      const change1 = Map({actor: 'actor1', seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'magpie'})
      )})
      const change2 = Map({actor: 'actor2', seq: 1, deps: Map(), ops: List.of(
        Map({action: 'set', obj: ROOT_ID, key: 'bird', value: 'blackbird'})
      )})
      const [s, patch] = Backend.applyChanges(Backend.init(), List.of(change1, change2), false)
      assert.deepEqual(patch, {diffs: [
        {action: 'set', obj: ROOT_ID, type: 'map', key: 'bird', value: 'blackbird',
          conflicts: [{actor: 'actor1', value: 'magpie'}]}
      ]})
    })

    it('should create nested maps', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeMap', obj: birds}),
        Map({action: 'set',     obj: birds,   key: 'wrens', value: 3}),
        Map({action: 'link',    obj: ROOT_ID, key: 'birds', value: birds})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'del',     obj: birds,   key: 'wrens'}),
        Map({action: 'set',     obj: birds,   key: 'sparrows', value: 15})
      )})
      const [s, patch] = Backend.applyChanges(Backend.init(), List.of(change1, change2), false)
      assert.deepEqual(patch, {diffs: [
        {action: 'create', obj: birds,   type: 'map'},
        {action: 'set',    obj: birds,   type: 'map', key: 'sparrows', value: 15},
        {action: 'set',    obj: ROOT_ID, type: 'map', key: 'birds',    value: birds, link: true}
      ]})
    })

    it('should create lists', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeList', obj: birds}),
        Map({action: 'ins',      obj: birds,   key: '_head',      elem: 1}),
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'chaffinch'}),
        Map({action: 'link',     obj: ROOT_ID, key: 'birds',      value: birds})
      )})
      const [s, patch] = Backend.applyChanges(Backend.init(), List.of(change1), false)
      assert.deepEqual(patch, {diffs: [
        {action: 'create', obj: birds,   type: 'list'},
        {action: 'insert', obj: birds,   type: 'list', index: 0, value: 'chaffinch', elemId: `${actor}:1`},
        {action: 'set',    obj: ROOT_ID, type: 'map',  key: 'birds', value: birds, link: true}
      ]})
    })

    it('should include the latest state of a list', () => {
      const birds = uuid(), actor = uuid()
      const change1 = Map({actor, seq: 1, deps: Map(), ops: List.of(
        Map({action: 'makeList', obj: birds}),
        Map({action: 'ins',      obj: birds,   key: '_head',      elem: 1}),
        Map({action: 'set',      obj: birds,   key: `${actor}:1`, value: 'chaffinch'}),
        Map({action: 'ins',      obj: birds,   key: `${actor}:1`, elem: 2}),
        Map({action: 'set',      obj: birds,   key: `${actor}:2`, value: 'goldfinch'}),
        Map({action: 'link',     obj: ROOT_ID, key: 'birds',      value: birds})
      )})
      const change2 = Map({actor, seq: 2, deps: Map(), ops: List.of(
        Map({action: 'del',      obj: birds,   key: `${actor}:1`}),
        Map({action: 'ins',      obj: birds,   key: `${actor}:1`, elem: 3}),
        Map({action: 'set',      obj: birds,   key: `${actor}:3`, value: 'greenfinch'}),
        Map({action: 'set',      obj: birds,   key: `${actor}:2`, value: 'goldfinches!!'})
      )})
      const [s, patch] = Backend.applyChanges(Backend.init(), List.of(change1, change2), false)
      assert.deepEqual(patch, {diffs: [
        {action: 'create', obj: birds,   type: 'list'},
        {action: 'insert', obj: birds,   type: 'list', index: 0, value: 'greenfinch',    elemId: `${actor}:3`},
        {action: 'insert', obj: birds,   type: 'list', index: 1, value: 'goldfinches!!', elemId: `${actor}:2`},
        {action: 'set',    obj: ROOT_ID, type: 'map',  key: 'birds', value: birds, link: true}
      ]})
    })
  })
})