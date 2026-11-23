import assert from 'node:assert/strict'
import test from 'node:test'
import { PatrolDeathController } from '../../src/game/entities/patrol/PatrolDeathController.ts'

function deathFixture(onCorpse, health = () => 0) {
  let complete
  let hides = 0
  const sprite = {
    active: true,
    anims: { timeScale: 3, resume() {} },
    clearTint() { return this },
    play() { return this },
    once(event, callback) { complete = callback },
    setActive(active) { this.active = active; return this },
  }
  const death = new PatrolDeathController({
    sprite, health, onCorpse, hide: () => { hides++ },
  }, 'death', 100)
  return { death, sprite, complete: () => complete(), hides: () => hides }
}

test('corpse loot waits for death animation completion and is emitted at most once', () => {
  let corpses = 0
  const fixture = deathFixture(() => { corpses++ })
  fixture.death.begin()
  fixture.death.update(200)
  assert.equal(corpses, 0)
  assert.equal(fixture.death.visible, true)
  fixture.complete()
  fixture.complete()
  assert.equal(corpses, 1)
  assert.equal(fixture.hides(), 1)
  assert.equal(fixture.sprite.active, false)
  assert.equal(fixture.death.visible, false)
})

test('patrols without corpse loot hold completed artwork for the authored duration', () => {
  const fixture = deathFixture()
  fixture.death.begin()
  fixture.death.update(200)
  assert.equal(fixture.hides(), 0)
  fixture.complete()
  fixture.death.update(99)
  assert.equal(fixture.death.visible, true)
  fixture.death.update(1)
  assert.equal(fixture.hides(), 1)
  assert.equal(fixture.sprite.active, false)
  assert.equal(fixture.sprite.anims.timeScale, 1)
})
