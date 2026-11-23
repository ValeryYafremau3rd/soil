import { ControlsHelp } from '../ControlsHelp'
import type { AudioController } from '../../app/contracts/audio'
import { Fragment, useCallback, useSyncExternalStore } from 'react'
import type { DayTimeController } from '../../app/contracts/daytime'
import type { HudController } from '../../app/contracts/hud'
import type { InventoryController } from '../../app/contracts/inventory'
import type { LoadingController } from '../../app/contracts/loading'
import type { NotesController } from '../../app/contracts/notes'
import type { QuestController } from '../../app/contracts/quests'
import type { OptionsController } from '../../app/contracts/save'
import type { StatusController } from '../../app/contracts/status'
import type { TravelController } from '../../app/contracts/travel'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { ITEM_BY_ID } from '../../content/items'
import { SKILL_EFFECT_CONFIG } from '../../content/skills'
import { UI_CONFIG } from '../../content/ui'
import type { DifficultyRules } from '../../domain/character/difficulty'
import { buffDamageResistance, buffFearResistance } from '../../domain/character/perks'
import type { Vital } from '../../domain/inventory/items'
import { resolveDamageResistance, resolveFearResistance } from '../../domain/inventory/items'
import type { Character } from '../../domain/skills/character'
import { resolveEffectiveCharacter } from '../../domain/skills/condition'
import { itemBuffMultiplier, resolveSkillEffects } from '../../domain/skills/effects'
import { useMenuShortcuts } from '../../platform/ui/useMenuShortcuts'
import { CharacterDetails } from '../character/CharacterDetails'
import { ConditionPenalties } from '../character/ConditionPenalties'
import { CharacterMenu } from '../character/CharacterMenu'
import { Modal } from '../components/Modal'
import { SpriteIcon } from '../components/SpriteIcon'
import { QuickMenu } from '../inventory/QuickMenu'
import type { NoteTarget } from '../notes/QuestText'
import { NotesMenu } from '../notes/NotesMenu'
import { DeveloperConsole } from '../developer/DeveloperConsole'
import { SystemMenu } from '../options/SystemMenu'
import { QuestJournal } from '../quests/QuestMenus'
import { LocationMap } from '../travel/LocationMap'
import './hud.css'
import { StatisticsMenu } from './StatisticsMenu'

