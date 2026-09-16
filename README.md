# Chu He Han Jie — Chinese Chess

A mobile-friendly Xiangqi game with a traditional Chinese-inspired interface. Play against the computer, take turns with a friend on one device, or invite someone to a private online room.

**[Play the game](https://aliaddyoaky.github.io/chuhe-xiangqi/)** · **[View the source code](https://github.com/aliaddyoaky/chuhe-xiangqi)**

## Features

- **Three game modes:** computer opponent, two players on one screen, and online play with a six-digit room code.
- **Three AI difficulty levels:** Beginner, Standard, and Challenge. The computer plays Black; Red moves first.
- **Xiangqi rules:** legal-move hints, captures, check, checkmate, stalemate, the flying general rule, horse-leg blocking, elephant-eye blocking, cannon screens, and river and palace restrictions.
- **Match controls:** move history, undo and restart in computer or same-screen games, resignation, and a confirmed exit back to the mode-selection screen.
- **Local progress:** computer and same-screen games are saved in the current browser and can be resumed after a refresh.
- **Responsive layout:** designed for touch screens and usable on desktop browsers.

## How to Play

1. Open the [live game](https://aliaddyoaky.github.io/chuhe-xiangqi/) and choose a mode. Select a difficulty if playing against the computer.
2. Tap or click one of your pieces. Available destinations appear on the board.
3. Tap a highlighted destination to move, or tap a highlighted opposing piece to capture it.
4. Open **设置** (Settings) to see the move history and available match controls. Use **退出 · 返回主页** (Exit · Home) to end the current match and choose a new mode.

Red always moves first. If your general is in check, your next move must resolve it. A match ends when a player is checkmated, has no legal move, or resigns.

### Playing Online

1. Both players open the **same public game URL** on separate devices.
2. One player chooses **远程对弈** (Online Play) and **创建房间** (Create Room). The game generates a six-digit code; the creator plays Red.
3. The other player chooses **远程对弈** (Online Play), enters that code, and joins as Black.
4. Keep both pages open while playing. If the guest disconnects, they can rejoin using the same code while the host's room remains open.

Online play uses PeerJS and a public signaling service to establish a browser-to-browser connection. Both players need internet access and browsers that support WebRTC. Network restrictions or signaling-service outages can prevent a connection. Online games do not support undo, unilateral restart, or saved progress after leaving the page.

## Run Locally

No package installation or build step is required. Serve the repository directory with a local HTTP server:

```bash
git clone https://github.com/aliaddyoaky/chuhe-xiangqi.git
cd chuhe-xiangqi
python3 -m http.server 8765
```

Open [http://localhost:8765/](http://localhost:8765/) in your browser. `localhost` is only accessible on your own computer; use the public site for a game across devices.

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html` and `style.css` | Game interface, board, dialogs, and responsive styling |
| `app.mjs` | Match flow, controls, browser storage, and online room connections |
| `engine.mjs` | Xiangqi rules, legal moves, game outcomes, and computer opponent |
| `engine.test.mjs` | Automated tests for the chess engine |
| `peerjs.min.js` | Bundled PeerJS client for online play |

The game uses plain HTML, CSS, and JavaScript modules. The computer opponent uses a depth-limited game-tree search; the three difficulty settings use different search depths.

## Tests

With Node.js installed, run:

```bash
node --test engine.test.mjs
```

## Deployment

The game is published as a static site with GitHub Pages. To deploy a fork, open the repository's **Settings → Pages**, choose **Deploy from a branch**, and select **`main`** and **`/ (root)`**. The site entry point is `index.html` in the repository root.

## Third-Party Software

The bundled PeerJS client is covered by its own MIT license; see [PEERJS-LICENSE.txt](PEERJS-LICENSE.txt).
