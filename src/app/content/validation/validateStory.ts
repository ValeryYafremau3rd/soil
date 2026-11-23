import type { StoryConfig } from '../../../domain/quests/story'
import type { ContentContext } from './context'
import { requireCondition as check, unique } from './assertions.ts'
import type { DialogueChoice } from '../../../domain/dialogue/dialogue'
import { validateEndingSlides } from './validateEndingSlides.ts'

/**
 * Validate executable story references independently of quest design metadata.
 * @param {StoryConfig} story - Authored decisions, clues, schedule changes and exits.
 * @param {ContentContext} context - Resolved quest, NPC, world and dialogue registries.
 * @returns {void} Throws a source-specific error for missing or conflicting story references.
 */
export function validateStory(story: StoryConfig, context: ContentContext): void {
  validateEndingSlides(story, context)
  unique(story.interactions.map(object => object.id), 'story.json.interactions')
  unique(story.decisions.map(decision => decision.id), 'story.json.decisions')
  for (const id of Object.keys(story.completedFlags)) {
    check(context.quests.some(q => q.id === id), `story.json.completedFlags.${id}: unknown quest`)
  }
  for (const decision of story.decisions) validateDecision(decision, context)
  for (const object of story.interactions) validateInteraction(object, context)
  for (const dialogue of Object.values(context.dialogues)) {
    for (const node of Object.values(dialogue.nodes)) {
      for (const reply of node.choices) validateStoryChoice(reply, story)
    }
  }
  for (const quest of context.quests) for (const stage of quest.stages) {
    if (stage.worldInteraction) check(story.interactions.some(object =>
      object.id === stage.worldInteraction), `quests.json.${quest.id}.${stage.id}: unknown interaction`)
  }
}

/**
 * Ensure dialogue branch aliases and story conditions reference executable rules.
 * @param {DialogueChoice} reply - Authored reply with optional story facts or branch effects.
 * @param {StoryConfig} story - Known flags and decision options.
 * @returns {void} Throws when dialogue refers to a missing story rule or branch option.
 */
function validateStoryChoice(reply: DialogueChoice, story: StoryConfig): void {
  const branch = reply.storyDecision
  if (branch) check(story.decisions.some(decision => decision.id === branch.id
    && decision.questId === reply.questId
    && decision.choiceId === (reply.questChoiceId ?? reply.id)
    && decision.options.some(option => option.value === branch.value)),
  `story.json.dialogue.${reply.id}: unknown decision or option`)
  const flags = [...Object.values(story.completedFlags),
    'official_exit_ready', 'prologue_complete', 'ending_route']
  for (const [id, value] of Object.entries(reply.storyConditions ?? {})) {
    check(flags.includes(id) || story.decisions.some(decision => decision.id === id
      && decision.options.some(option => option.value === value)),
    `story.json.dialogue.${reply.id}: unknown story condition`)
  }
}

/**
 * Check a branch against its actual quest-stage choices and valid NPC consequences.
 * @param {StoryConfig['decisions'][number]} decision - One authored branching decision.
 * @param {ContentContext} context - Resolved content registries.
 * @returns {void} Throws for an invalid stage, default option or consequence NPC.
 */
function validateDecision(
  decision: StoryConfig['decisions'][number], context: ContentContext,
): void {
  const quest = context.quests.find(q => q.id === decision.questId)
  check(quest?.stages.some(s => s.trigger.kind === 'dialogue'
    && s.trigger.choiceId === decision.choiceId), `story.json.${decision.id}: unknown decision stage`)
  unique(decision.options.map(option => option.value), `story.json.${decision.id}.options`)
  check(decision.options.some(option => option.value === decision.legacyDefault),
    `story.json.${decision.id}: unknown legacy default`)
  for (const option of decision.options) {
    if (option.npcId) check(context.npcs[option.npcId], `story.json.${decision.id}: unknown NPC`)
    check(Object.values(context.dialogues).some(dialogue => Object.values(dialogue.nodes)
      .some(node => node.choices.some(choice => choice.storyDecision?.id === decision.id
        && choice.storyDecision.value === option.value))),
    `story.json.${decision.id}.${option.value}: missing dialogue branch`)
  }
}

/**
 * Check the world placement and stage binding for a concrete clue or exit.
 * @param {StoryConfig['interactions'][number]} object - Authored clue, notice or exit placement.
 * @param {ContentContext} context - Resolved world and quest registries.
 * @returns {void} Throws for invalid geometry ownership, NPC IDs or stage links.
 */
function validateInteraction(
  object: StoryConfig['interactions'][number], context: ContentContext,
): void {
  const location = context.locations.find(location => location.id === object.locationId)
  check(location, `story.json.${object.id}: unknown district`)
  if (object.buildingId) check(location!.buildings.some(b => b.id === object.buildingId),
    `story.json.${object.id}: unknown building`)
  for (const id of [object.absentNpcId, object.fallbackNpcId]) {
    if (id) check(context.npcs[id], `story.json.${object.id}: unknown NPC`)
  }
  if (object.stageId) check(context.quests.some(quest => quest.id === object.questId
    && quest.stages.some(stage => stage.id === object.stageId
      && stage.worldInteraction === object.id)), `story.json.${object.id}: missing world stage`)
}