/**
 * Perform game hud.
 * @param {Function} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function GameHud({ audio, noteTarget, onOpenNote, statistics, travel, inventory, hud, daytime, character, status, difficulty, quests, options, loading, notes, perks }: {
  audio: AudioController
  noteTarget?: NoteTarget
  onOpenNote: (target: NoteTarget) => void
  statistics: import('../../app/contracts/statistics').StatisticsController
  perks: import('../../app/contracts/perks').PerksController
  notes: NotesController
  loading: LoadingController
  options: OptionsController
  quests: QuestController
  difficulty: DifficultyRules
  status: StatusController
  character: Character
  travel: TravelController
  inventory: InventoryController
  hud: HudController
  daytime: DayTimeController
}) {
  const perkState = useSyncExternalStore(perks.subscribe, perks.getSnapshot)
  const snapshot = useSyncExternalStore(travel.subscribe, travel.getSnapshot)
  const hudState = useSyncExternalStore(hud.subscribe, hud.getSnapshot)
  const time = useSyncExternalStore(daytime.subscribe, daytime.getSnapshot)
  const vitals = useSyncExternalStore(status.subscribe, status.getSnapshot)
  const carried = useSyncExternalStore(inventory.subscribe, inventory.getSnapshot)
  const effectiveCharacter = resolveEffectiveCharacter(
    character,
    inventory.getBonusItems(),
    ITEM_BY_ID,
    vitals,
    status.getLimits(),
    perkState,
    perks.buffDefinitions,
    perks.definitions
  )
  const effects = resolveSkillEffects(effectiveCharacter.skills, SKILL_EFFECT_CONFIG)
  const hasLoadedGun = inventory.getEquippedItems().some(stack => {
    const firearm = ITEM_BY_ID[stack.itemId]?.firearm

    return stack.quantity > 0 && firearm && ITEM_BY_ID[firearm.ammunitionId]?.ammunition
      && carried.items.some(ammo => ammo.itemId === firearm.ammunitionId && ammo.quantity > 0)
  })
  const phase = DAYTIME_CONFIG.phases[time.phase]
  const location = snapshot.locations.find(item => item.id === snapshot.currentLocationId)
  const activeMenu = UI_CONFIG.menus.find(menu => menu.id === hudState.menuId)
  const openMenu = useCallback(
    (id: string) => {
      if (loading.getSnapshot().phase !== 'idle') return

      if (id === 'inventory') {
        if (inventory.getSnapshot().menu?.kind === 'inventory' || inventory.getSnapshot().menu?.kind === 'keys') inventory.closeMenu()
        else inventory.openInventory()
      } else if (hud.getSnapshot().menuId === id) hud.closeMenu()
      else hud.openMenu(id)
    },
    [inventory, hud, loading]
  )
  useMenuShortcuts(UI_CONFIG.menus, openMenu)

  return <>

    <header className="game-hud-top" aria-label="Player status">
      <div className="game-hud-location"><strong>{location?.name ?? 'Unknown location'}</strong>
        <span className="game-hud-time" aria-live="polite">
          <SpriteIcon sheet={DAYTIME_CONFIG.iconSheet} crop={phase.icon} removeNeutralBackground />
          <span>Day {time.day} В· {phase.label}</span>
        </span>
      </div>

      <ControlsHelp />
      <div className="game-hud-stats">
        {UI_CONFIG.stats.map(stat => <label className={`game-hud-stat game-hud-stat--${stat.id}`} key={stat.id}>
          <span>{stat.label}</span>
          <progress aria-label={stat.label} value={vitals[stat.id as Vital]} max={status.getLimits()[stat.id as Vital]}>{vitals[stat.id as Vital]}</progress>
        </label>)}
      </div>
    </header>
    <footer className="game-hud-footer" aria-label="Game controls">
      {[UI_CONFIG.menus.slice(0, 4), UI_CONFIG.menus.slice(4)].map((
        menus,
        index
      ) => <Fragment key={index}>
          {index === 1 && <QuickMenu inventory={inventory} loading={loading} audio={audio} />}
          <nav className="game-hud-bottom" aria-label={index === 0 ? 'Character and journal menus' : 'Notes and system menus'}>
            {menus.filter(menu => menu.showInBar !== false).map(menu => <button
              type="button"
              key={menu.id}
              onClick={() => openMenu(menu.id)}
              aria-keyshortcuts={menu.key}
            >
              {menu.title} <kbd>{menu.key.toUpperCase()}</kbd>
            </button>)}
          </nav>
        </Fragment>)}
    </footer>

    {activeMenu && <Modal title={activeMenu.title} onClose={hud.closeMenu} className={activeMenu.id === 'quests' ? 'dossier-modal quest-modal' : activeMenu.id === 'character' ? 'dossier-modal character-modal' : activeMenu.id === 'map' ? 'dossier-modal map-modal' : ['notes', 'developer'].includes(activeMenu.id) ? 'dossier-modal notes-modal' : ''}>
      {activeMenu.id === 'statistics' ? <StatisticsMenu statistics={statistics} /> : activeMenu.id === 'character' ? <CharacterMenu perks={perks} daytime={daytime} skills={effectiveCharacter.skills} penalties={<ConditionPenalties current={effectiveCharacter}
        restoredEnergy={resolveEffectiveCharacter(
          character,
          inventory.getBonusItems(),
          ITEM_BY_ID,
          { ...vitals, energy: status.getLimits().energy },
          status.getLimits(),
          perkState,
          perks.buffDefinitions,
          perks.definitions
        )}
        restoredSanity={resolveEffectiveCharacter(
          character,
          inventory.getBonusItems(),
          ITEM_BY_ID,
          { ...vitals, sanity: status.getLimits().sanity },
          status.getLimits(),
          perkState,
          perks.buffDefinitions,
          perks.definitions
        )} />}>
        <CharacterDetails character={effectiveCharacter}>
          <section aria-label="Combat damage">
            <h3>Combat</h3>
            <dl>
              <div><dt>Melee damage</dt><dd>{Math.round(difficulty.hero.meleeDamage * effects.meleeDamage)}</dd></div>
              <div><dt>Ranged damage</dt><dd>{hasLoadedGun ? Math.round(difficulty.hero.shotDamage * effects.rangedDamage) : 0}</dd></div>
              <div><dt>Detection range</dt><dd>{Math.round(effects.detection * 100)}%</dd></div>
              <div><dt>Damage resistance</dt><dd>{resolveDamageResistance(
                inventory.getBonusItems(),
                ITEM_BY_ID,
                effectiveCharacter.skills,
                buffDamageResistance(
                  perkState,
                  perks.buffDefinitions,
                  itemBuffMultiplier(effectiveCharacter.skills)
                )
              )}%</dd></div>
              <div><dt>Fear resistance</dt><dd>{resolveFearResistance(
                inventory.getBonusItems(),
                ITEM_BY_ID,
                effectiveCharacter.skills,
                buffFearResistance(
                  perkState,
                  perks.buffDefinitions,
                  itemBuffMultiplier(effectiveCharacter.skills)
                )
              )}%</dd></div>
            </dl>

          </section>
        </CharacterDetails></CharacterMenu> :
        activeMenu.id === 'quests' ? <QuestJournal quests={quests} onOpenNote={onOpenNote} /> : activeMenu.id === 'map'
          ? <LocationMap locations={snapshot.locations} currentId={snapshot.currentLocationId} /> : activeMenu.id === 'options'
            ? <SystemMenu options={options} audio={audio} /> : activeMenu.id === 'developer' ? <DeveloperConsole inventory={inventory} quests={quests} /> : activeMenu.id === 'notes' ? <NotesMenu initialTarget={noteTarget} notes={notes} inventory={inventory} perks={perks} quests={quests} />
              : <div className="game-hud-empty">{activeMenu.emptyMessage && <p>{activeMenu.emptyMessage}</p>}</div>}
    </Modal>}
  </>
}
