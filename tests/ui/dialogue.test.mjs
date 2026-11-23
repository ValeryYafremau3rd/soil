import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { advanceDialogue } from '../../src/domain/dialogue/dialogue.ts'
import { content } from '../helpers/content.mjs'

const definition = JSON.parse(readFileSync(new URL('../../src/content/dialogues/stranger.json', import.meta.url), 'utf8'))

test('nested dialogue keeps its own choices and goodbye; intimidation returns only at the root', () => {
  let paid = 0
  const dialogue = new DialogueService(undefined, undefined, undefined, undefined, {
    skill: () => 6, day: () => 1, pay: () => { paid++; return true }, notify: () => {},
  })
  const menu = { start: 'hello', nodes: {
    hello: { text: 'Hello', choices: [{ id: 'topic', text: 'A topic', next: 'topic' }] },
    topic: { text: 'Topic', choices: [{ id: 'deeper', text: 'Details', next: 'details' }] },
    details: { text: 'Details', choices: [{ id: 'back', text: 'Something else...', next: 'hello' }] },
  } }
  const ids = () => dialogue.getSnapshot().conversation.choices.map(choice => choice.id)
  dialogue.openDialogue('Trader', menu, 'trader')
  assert.deepEqual(ids(), ['topic', 'intimidate-money', 'goodbye'])
  dialogue.chooseReply('topic')
  assert.deepEqual(ids(), ['deeper', 'back', 'goodbye'])
  dialogue.chooseReply('intimidate-money')
  assert.equal(paid, 0)
  assert.deepEqual(ids(), ['deeper', 'back', 'goodbye'])
  dialogue.chooseReply('deeper')
  assert.deepEqual(ids(), ['back', 'goodbye'])
  dialogue.chooseReply('back')
  assert.deepEqual(ids(), ['topic', 'intimidate-money', 'goodbye'])
  dialogue.chooseReply('topic')
  dialogue.chooseReply('goodbye')
  assert.equal(dialogue.getSnapshot().conversation, null)
  dialogue.chooseReply('intimidate-money')
  assert.equal(paid, 0)
  dialogue.openDialogue('Trader', menu, 'trader')
  assert.deepEqual(ids(), ['topic', 'intimidate-money', 'goodbye'])
})

test('NPC menus group barter, quests, topics, radiant quests, skills and goodbye without changing actions', () => {
  const opened = []
  const menu = { start: 'hello', barter: { id: 'shop', items: [] }, nodes: {
    hello: { text: 'Hello', choices: [
      { id: 'goodbye', text: 'Goodbye', close: true },
      { id: 'radiant', text: 'Delivery', questId: 'daily' },
      { id: 'advice', text: 'Advice', next: 'advice' },
      { id: 'about', text: 'About you' },
      { id: 'quest-offer', text: 'Work?', next: 'offer' },
      { id: 'barter', text: 'Barter', barter: true },
      { id: 'quest-deliver', text: 'Your goods', questId: 'story' },
    ] },
    offer: { text: 'Work', choices: [{ id: 'accept', text: 'Accept', acceptQuestId: 'story' }] },
    advice: { text: 'Advice', choices: [] },
  } }
  const dialogue = new DialogueService(id => opened.push(id), {
    isRepeatable: id => id === 'daily', canChoose: () => true, choose: () => true,
  }, undefined, undefined, { skill: () => 4, day: () => 1, pay: () => true, notify: () => {} })
  const expected = ['barter', 'quest-offer', 'quest-deliver', 'about', 'radiant', 'advice', 'intimidate-money', 'goodbye']
  for (let attempt = 0; attempt < 2; attempt++) {
    dialogue.openDialogue('Trader', menu, 'trader')
    assert.deepEqual(dialogue.getSnapshot().conversation.choices.map(choice => choice.id), expected)
    dialogue.closeDialogue()
  }
  dialogue.openDialogue('Trader', menu, 'trader')
  dialogue.chooseReply('barter')
  assert.deepEqual(opened, ['shop'])
  assert.equal(dialogue.getSnapshot().conversation, null)
})

