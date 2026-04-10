# GameZone — Mini Games by Swagat Sigdel

A polished mini‑game portal built with **vanilla HTML/CSS/JavaScript**. GameZone includes **5 classic games** in one responsive, app-like experience:

- 🎯 Number Guessing  
- ✊ Rock Paper Scissors  
- ⭕ Tic‑Tac‑Toe (2‑Player or vs “unbeatable” AI)  
- 🃏 Memory Match  
- 🔮 Simon Says  

## Live Demo
This repo is designed for GitHub Pages. Once Pages is enabled, open the site at your Pages URL.

## Features
- Single-page “hub” UI with 5 games
- Clean, modern styling and animations
- Local stats/score tracking (per game)
- **Theme toggle** (light/dark)
- **PWA-ready**: `manifest.json` + `service-worker.js` for install/offline support (where supported)

## Tech Stack
- `index.html` — App layout + game views
- `style.css` — UI styling
- `app.js` — UI navigation, theme, shared UX helpers
- `game.js` — game logic
- `manifest.json`, `service-worker.js` — Progressive Web App support

## How to Run Locally

### Option A — Simple (recommended)
Use a local web server (service workers usually require `http://localhost` or HTTPS).

**VS Code**
1. Install the “Live Server” extension
2. Right click `index.html` → **Open with Live Server**

### Option B — Python
```bash
python -m http.server 8000
```
Then open:
- `http://localhost:8000`

## How to Play (Controls)
- **Number Guessing:** pick difficulty → enter guesses → use hints to find the number
- **Rock Paper Scissors:** click Rock/Paper/Scissors buttons
- **Tic‑Tac‑Toe:** choose mode (vs AI or 2‑player) → click grid cells
- **Memory Match:** click cards to flip and match pairs
- **Simon Says:** press **Start** → repeat the color pattern

## Project Structure
```text
.
├─ index.html
├─ style.css
├─ app.js
├─ game.js
├─ manifest.json
├─ service-worker.js
└─ icon.png
```

## Deployment (GitHub Pages)
1. Go to **Settings → Pages**
2. Set Source to **Deploy from a branch**
3. Choose `main` branch and `/ (root)`
4. Save, then wait for Pages to publish

## Roadmap / Ideas
- Add sound/music toggle globally
- Add difficulty options to Memory Match / Simon Says
- Add mobile haptics + accessibility improvements (reduced motion option)
- Add more games to the hub

## License
No license file is currently included. If you want this to be open source, add a `LICENSE` (MIT is a common choice).

## Credits
Built by **Swagat Sigdel**.
