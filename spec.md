# F1 Racing Game

## Current State
Full F1 top-down racing game with Stage 1 and Stage 2, lap counting, podium screen, barricades, leaderboard, pause/settings panels, and steering wheel controls. Authorization component is selected.

## Requested Changes (Diff)

### Add
- Multiplayer challenge room mode: create a room with a shareable 6-digit code, friends join the room on their own device, each player races independently, scores are polled and displayed in a room leaderboard when all players finish
- Backend: rooms stored in Motoko with room code, players list, scores, finish times
- UI: "Multiplayer" button on main menu, Create Room / Join Room screens, in-race room leaderboard overlay, room results screen after all finish

### Modify
- App.tsx to wire multiplayer flow
- Backend to support room management

### Remove
- Nothing

## Implementation Plan
1. Generate Motoko backend with room creation, joining, score submission, and polling APIs
2. Add multiplayer screens to frontend: lobby, create room, join room, waiting room, results
3. Poll room state during race to show live standings
4. Show room leaderboard when all players in room have finished
