import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createGame } from './app/bootstrap/createGame'
import { createSession } from './app/bootstrap/createSession'
import { ControlsHelp } from './ui/ControlsHelp'
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
import { GAME_VERSION } from './app/version'

export default function App() {
  const [session, setSession] = useState<{ id: number; saved?: SaveGame; showStartMenu?: boolean }>({ id: 0, showStartMenu: true })
  return <>
    <GameSession key={session.id} saved={session.saved} showStartMenu={session.showStartMenu ?? false} onLoad={saved => setSession(current => ({ id: current.id + 1, saved }))}
      onRestart={() => setSession(current => ({ id: current.id + 1 }))} />
    <small className="game-version" aria-label={`Game version ${GAME_VERSION}`}>v{GAME_VERSION}</small>
  </>
}

function GameSession({ onRestart, onLoad, saved, showStartMenu }: { onRestart: () => void; onLoad: (save: SaveGame) => void; saved?: SaveGame; showStartMenu: boolean }) {
  const [services] = useState(() => createSession(undefined, undefined, { saved, onLoad, onRestart }))
  const [startMenuOpen, setStartMenuOpen] = useState(showStartMenu && !saved)
  const [noteTarget, setNoteTarget] = useState<NoteTarget>()
  const openNote = (target: NoteTarget) => {
    setNoteTarget(target)
    services.hud.openMenu('notes')
  }
  const status = useSyncExternalStore(services.status.subscribe, services.status.getSnapshot)
  const dead = status.health <= 0
  const [deathReady, setDeathReady] = useState(false)
  const [character, setCharacter] = useState(services.character)
  const [pendingClass, setPendingClass] = useState<string | null>(null)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current || startMenuOpen || !character) return
    let active = true
    const game = createGame(host.current, services, undefined, () => { if (active) setDeathReady(true) })
    return () => { active = false; game.destroy(true) }
  }, [services, startMenuOpen, character])
  return <>
    <main ref={host} className="game-host" aria-label="Game canvas" />
    {startMenuOpen ? <StartMenu onNewGame={() => setStartMenuOpen(false)} options={services.options} messages={services.messages} />
      : character && <LocationLoading loading={services.loading} daytime={services.daytime} />}
    {!startMenuOpen && !character && !pendingClass && <ClassSelection onSelect={setPendingClass} />}
    {!character && pendingClass && <DifficultySelection classId={pendingClass} onBack={() => setPendingClass(null)} onSelect={difficultyId => {
      services.chooseClass(pendingClass, difficultyId)
      setCharacter(services.character)
      setPendingClass(null)
    }} />}
    {dead && deathReady && <DeathScreen onNewGame={services.options.restart} onLastSave={services.options.load} messages={services.messages} />}
    {character && !dead && <>
    <ControlsHelp />
    <GameMessages messages={services.messages} />
    <GameHud noteTarget={noteTarget} onOpenNote={openNote} statistics={services.statistics} perks={services.perks} notes={services.notes} loading={services.loading} options={services.options} quests={services.quests} character={character} difficulty={services.difficulty} status={services.status} travel={services.travel} inventory={services.inventory} hud={services.hud} daytime={services.daytime} />
    <QuestBoard quests={services.quests} onOpenNote={openNote} />
    <TravelMenu travel={services.travel} />
    <DialogueMenu dialogue={services.dialogue} />
    <InventoryMenu inventory={services.inventory} status={services.status} />
    <LockpickingMenu lockpicking={services.lockpicking} />
    <RestMenu rest={services.rest} daytime={services.daytime} />
    </>}
  </>
}