test('money intimidation checks current skill, pays once per NPC per day, and persists', () => {
  let skill = 6, day = 1, money = 0, capacity = true, chosen = 0
  const messages = []
  const actions = { skill: () => skill, day: () => day, notify: text => messages.push(text),
    pay: amount => { if (!capacity) return false; money += amount; return true } }
  const dialogue = new DialogueService(undefined, undefined, undefined, () => chosen++, actions)
  const available = () => dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'intimidate-money')
  dialogue.openDialogue('First', definition, 'first')
  assert.equal(available(), true)
  skill = 9
  dialogue.openDialogue('First', definition, 'first')
  assert.equal(available(), true)
  capacity = false
  dialogue.chooseReply('intimidate-money')
  assert.equal(dialogue.getSnapshot().conversation.text, definition.openingLines[1])
  assert.equal(chosen, 0)
  assert.deepEqual(dialogue.saveState(), {})
  capacity = true
  dialogue.chooseReply('intimidate-money')
  dialogue.chooseReply('intimidate-money')
  assert.equal(money, 4)
  assert.equal(dialogue.getSnapshot().conversation.text, 'All right, all right! Take it. Just leave me alone.')
  assert.equal(chosen, 1)
  assert.equal(available(), false)
  assert.deepEqual(dialogue.getSnapshot().conversation.choices, [{ id: 'goodbye', text: 'Goodbye.' }])
  dialogue.chooseReply('advice')
  assert.equal(chosen, 1)
  dialogue.chooseReply('goodbye')
  assert.equal(dialogue.getSnapshot().conversation, null)
  dialogue.openDialogue('First', definition, 'first')
  assert.equal(dialogue.getSnapshot().conversation, null)
  assert.equal(messages.at(-1), "This person doesn't want to talk to you now. Try later.")
  dialogue.openDialogue('Second', definition, 'second')
  dialogue.chooseReply('intimidate-money')
  assert.equal(money, 8)
  const restored = new DialogueService(undefined, undefined, undefined, undefined, { ...actions, saved: dialogue.saveState() })
  restored.openDialogue('First', definition, 'first')
  assert.equal(restored.getSnapshot().conversation, null)
  restored.chooseReply('intimidate-money')
  assert.equal(money, 8)
  day++
  restored.openDialogue('First', definition, 'first')
  restored.chooseReply('intimidate-money')
  assert.equal(money, 12)
  skill = 6
  dialogue.openDialogue('Third', definition, 'third')
  skill = 9
  dialogue.openDialogue('Third', definition, 'third')
  skill = 6
  dialogue.chooseReply('intimidate-money')
  assert.equal(money, 15)
  for (const level of [0, 1, 2, 5, 6]) {
    skill = level
    dialogue.openDialogue('Low skill', definition, `low-${level}`)
    assert.equal(available(), true)
    const before = money
    dialogue.chooseReply('intimidate-money')
    assert.equal(money - before, Math.floor(level / 2))
    assert.equal(available(), false)
  }
})

test('the stranger starts with an authored opening and offers advice and a routine topic', () => {
  const dialogue = new DialogueService()
  dialogue.openDialogue('Stranger', definition)
  assert.deepEqual(dialogue.getSnapshot().conversation, {
    npcName: 'Stranger', trust: 0, text: definition.openingLines[0], choices: [
      { id: 'lost-suitcase', text: 'Have you lost something?' },
      { id: 'about', text: 'Tell about yourself.' },
      { id: 'ask-about', text: 'I want to ask you about...' },
      { id: 'advice', text: '[Advice]' },
      { id: 'persuade-advice', text: '[Persuade] Please, I need your advice to stay safe.' },
      { id: 'goodbye', text: 'goodbye' },
    ],
  })
})

test('advice and routine topics return to the introduction', () => {
  const dialogue = new DialogueService()
  dialogue.openDialogue('Stranger', definition)
  dialogue.chooseReply('advice')
  assert.equal(dialogue.getSnapshot().conversation.text, definition.nodes.advice.text)
  dialogue.chooseReply('back')
  dialogue.chooseReply('about')
  assert.equal(dialogue.getSnapshot().conversation.text, definition.nodes.about.text)
})

test('goodbye closes the dialogue before or after saying hi', () => {
  const dialogue = new DialogueService()
  for (const sayHi of [false, true]) {
    dialogue.openDialogue('Stranger', definition)
    if (sayHi) dialogue.chooseReply('advice')
    dialogue.chooseReply('goodbye')
    assert.equal(dialogue.getSnapshot().conversation, null)
  }
})

test('closing and reopening advances the NPC opening phrase', () => {
  const dialogue = new DialogueService()
  dialogue.openDialogue('Stranger', definition)
  dialogue.chooseReply('advice')
  dialogue.closeDialogue()
  dialogue.chooseReply('advice')
  assert.equal(dialogue.getSnapshot().conversation, null)
  dialogue.openDialogue('Stranger', definition)
  assert.equal(dialogue.getSnapshot().conversation.text, definition.openingLines[1])
})

test('unknown replies and broken links do not advance a conversation', () => {
  assert.equal(advanceDialogue(definition, definition.start, 'missing'), definition.start)
  const broken = { start: 'greeting', nodes: { greeting: { text: 'hello', choices: [{ id: 'hi', text: 'hi', next: 'missing' }] } } }
  assert.equal(advanceDialogue(broken, 'greeting', 'hi'), 'greeting')
  const dialogue = new DialogueService()
  dialogue.openDialogue('Stranger', definition)
  const before = dialogue.getSnapshot()
  dialogue.chooseReply('missing')
  assert.equal(dialogue.getSnapshot(), before)
})

test('subscribers are notified for dialogue changes and can unsubscribe', () => {
  const dialogue = new DialogueService()
  let calls = 0
  const unsubscribe = dialogue.subscribe(() => { calls++ })
  dialogue.openDialogue('Stranger', definition)
  dialogue.chooseReply('advice')
  dialogue.chooseReply('goodbye')
  assert.equal(calls, 3)
  unsubscribe()
  dialogue.openDialogue('Stranger', definition)
  assert.equal(calls, 3)
})

