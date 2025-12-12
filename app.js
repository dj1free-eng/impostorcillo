/* ============================
   ESTADO GLOBAL
============================ */
const EMOJI_AVATARS = ["😀","😎","🤓","😇","🤠","🥳","🤖","👽","🦊","🐯"];

const gameState = {
  mode: "classic",
  numPlayers: 3,
  currentPlayer: 1,
  playerNames: [],
  playerAvatars: [],
  secretWord: "",
  impostorIndex: 1,

  // Votación por turnos
  votesByVoter: {},   // { voterIndex: votedPlayerId }
  currentVoter: 1,
  eliminated: [],

  // Preferencias
  darkMode: false,
  soundEnabled: true
};

/* ============================
   INICIO
============================ */
document.addEventListener("DOMContentLoaded", () => {
  refreshPlayerInputs();
  showScreen("screen-start");
  updateSoundButton();
});

/* ============================
   NAVEGACIÓN
============================ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function goToSetup() {
  showScreen("screen-setup");
}

function backToStart() {
  showScreen("screen-start");
}

/* ============================
   CONFIGURACIÓN
============================ */
function refreshPlayerInputs() {
  const select = document.getElementById("selectPlayers");
  const container = document.getElementById("playerNamesContainer");
  const n = parseInt(select.value, 10);

  container.innerHTML = "";
  gameState.playerAvatars = [];

  for (let i = 1; i <= n; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    const input = document.createElement("input");
    input.placeholder = `Jugador ${i}`;
    input.id = `playerName${i}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar-thumb";
    avatar.textContent = EMOJI_AVATARS[(i - 1) % EMOJI_AVATARS.length];
    avatar.onclick = () => {
      const idx = EMOJI_AVATARS.indexOf(avatar.textContent);
      avatar.textContent = EMOJI_AVATARS[(idx + 1) % EMOJI_AVATARS.length];
    };

    row.appendChild(input);
    row.appendChild(avatar);
    container.appendChild(row);
  }
}

document.getElementById("selectPlayers").addEventListener("change", refreshPlayerInputs);

function selectMode(mode) {
  gameState.mode = mode;
  document.querySelectorAll(".mode-card").forEach(c => {
    c.classList.toggle("selected", c.dataset.mode === mode);
  });
}

/* ============================
   PARTIDA
============================ */
function startGame() {
  const select = document.getElementById("selectPlayers");
  gameState.numPlayers = parseInt(select.value, 10);

  gameState.playerNames = [];
  gameState.playerAvatars = [];

  for (let i = 1; i <= gameState.numPlayers; i++) {
    const nameInput = document.getElementById(`playerName${i}`);
    const name = nameInput.value.trim() || `Jugador ${i}`;
    gameState.playerNames.push(name);

    const avatar = document.querySelectorAll(".avatar-thumb")[i - 1].textContent;
    gameState.playerAvatars.push(avatar);
  }

  gameState.impostorIndex = Math.floor(Math.random() * gameState.numPlayers) + 1;

  showScreen("screen-debate");
}

/* ============================
   VOTACIÓN (PASA EL MÓVIL)
============================ */
function startVoting() {
  gameState.votesByVoter = {};
  gameState.currentVoter = 1;

  const grid = document.getElementById("votingGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= gameState.numPlayers; i++) {
    const card = document.createElement("div");
    card.className = "vote-card";
    card.dataset.playerId = i;

    const emoji = document.createElement("div");
    emoji.className = "emoji";
    emoji.textContent = gameState.playerAvatars[i - 1];

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = gameState.playerNames[i - 1];

    const count = document.createElement("div");
    count.className = "vote-count";
    count.id = `vote-count-${i}`;
    count.textContent = "0 votos";

    card.appendChild(emoji);
    card.appendChild(name);
    card.appendChild(count);

    card.onclick = () => voteForPlayer(i);

    grid.appendChild(card);
  }

  updateVotingTurn();
  updateVoteStatus();
  document.getElementById("revealVotesBtn").style.display = "none";
  document.getElementById("restartVotingBtn").style.display = "none";

  showScreen("screen-voting");
}

function updateVotingTurn() {
  const label = document.getElementById("votingTurnLabel");
  if (gameState.currentVoter > gameState.numPlayers) {
    label.textContent = "Todos han votado";
  } else {
    label.textContent = `Turno de votar: ${gameState.playerNames[gameState.currentVoter - 1]}`;
  }
}

function voteForPlayer(playerId) {
  if (gameState.currentVoter > gameState.numPlayers) return;

  gameState.votesByVoter[gameState.currentVoter] = playerId;
  gameState.currentVoter++;

  updateVoteDisplay();
  updateVoteStatus();
  updateVotingTurn();

  if (Object.keys(gameState.votesByVoter).length >= gameState.numPlayers) {
    document.getElementById("revealVotesBtn").style.display = "block";
    document.getElementById("restartVotingBtn").style.display = "block";
  }
}

function updateVoteDisplay() {
  const counts = {};

  Object.values(gameState.votesByVoter).forEach(pid => {
    counts[pid] = (counts[pid] || 0) + 1;
  });

  document.querySelectorAll(".vote-card").forEach(card => {
    const id = parseInt(card.dataset.playerId, 10);
    const c = counts[id] || 0;
    const el = document.getElementById(`vote-count-${id}`);
    el.textContent = `${c} ${c === 1 ? "voto" : "votos"}`;
    card.classList.toggle("voted", c > 0);
  });
}

function updateVoteStatus() {
  const total = Object.keys(gameState.votesByVoter).length;
  document.getElementById("voteStatus").textContent =
    `${total} de ${gameState.numPlayers} votos emitidos`;
}

function restartVoting() {
  startVoting();
}

/* ============================
   RESULTADOS
============================ */
function revealVotes() {
  const counts = {};
  Object.values(gameState.votesByVoter).forEach(pid => {
    counts[pid] = (counts[pid] || 0) + 1;
  });

  let max = 0;
  let eliminated = null;

  Object.entries(counts).forEach(([pid, c]) => {
    if (c > max) {
      max = c;
      eliminated = parseInt(pid, 10);
    }
  });

  gameState.eliminated.push(eliminated);

  document.getElementById("voteResultEmoji").textContent = "🎯";
  document.getElementById("voteResultText").textContent = "Jugador eliminado";
  document.getElementById("voteResultDetail").textContent =
    `${gameState.playerNames[eliminated - 1]} fue eliminado con ${max} votos.`;

  const breakdown = document.getElementById("voteBreakdown");
  breakdown.innerHTML = "<h3>Desglose</h3>";

  Object.entries(counts).forEach(([pid, c]) => {
    const p = document.createElement("p");
    p.textContent = `${gameState.playerNames[pid - 1]}: ${c} votos`;
    breakdown.appendChild(p);
  });

  showScreen("screen-vote-results");
}

/* ============================
   REVELACIÓN FINAL
============================ */
function showReveal() {
  document.getElementById("finalWord").textContent = gameState.secretWord || "—";
  document.getElementById("impostorPlayer").textContent =
    gameState.playerNames[gameState.impostorIndex - 1];
  showScreen("screen-reveal");
}

/* ============================
   UI / PREFERENCIAS
============================ */
function toggleDarkMode() {
  gameState.darkMode = !gameState.darkMode;
  document.body.classList.toggle("dark-mode");
}

function toggleSound() {
  gameState.soundEnabled = !gameState.soundEnabled;
  updateSoundButton();
}

function updateSoundButton() {
  const btn = document.getElementById("soundBtn");
  btn.textContent = gameState.soundEnabled ? "🔊" : "🔇";
}

/* ============================
   STATS / TUTORIAL (STUB)
============================ */
function showStats() {
  showScreen("screen-stats");
}

function resetStats() {
  alert("Stats reseteadas");
}

function showTutorial() {
  document.getElementById("tutorialOverlay").style.display = "flex";
}

function nextTutorialStep() {}
function closeTutorial() {
  document.getElementById("tutorialOverlay").style.display = "none";
}

/* ============================
   EXPORTS GLOBALES
============================ */
window.startGame = startGame;
window.goToSetup = goToSetup;
window.backToStart = backToStart;
window.selectMode = selectMode;
window.startVoting = startVoting;
window.voteForPlayer = voteForPlayer;
window.revealVotes = revealVotes;
window.restartVoting = restartVoting;
window.showReveal = showReveal;
window.toggleDarkMode = toggleDarkMode;
window.toggleSound = toggleSound;
window.showStats = showStats;
window.resetStats = resetStats;
window.showTutorial = showTutorial;
window.nextTutorialStep = nextTutorialStep;
window.closeTutorial = closeTutorial;
