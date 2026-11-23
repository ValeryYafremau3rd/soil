import type { PerksController } from '../../app/contracts/perks'
import type { PerkAction, PerksSnapshot } from '../../domain/character/perks'
import { ITEM_BY_ID } from '../../content/items'
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../domain/skills/character'
import { VITAL_LABELS } from '../../domain/inventory/items'
import { DAY_PHASES } from '../../app/contracts/daytime'
import skillsConfig from '../../content/skills.json'
import { legendarySkill } from '../../domain/skills/effects'
import type { Character } from '../../domain/skills/character'
import '../character/perks.css'

const ACTION_LABELS: Record<PerkAction, string> = {
  gunDefeat: 'Enemies defeated with a gun',
  meleeDefeat: 'Enemies defeated with melee attacks',
  chaseHidden: 'Chases escaped in a hideout',
  wellTrainedFinished: 'Well Trained completed',
  lockPicked: 'Successfully pick a lock',
  policeHit: 'Damage an officer',
  policeKilled: 'Kill an officer (in addition to hit points)',
  policeEngaged: 'Engage an officer (once per officer in this location visit)',
  itemSold: 'Sell one item for Thalers',
  dialogueChosen: 'Choose an accepted dialogue reply',
  questFinished: 'Complete a quest',
  persuaded: 'Choose an accepted Persuasion reply (in addition to dialogue points)',
  intimidated: 'Choose an accepted Intimidation reply',
  attackAboveHalf: 'Land a damaging melee or ranged hit above 50% charge',
  attackBelowHalf: 'Land a damaging melee or ranged hit below 50% charge',
  adviceAsked: 'Receive advice from an NPC',
  itemLooted: 'Loot one new item unit; deposits and purchases do not count',
  itemScrapped: 'Successfully recover an item from one scrap item',
  policeFightStarted: 'Land a damaging opening attack on an officer while out of combat',
  monsterFightStarted: 'Land a damaging opening attack on a monster while out of combat',
  policeEscaped: 'Escape a detected officer by leaving detection range (once per chase)',
  monsterEscaped: 'Escape a detected monster by leaving detection range (once per chase)',
  policeHidden: 'Hide within a living officer’s detection range (once per officer per location visit)',
  monsterHidden: 'Hide within a living monster’s detection range (once per monster per location visit)',
}

/**
 * Perform signed.
 * @param {number} amount - Amount to apply to the operation.
 * @returns {string} The resolved text value.
 */
const signed = (amount: number) => amount > 0 ? `+${amount}` : String(amount)

/**
 * Perform item names.
 * @param {readonly string[]} ids - The ids supplied to this operation.
 * @returns {string} The resolved text value.
 */
const itemNames = (ids: readonly string[]) => ids.map(id => ITEM_BY_ID[id].name).join(', ')

