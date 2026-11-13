import type { Dispatch,KeyboardEvent,SetStateAction } from 'react';
import { isModifiedOrComposing } from '../../platform/ui/isModifiedOrComposing.ts';
import type { Tab } from './noteEntries';
import { TABS } from './noteEntries';
import "./notes.css";
export function notesKeyboard({tab,selected,discovered,setTab,setSelection}: {
tab: Tab; selected?: string; discovered: Record<Tab, readonly string[]>;
setTab: Dispatch<SetStateAction<Tab>>; setSelection: Dispatch<SetStateAction<Partial<Record<Tab,string>>>>;
}) { return (event: KeyboardEvent<HTMLDivElement>) => {
        if (
          isModifiedOrComposing(event)
        )
          return;
        if (event.key === 'Enter' && (event.target as HTMLElement).closest('.notes-group')) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) (event.target as HTMLButtonElement).click();
          return;
        }
        if (
          ![
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        const tabs = Object.keys(TABS) as Tab[];
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          ((event.key === "Home" || event.key === "End") &&
            (event.target as HTMLElement).getAttribute("role") === "tab")
        ) {
          event.preventDefault();
          event.stopPropagation();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (tabs.indexOf(tab) +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          setTab(tabs[next]);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`#notes-tab-${tabs[next]}`)
            ?.focus();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          if (tab === 'items' || tab === 'perks') {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.notes-entries button'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = index < 0 ? 0 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
            buttons[next]?.focus();
            return;
          }
          if (!discovered[tab].length) return;
          const index = selected ? discovered[tab].indexOf(selected) : 0;
          const next = Math.max(
            0,
            Math.min(
              discovered[tab].length - 1,
              index + (event.key === "ArrowDown" ? 1 : -1),
            ),
          );
          setSelection((current) => ({
            ...current,
            [tab]: discovered[tab][next],
          }));
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>(".notes-entries button")[next]?.focus();
        }
      }
}
