import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { bindMenuSounds } from './platform/ui/bindMenuSounds'
import { createGame } from './app/bootstrap/createGame'
import { createSession } from './app/bootstrap/createSession'
import { StorySlides } from './ui/travel/StorySlides'
import { PrologueEnding } from './ui/travel/PrologueEnding'
import { TravelMenu } from './ui/travel/TravelMenu'
import { DialogueMenu } from './ui/dialogue/DialogueMenu'
import { GameHud } from './ui/hud/GameHud'
import { InventoryMenu } from './ui/inventory/InventoryMenu'
import { LockpickingMenu } from './ui/lockpicking/LockpickingMenu'
import { RestMenu } from './ui/rest/RestMenu'
import { ClassSelection } from './ui/classes/ClassSelection'
import { DeathScreen } from './ui/death/DeathScreen'
import { DifficultySelection } from './ui/difficulty/DifficultySelection'
import { QuestBoard } from './ui/quests/QuestMenus'
import { GameMessages } from './ui/components/GameMessages'
import type { SaveGame } from './app/contracts/save'
import { LocationLoading } from './ui/travel/LocationLoading'
import { StartMenu } from './ui/options/StartMenu'
import type { NoteTarget } from './ui/notes/QuestText'
import { BrowserAudio } from './platform/BrowserAudio'
import audioConfig from './content/audio.json'
import { GAME_VERSION } from './app/version'

/**
 * Perform app.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export default function App() {
  const [session, setSession] = useState<{
    id: number
    saved?: SaveGame
    showStartMenu?: boolean
  }>({ id: 0, showStartMenu: true })

  return <>
    <GameSession key={session.id} saved={session.saved} showStartMenu={session.showStartMenu ?? false} onLoad={saved => setSession(current => ({ id: current.id + 1, saved }))}
      onRestart={() => setSession(current => ({ id: current.id + 1 }))} />
    <small className="game-version" aria-label={`Game version ${GAME_VERSION}`}>v{GAME_VERSION}</small>
  </>
}

/**
 * Perform game session.
 * @param {{ onRestart: () => void onLoad: (save: SaveGame) => void saved?: SaveGame showStartMenu: boolean }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
function GameSession({ onRestart, onLoad, saved, showStartMenu }: {
  onRestart: () => void
  onLoad: (save: SaveGame) => void
  saved?: SaveGame
  showStartMenu: boolean
}) {
  const [services] = useState(() => createSession(undefined, undefined, { saved, onLoad, onRestart }))
  // Register before passive menu effects, including story listeners that consume arrow keys.
  useLayoutEffect(() => bindMenuSounds(window, services.audio), [services])
  const [startMenuOpen, setStartMenuOpen] = useState(showStartMenu && !saved)
  const [noteTarget, setNoteTarget] = useState<NoteTarget>()

  /**
   * Open note.
   * @param {NoteTarget} target - Target considered by this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  const openNote = (target: NoteTarget) => {
    setNoteTarget(target)
    services.hud.openMenu('notes')
  }
  const status = useSyncExternalStore(services.status.subscribe, services.status.getSnapshot)
  const story = useSyncExternalStore(services.story.subscribe, services.story.getSnapshot)
  const ended = story.flags.prologue_complete === true
  const dead = status.health <= 0
  const [deathReady, setDeathReady] = useState(false)
  const [worldReady, setWorldReady] = useState(false)
  const [character, setCharacter] = useState(services.character)
  const [pendingClass, setPendingClass] = useState<string | null>(null)
  const setupModal = startMenuOpen ? 'start' : !character ? pendingClass ? 'difficulty' : 'class' : dead && deathReady ? 'death' : null
  const previousSetupModal = useRef(setupModal)
  useEffect(() => {
    if (previousSetupModal.current !== setupModal) services.audio.cue('ui')

    previousSetupModal.current = setupModal
  }, [services, setupModal])
  const host = useRef<HTMLDivElement>(null)
  useEffect(
    () => services.audio.attach(new BrowserAudio(audioConfig), services),
    [services]
  )
  useEffect(
    () => {
      services.audio.setSetup(startMenuOpen || !character || !worldReady && !ended)
    },
    [services, startMenuOpen, character, worldReady, ended]
  )
  useEffect(() => {
    // Only the initial session uses startup artwork, including character setup.
    const screen = document.getElementById('startup-screen')
    if (!screen) return

    screen.hidden = !showStartMenu || worldReady
    screen.dataset.loading = String(!startMenuOpen && !!character && !worldReady)
  }, [showStartMenu, startMenuOpen, character, worldReady])
  useEffect(
    () => {
      if (!host.current || startMenuOpen || !character || ended) return

      let active = true
      const game = createGame(
        host.current,
        services,
        () => {
          if (active) setWorldReady(true)
        },
        () => {
          if (active) setDeathReady(true)
        }
      )

      return () => {
        active = false
        game.destroy(true)
      }
    },
    [services, startMenuOpen, character, ended]
  )

  return <>
    {ended && <PrologueEnding
      route={story.flags.ending_route === 'official' ? 'official' : 'illegal'}
      story={story}
      options={services.options}
      messages={services.messages}
    />}
    <main ref={host} className="game-host" aria-label="Game canvas" />
    {startMenuOpen ? <StartMenu audio={services.audio} onNewGame={() => setStartMenuOpen(false)} options={services.options} messages={services.messages} />
      : character && !ended && (worldReady || !showStartMenu) && <LocationLoading loading={services.loading} daytime={services.daytime} />}
    {!startMenuOpen && !character && !pendingClass && <ClassSelection onSelect={setPendingClass} />}
    {!character && pendingClass && <DifficultySelection initialId={services.options.getDifficulty()} classId={pendingClass} onBack={() => setPendingClass(null)} onSelect={difficultyId => {
      services.chooseClass(pendingClass, difficultyId)
      setCharacter(services.character)
      setPendingClass(null)
    }} />}
    {dead && deathReady && <DeathScreen onNewGame={services.options.restart} onLastSave={services.options.load} messages={services.messages} />}
    {character && !dead && !ended && <>
      <GameMessages messages={services.messages} />
      <GameHud audio={services.audio} noteTarget={noteTarget} onOpenNote={openNote} statistics={services.statistics} perks={services.perks} notes={services.notes} loading={services.loading} options={services.options} quests={services.quests} character={character} difficulty={services.difficulty} status={services.status} travel={services.travel} inventory={services.inventory} hud={services.hud} daytime={services.daytime} />
      <QuestBoard quests={services.quests} onOpenNote={openNote} />
      <TravelMenu travel={services.travel} />
      <StorySlides travel={services.travel} />
      <DialogueMenu dialogue={services.dialogue} />
      <InventoryMenu inventory={services.inventory} status={services.status} />
      <LockpickingMenu lockpicking={services.lockpicking} />
      <RestMenu rest={services.rest} daytime={services.daytime} />
    </>}
  </>
}

