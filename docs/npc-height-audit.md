# Human NPC height audit

Measured prepared sprite pixels with alpha > 128 across every idle frame, before camera zoom. The standing hero is the comparison; crouching, attacks, jumping and death poses intentionally change silhouette.

All eight residents were checked across all four scheduled phases (32 placements), plus militia outdoors, in buildings and in rooms. Monsters retain their authored species sizes.

Outdoor resident height is displayHeight × definition scale × resolved placement scale. Indoor human scale is definition scale × hero roomScale / hero scale, capped by (clearance − headroom) / displayHeight. Building and room contexts both shrink the hero from 0.8 to 0.736 (15% taller than the previous indoor scale of 0.64). Indoor schedule scale is not multiplied again.

| NPC ID | Phase | District | Context | NPC height (px) | Hero height (px) | NPC / hero |
| --- | --- | --- | --- | ---: | ---: | ---: |
| bartender | morning | center | building | 87.4–89.4 | 89.1–89.8 | 97.3%–100.4% |
| cashier | morning | center | building | 87.3–90.2 | 89.1–89.8 | 97.2%–101.3% |
| citizen-caretaker | morning | center | outdoors | 94.4–95.5 | 96.8–97.6 | 96.7%–98.7% |
| citizen-clerk | morning | center | building | 85.9–88.2 | 89.1–89.8 | 95.7%–99.1% |
| citizen-mechanic | morning | factory | building | 86.3–86.8 | 89.1–89.8 | 96.1%–97.5% |
| worker | morning | factory | outdoors | 94.1–95.0 | 96.8–97.6 | 96.4%–98.2% |
| citizen-nurse | morning | living-district | building | 87.9–88.4 | 89.1–89.8 | 97.9%–99.3% |
| stranger | morning | living-district | outdoors | 93.8–95.7 | 96.8–97.6 | 96.1%–98.9% |
| bartender | afternoon | center | building | 87.4–89.4 | 89.1–89.8 | 97.3%–100.4% |
| cashier | afternoon | center | building | 87.3–90.2 | 89.1–89.8 | 97.2%–101.3% |
| citizen-clerk | afternoon | center | outdoors | 93.4–95.9 | 96.8–97.6 | 95.7%–99.1% |
| stranger | afternoon | center | outdoors | 93.8–95.7 | 96.8–97.6 | 96.1%–98.9% |
| citizen-mechanic | afternoon | factory | building | 86.3–86.8 | 89.1–89.8 | 96.1%–97.5% |
| worker | afternoon | factory | outdoors | 94.1–95.0 | 96.8–97.6 | 96.4%–98.2% |
| citizen-caretaker | afternoon | living-district | outdoors | 94.4–95.5 | 96.8–97.6 | 96.7%–98.7% |
| citizen-nurse | afternoon | living-district | building | 87.9–88.4 | 89.1–89.8 | 97.9%–99.3% |
| bartender | evening | center | building | 87.4–89.4 | 89.1–89.8 | 97.3%–100.4% |
| cashier | evening | center | building | 87.3–90.2 | 89.1–89.8 | 97.2%–101.3% |
| citizen-clerk | evening | center | building | 85.9–88.2 | 89.1–89.8 | 95.7%–99.1% |
| citizen-mechanic | evening | center | building | 86.3–86.8 | 89.1–89.8 | 96.1%–97.5% |
| citizen-nurse | evening | center | outdoors | 95.5–96.1 | 96.8–97.6 | 97.9%–99.3% |
| worker | evening | center | outdoors | 94.1–95.0 | 96.8–97.6 | 96.4%–98.2% |
| citizen-caretaker | evening | living-district | building | 86.8–87.9 | 89.1–89.8 | 96.7%–98.7% |
| stranger | evening | living-district | outdoors | 93.8–95.7 | 96.8–97.6 | 96.1%–98.9% |
| bartender | night | living-district | room | 87.4–89.4 | 89.1–89.8 | 97.3%–100.4% |
| cashier | night | living-district | room | 87.3–90.2 | 89.1–89.8 | 97.2%–101.3% |
| citizen-caretaker | night | living-district | room | 86.8–87.9 | 89.1–89.8 | 96.7%–98.7% |
| citizen-clerk | night | living-district | room | 85.9–88.2 | 89.1–89.8 | 95.7%–99.1% |
| citizen-mechanic | night | living-district | room | 86.3–86.8 | 89.1–89.8 | 96.1%–97.5% |
| citizen-nurse | night | living-district | room | 87.9–88.4 | 89.1–89.8 | 97.9%–99.3% |
| stranger | night | living-district | room | 86.3–88.1 | 89.1–89.8 | 96.1%–98.9% |
| worker | night | living-district | room | 86.6–87.4 | 89.1–89.8 | 96.4%–98.2% |
| patrol | all | all | outdoors | 95.1–96.7 | 96.8–97.6 | 97.4%–99.9% |
| patrol | all | all | building | 87.5–89.0 | 89.1–89.8 | 97.4%–99.9% |
| patrol | all | all | room | 87.5–89.0 | 89.1–89.8 | 97.4%–99.9% |