test('every resident has a personal opening, useful advice, and all four schedule phases', () => {
  const { npcs, dialogues } = content()
  assert.equal(new Set(Object.values(npcs).map(npc => npc.name)).size, 8)
  for (const [id, npc] of Object.entries(npcs)) {
    const definition = dialogues[npc.dialogueId]
    const dialogue = new DialogueService()
    dialogue.openDialogue(npc.name, definition, id)
    const greeting = dialogue.getSnapshot().conversation
    assert.equal(greeting.text, definition.openingLines[0], id)
    assert.ok(!greeting.choices.some(choice => choice.id.includes('courier-')), 'unaccepted jobs stay hidden')
    dialogue.chooseReply('advice')
    assert.equal(dialogue.getSnapshot().conversation.text, definition.nodes.advice.text)
    dialogue.chooseReply('back')
    assert.deepEqual(dialogue.getSnapshot().conversation, { ...greeting, choices: greeting.choices.map(choice => choice.id === 'advice' ? { ...choice, visited: true } : choice) })
    dialogue.chooseReply('about')
    for (const phase of ['Morning', 'Afternoon', 'Evening', 'Night']) assert.ok(dialogue.getSnapshot().conversation.text.includes(phase), `${id}: ${phase}`)
    for (const place of Object.values(npc.schedule)) {
      if (place.roomId) assert.ok(definition.nodes.about.text.includes(place.roomId.replace('apartment-', '')), id)
    }
    dialogue.chooseReply('goodbye')
    assert.equal(dialogue.getSnapshot().conversation, null)
  }
})

test('investigation presents thoughts and actions without NPC effects, and can reopen after closing', () => {
  let talks = 0, chosen = 0, payments = 0
  const dialogue = new DialogueService(undefined, undefined, () => talks++, () => chosen++, {
    skill: () => 20, day: () => 1, pay: () => { payments++; return true }, notify: () => {},
  })
  const opening = content().dialogues.awakening
  dialogue.openInvestigation(opening)
  const investigation = dialogue.getSnapshot().conversation
  assert.equal(investigation.kind, 'investigation')
  assert.equal(investigation.trust, undefined)
  assert.match(investigation.text, /RUN EAST/)
  assert.deepEqual(investigation.choices, [{ id: 'run-east', text: 'Run east.' }])
  dialogue.chooseReply('intimidate-money')
  dialogue.chooseReply('missing')
  assert.equal(dialogue.getSnapshot().conversation, investigation)
  dialogue.closeDialogue()
  dialogue.openInvestigation(opening)
  dialogue.chooseReply('run-east')
  dialogue.chooseReply('run-east')
  assert.equal(dialogue.getSnapshot().conversation, null)
  assert.deepEqual([talks, chosen, payments], [0, 0, 0])
  dialogue.openDialogue('Stranger', definition, 'stranger')
  assert.equal(dialogue.getSnapshot().conversation.kind, undefined)
  assert.equal(talks, 1)
})

test('every NPC cycles three relevant openings without changing shared content or choices', () => {
  const data = content()
  const dialogue = new DialogueService()
  for (const [npcId, npc] of Object.entries(data.npcs)) {
    if (!npc.dialogueId) continue
    const menu = data.dialogues[npc.dialogueId]
    const original = JSON.stringify(menu)
    assert.equal(menu.openingLines.length, 3, npcId)
    assert.equal(new Set(menu.openingLines).size, 3, npcId)
    let choices
    for (let index = 0; index < 4; index++) {
      dialogue.openDialogue(npc.name, menu, npcId)
      const conversation = dialogue.getSnapshot().conversation
      assert.equal(conversation.text, menu.openingLines[index % 3])
      const ids = conversation.choices.map(choice => choice.id)
      if (choices) assert.deepEqual(ids, choices)
      choices = ids
      dialogue.chooseReply('about')
      if (dialogue.getSnapshot().conversation.choices.some(choice => choice.id === 'back')) {
        dialogue.chooseReply('back')
        assert.equal(dialogue.getSnapshot().conversation.text, menu.openingLines[index % 3])
      }
      dialogue.closeDialogue()
    }
    assert.equal(JSON.stringify(menu), original)
  }
})

test('opening rotation is independent per NPC and optional for legacy dialogues', () => {
  const dialogue = new DialogueService()
  const menu = {
    start: 'root', openingLines: ['First.', 'Second.', 'Third.'],
    nodes: { root: { text: 'Original.', choices: [{ id: 'goodbye', close: true }] } },
  }
  dialogue.openDialogue('A', menu, 'a')
  dialogue.openDialogue('B', menu, 'b')
  assert.equal(dialogue.getSnapshot().conversation.text, 'First.')
  dialogue.openDialogue('A', menu, 'a')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Second.')
  dialogue.openDialogue('Legacy', { start: menu.start, nodes: menu.nodes })
  assert.equal(dialogue.getSnapshot().conversation.text, 'Original.')
  dialogue.openInvestigation(menu)
  assert.equal(dialogue.getSnapshot().conversation.text, 'Original.')
})