/**
 * Perform perk note.
 * @param {{ id: string perks: PerksController state: PerksSnapshot skills?: Partial<Character['skills']> }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function PerkNote({ id, perks, state, skills = {} }: {
  id: string
  perks: PerksController
  state: PerksSnapshot
  skills?: Partial<Character['skills']>
}) {
  const legendary = skillsConfig.legendary.perks.find(perk => `legendary:${perk.skill}` === id)
  if (legendary) {
    const skill = legendary.skill as keyof Character['skills']

    return <>
      <h3>Legendary {SKILL_LABELS[skill]}</h3>
      <p>Legendary perk · {legendarySkill(skills, skill) ? 'Active' : 'Inactive'}</p>
      <section className="perks-effect perks-effect--benefit" aria-label="Positive effect">
        <h4>Positive effect</h4>
        <p>{legendary.description}</p>
      </section>
      <h4>How to gain</h4>
      <p>Reach {skillsConfig.legendary.threshold} {SKILL_LABELS[skill]} skill points.</p>
      <h4>Duration</h4>
      <p>Active while {SKILL_LABELS[skill]} is {skillsConfig.legendary.threshold} or higher. The effect is removed if the skill falls below {skillsConfig.legendary.threshold}.</p>
    </>
  }

  const buff = id.startsWith('buff:') ? perks.buffDefinitions.find(entry => `buff:${entry.id}` === id) : undefined
  if (buff) {
    const effect = buff.attribute ? ATTRIBUTE_LABELS[buff.attribute]
      : buff.skill ? SKILL_LABELS[buff.skill] : buff.damageResistance ? "Damage resistance (%)" : buff.fearResistance ? 'Fear resistance (%)' : `Maximum ${VITAL_LABELS[buff.vital!]}`

    return <>
      <h3>{buff.name}</h3>
      <p>{buff.description}</p>
      <p>Temporary effect · {state.buffs?.some(active => active.id === buff.id) ? 'Active' : 'Inactive'}</p>
      <h4>How to gain</h4>
      <p>Use: {itemNames(buff.itemIds)}. One successful use activates this effect, even at full vitals.</p>
      <h4>Effect</h4>
      <p>{effect}: {signed(buff.amount)}. {buff.vital && 'Raises capacity without restoring current points.'}</p>
      <h4>Duration</h4>
      <p>{buff.durationDays} game day(s) ({buff.durationDays * DAY_PHASES.length} phases), or until sleep.
        Reusing a matching item refreshes the duration; the same effect does not stack.</p>
      <p>{buff.group ? 'Only one item’s effects can be active in this category. Using another replaces the previous bonuses and penalties together.' : 'Different temporary effects can be active together, including benefits and penalties from the same item.'}</p>
    </>
  }

  const perk = perks.definitions.find(entry => entry.id === id)!
  const competitors = perks.definitions.filter(entry => entry.group === perk.group && entry.id !== id)
  const lockedBy = competitors.find(entry => state.acquired.includes(entry.id))

  return <>
    <h3>{perk.name}</h3>
    <p>{perk.description}</p>
    <p>{state.acquired.includes(id) ? 'Acquired' : lockedBy ? `Unavailable: ${lockedBy.name} acquired` : 'Not acquired'}
      {' · '}Progress: {state.counts[id] ?? 0}/{perk.goal}</p>
    <h4>How to gain</h4>
    {perk.actionPoints ? <>
      <p>Reach {perk.goal} points:</p>
      <ul>{Object.entries(perk.actionPoints).map(([action, points]) =>
        <li key={action}>{ACTION_LABELS[action as PerkAction]}: +{points} points.</li>)}</ul>
      <p>Failed or cancelled actions do not count. Detection alone and attacks during an existing fight do not
        count as starting a fight. Dead enemies, paused gameplay and changing buildings or rooms award no escape points.</p>
    </> : <>
      <p>Successfully consume {perk.goal} units from: {itemNames(perk.itemIds)}. Each unit counts once.</p>
      <p>{perk.consumeAtMaximum ? 'These items can be consumed at full vitals.' : 'Normal item-use requirements apply.'}
        {' '}The use that reaches the threshold grants the perk; its recovery bonus applies to subsequent uses.</p>
    </>}
    <h4>Effects</h4>
    {perk.actionPoints ? <ul>{Object.entries(perk.skillModifiers ?? {}).map(([skill, amount]) =>
      <li key={skill}>{SKILL_LABELS[skill as keyof typeof SKILL_LABELS]}: {signed(amount)}.</li>)}</ul> : <>
      <p>Sanity recovery from matching items: ×{perk.sanityMultiplier}. Difficulty and Medicine still apply once.</p>
      <p>Willpower: {signed(perk.willpowerOnUse)} after use, changing to {signed(perk.willpowerAfterDay)} after
        {' '}{DAY_PHASES.length} elapsed phases without use. These modifiers do not stack with repeated uses or days.</p>
      <h4>Withdrawal</h4>
      <p>After {DAY_PHASES.length} phases without use, lose Sanity equal to {perk.withdrawalFraction * 100}% of
        the last matching item’s base Sanity recovery, once per elapsed day. Skipped phases during sleep count.
        Difficulty and Medicine do not modify this loss. Using a matching item resets the withdrawal clock.</p>
    </>}
    {perk.chargeDamage && <p>Starting damage: {signed(perk.chargeDamage.start)}x; full-charge damage: {signed(perk.chargeDamage.full)}x.
      The adjustment scales between these endpoints.</p>}
    <h4>Competing perks</h4>
    <p>{competitors.map(entry => entry.name).join(', ') || 'None'}. The first perk in this group to reach its goal
      permanently wins and prevents acquiring its alternatives. Other perk groups remain independent.
      Acquired perks persist through travel, sleep and saving.</p>
  </>
}
