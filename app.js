
// ============================
// CONFIG: ruta del CSV
// ============================
const APP_VERSION = "1.1.0";
const CSV_URL = "data/words-es.csv?v=" + APP_VERSION;
  
  // Detectar si el dispositivo tiene pantalla táctil
const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Datos en memoria
let categories = {};      // { categoria: [ {word, hint}, ... ] }
let decksByCategory = {}; // barajas sin repetir
let sheetLoaded = false;

// Estado del juego
const gameState = {
  numPlayers: 3,
  currentPlayer: 1,
  selectedCategory: "aleatorio",
  secretWord: "",
  secretHint: "",
  impostorIndex: 1,
  roleShown: false,
  playerNames: [],
  playerAvatars: [],   // índice de avatar elegido por jugador (1–8)
  ordenRonda: [],
  starterPlayer: 1
};

const MAX_AVATARS = 8; // avatar1.png ... avatar8.png

// ============================
// UTILIDADES
// ============================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Convierte CSV a objetos
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",");

  const idxCategory = headers.indexOf("category");
  const idxWord     = headers.indexOf("word");
  const idxHint     = headers.indexOf("hint");

  const result = {};

  rows.forEach(line => {
    const parts = line.split(",");
    const cat   = parts[idxCategory]?.trim();
    const word  = parts[idxWord]?.trim();
    const hint  = parts[idxHint]?.trim();

    if (!cat || !word) return;

    if (!result[cat]) result[cat] = [];
    result[cat].push({
      word,
      hint: hint || ""
    });
  });

  return result;
}

// Lee CSV de GitHub Pages
async function loadWordsFromCsv() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("No se pudo cargar el CSV");
    const csvText = await res.text();

    categories = parseCsv(csvText);
    decksByCategory = {};

    // Crear baraja por categoría
    Object.keys(categories).forEach(cat => {
      decksByCategory[cat] = [...categories[cat]];
      shuffle(decksByCategory[cat]);
    });

    // Baraja global "all"
    decksByCategory.all = Object.values(categories).flat();
    shuffle(decksByCategory.all);

    sheetLoaded = true;
    console.log("CSV cargado. Categorías:", Object.keys(categories));
  } catch (err) {
    console.error("Error cargando CSV:", err);
    sheetLoaded = false;
  }
}

// ============================
// CAMBIO DE PANTALLAS
// ============================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function backToStart() {
  showScreen("screen-start");
}

function goToSetup() {
  showScreen("screen-setup");
}

// ============================
// INPUTS DE NOMBRES + AVATARES
// ============================
function refreshPlayerNameInputs() {
  const numSel    = document.getElementById("selectPlayers");
  const container = document.getElementById("playerNamesContainer");
  const n         = parseInt(numSel.value, 10);

  container.innerHTML = "";
  gameState.playerAvatars = gameState.playerAvatars || [];

  for (let i = 1; i <= n; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    // Input de nombre
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Jugador ${i}`;
    input.id = `playerName${i}`;

    // Avatar por defecto si no estaba
    const idxArr = i - 1;
    if (!gameState.playerAvatars[idxArr]) {
      gameState.playerAvatars[idxArr] = ((idxArr % MAX_AVATARS) + 1);
    }
    const avatarIndex = gameState.playerAvatars[idxArr];

    // Imagen de avatar
    const avatarImg = document.createElement("img");
    avatarImg.className = "avatar-thumb";
    avatarImg.src = `img/avatar${avatarIndex}.png`;
    avatarImg.alt = `Avatar jugador ${i}`;
    avatarImg.dataset.playerIndex = idxArr;

    avatarImg.addEventListener("click", () => {
      cycleAvatar(idxArr, avatarImg);
    });

    row.appendChild(input);
    row.appendChild(avatarImg);
    container.appendChild(row);
  }
}

function cycleAvatar(playerIdx, imgEl) {
  let current = gameState.playerAvatars[playerIdx] || 1;
  let next = current + 1;
  if (next > MAX_AVATARS) next = 1;

  gameState.playerAvatars[playerIdx] = next;
  if (imgEl) {
    imgEl.src = `img/avatar${next}.png`;
  }
}

// ============================
// SELECCIONAR PALABRA
// ============================
function drawWord(categoryKey) {
  const deckKey = categoryKey === "aleatorio" ? "all" : categoryKey;

  if (!decksByCategory[deckKey] || decksByCategory[deckKey].length === 0) {
    alert(
      deckKey === "all"
        ? "Se han usado todas las palabras. Se reinicia el pack completo."
        : `Se han usado todas las palabras de la categoría "${deckKey}". Se reinicia esa categoría.`
    );

    // Reiniciar baraja
    if (deckKey === "all") {
      decksByCategory.all = Object.values(categories).flat();
      shuffle(decksByCategory.all);
    } else {
      decksByCategory[deckKey] = [...categories[deckKey]];
      shuffle(decksByCategory[deckKey]);
    }
  }

  const deck = decksByCategory[deckKey];
  const idx  = Math.floor(Math.random() * deck.length);
  return deck.splice(idx, 1)[0]; // {word, hint}
}

// ============================
// EMPEZAR PARTIDA
// ============================
function startGame() {
  const numSel = document.getElementById("selectPlayers");
  const catSel = document.getElementById("selectCategory");

  gameState.numPlayers       = parseInt(numSel.value, 10);
  gameState.selectedCategory = catSel.value;

  // Guardar nombres
  gameState.playerNames = [];
  for (let i = 1; i <= gameState.numPlayers; i++) {
    const input = document.getElementById(`playerName${i}`);
    const name  = (input && input.value.trim()) || `Jugador ${i}`;
    gameState.playerNames.push(name);
  }

  // Seleccionar palabra
  const card = drawWord(gameState.selectedCategory);
  gameState.secretWord = card.word;
  gameState.secretHint = card.hint || "";

  // Elegir impostor
  gameState.impostorIndex =
    Math.floor(Math.random() * gameState.numPlayers) + 1;

  // Elegir jugador inicial del debate
  gameState.starterPlayer =
    Math.floor(Math.random() * gameState.numPlayers) + 1;

  // Crear orden aleatorio de jugadores para ver el rol
  gameState.ordenRonda = [];
  for (let i = 1; i <= gameState.numPlayers; i++) {
    gameState.ordenRonda.push(i);
  }
  shuffle(gameState.ordenRonda);

  gameState.currentPlayer = 1;

  prepareCurrentPlayerScreen();
  showScreen("screen-role");
}

function startAnotherRound() {
  const card = drawWord(gameState.selectedCategory);
  gameState.secretWord = card.word;
  gameState.secretHint = card.hint || "";
  gameState.impostorIndex =
    Math.floor(Math.random() * gameState.numPlayers) + 1;

  // Elegir jugador inicial del debate
  gameState.starterPlayer =
    Math.floor(Math.random() * gameState.numPlayers) + 1;

  // Crear orden aleatorio de jugadores para ver el rol
  gameState.ordenRonda = [];
  for (let i = 1; i <= gameState.numPlayers; i++) {
    gameState.ordenRonda.push(i);
  }
  shuffle(gameState.ordenRonda);

  gameState.currentPlayer = 1;

  prepareCurrentPlayerScreen();
  showScreen("screen-role");
}

// ============================
// MOSTRAR ROL DEL JUGADOR
// ============================
const cardFrontEl    = document.getElementById("cardFront");
const nextBtnEl      = document.getElementById("nextPlayerBtn");
const toggleRoleBtn  = document.getElementById("toggleRoleBtn");

// Ocultar botón en dispositivos táctiles
if (isTouch && toggleRoleBtn) {
  toggleRoleBtn.style.display = "none";
}

let cardLiftedByButton = false;

// Texto dinámico de instrucciones
const instructionText = document.getElementById("instructionText");
if (instructionText) {
  instructionText.innerHTML = isTouch
    ? "Desliza hacia arriba para ver tu rol.<br>Suelta para bajarla."
    : "Haz clic en el botón para ver u ocultar tu rol.";
}

function prepareCurrentPlayerScreen() {
  const orderBadge = document.getElementById("playerOrder");
  const roleTitle  = document.getElementById("roleTitle");
  const roleWord   = document.getElementById("roleWord");
  const roleTip    = document.getElementById("roleTip");

  // Índice de turno (1..N)
  const turnIndex = gameState.currentPlayer;

  // Jugador real según orden aleatorio (si existe), si no, el propio índice
  const realPlayer =
    gameState.ordenRonda && gameState.ordenRonda.length === gameState.numPlayers
      ? gameState.ordenRonda[turnIndex - 1]
      : turnIndex;

  const idx = realPlayer - 1;

  const isImpostor = realPlayer === gameState.impostorIndex;

  // Nombre del jugador
  const name =
    gameState.playerNames[idx] ||
    `Jugador ${realPlayer}`;

  // Nombre grande en medio
  const bigNameEl = document.getElementById("playerNameBig");
  if (bigNameEl) {
    bigNameEl.textContent = name;
  }

  // Avatar en la carta que se desliza (frontAvatar)
  const avatarIndex =
    gameState.playerAvatars[idx] ||
    ((idx % MAX_AVATARS) + 1);

  const avatarEl = document.getElementById("frontAvatar");
  if (avatarEl) {
    avatarEl.src = `img/avatar${avatarIndex}.png`;
  }

  // Badge solo con el orden "X de Y" (turno de visionado)
  if (orderBadge) {
    orderBadge.textContent = `${turnIndex} de ${gameState.numPlayers}`;
  }

  // Texto del rol
  if (isImpostor) {
    roleTitle.textContent = "Impostorcillo";
    roleWord.textContent  = "???";
    roleTip.textContent   =
      "No conoces la palabra secreta. Escucha y finge normalidad.";
  } else {
    roleTitle.textContent = "Ciudadano";
    roleWord.textContent  = `"${gameState.secretWord}"`;
    roleTip.textContent   =
      gameState.secretHint || "Da pistas sin decir la palabra directamente.";
  }

  // Reset de estado de la carta y botón
  gameState.roleShown = false;
  nextBtnEl.classList.add("hidden");
  nextBtnEl.classList.remove("active");

  cardFrontEl.style.transform = "translateY(0)";
  cardLiftedByButton = false;
  if (toggleRoleBtn) toggleRoleBtn.textContent = "Mostrar rol";
}
// Botón Mostrar / Ocultar rol (para ratón/desktop)
if (toggleRoleBtn) {
  toggleRoleBtn.addEventListener("click", () => {
    const slider = cardFrontEl.parentElement;
    const h = slider.offsetHeight || 300;

    if (!cardLiftedByButton) {
      // Levantar la carta
      cardFrontEl.style.transition = "transform 0.25s ease";
      cardFrontEl.style.transform = `translateY(${-h * 0.7}px)`;

      setTimeout(() => {
        cardFrontEl.style.transition = "";
      }, 260);

      if (!gameState.roleShown) {
        gameState.roleShown = true;
        nextBtnEl.classList.remove("hidden");
        nextBtnEl.classList.add("active");
      }

      toggleRoleBtn.textContent = "Ocultar rol";
      cardLiftedByButton = true;
    } else {
      // Bajar la carta
      cardFrontEl.style.transition = "transform 0.25s ease";
      cardFrontEl.style.transform = "translateY(0)";

      setTimeout(() => {
        cardFrontEl.style.transition = "";
      }, 260);

      toggleRoleBtn.textContent = "Mostrar rol";
      cardLiftedByButton = false;
    }
  });
}

// ============================
// SIGUIENTE JUGADOR
// ============================
function nextPlayer() {
  nextBtnEl.classList.remove("active");
  nextBtnEl.classList.add("hidden");

  gameState.currentPlayer++;

  if (gameState.currentPlayer > gameState.numPlayers) {
    // Ya han pasado todos -> pantalla de debate
    const starterIndex = gameState.starterPlayer || 1;
    const starterName =
      gameState.playerNames[starterIndex - 1] ||
      `Jugador ${starterIndex}`;
    const starterEl = document.getElementById("starterInfo");
    if (starterEl) {
      starterEl.textContent = `Empieza diciendo su pista: ${starterName}`;
    }

    showScreen("screen-debate");
    return;
  }

  prepareCurrentPlayerScreen();
  showScreen("screen-role");
}

// ============================
// DEBATE Y REVELACIÓN
// ============================
function prepareRevealScreen() {
  document.getElementById("finalWord").textContent = gameState.secretWord;

  const impostorName =
    gameState.playerNames[gameState.impostorIndex - 1] ||
    `Jugador ${gameState.impostorIndex}`;

  document.getElementById("impostorPlayer").textContent = impostorName;
}

document.getElementById("btnGoReveal").addEventListener("click", () => {
  prepareRevealScreen();
  showScreen("screen-reveal");
});

// ============================
// CARTA DESLIZABLE (TOUCH)
// ============================
let dragStartY = 0;
let dragging   = false;
let cardHeight = 0;

function onTouchStart(e) {
  const slider = cardFrontEl.parentElement;
  cardHeight   = slider.offsetHeight || 300;

  dragStartY = e.touches[0].clientY;
  dragging   = true;
  cardFrontEl.style.transition = "none";

  cardLiftedByButton = false;
  if (toggleRoleBtn) toggleRoleBtn.textContent = "Mostrar rol";
}

function onTouchMove(e) {
  if (!dragging) return;

  const currentY = e.touches[0].clientY;
  let delta = currentY - dragStartY;

  if (delta > 0) delta = 0;
  if (delta < -cardHeight) delta = -cardHeight;

  cardFrontEl.style.transform = `translateY(${delta}px)`;

  // Cuando se ha deslizado suficiente, mostramos el botón
  if (delta < -cardHeight / 3 && !gameState.roleShown) {
    gameState.roleShown = true;
    nextBtnEl.classList.remove("hidden");
    nextBtnEl.classList.add("active");
  }
}

function onTouchEnd() {
  if (!dragging) return;
  dragging = false;

  cardFrontEl.style.transition = "transform 0.25s ease";
  cardFrontEl.style.transform = "translateY(0)";

  setTimeout(() => {
    cardFrontEl.style.transition = "";
  }, 250);
}

cardFrontEl.addEventListener("touchstart", onTouchStart, { passive: true });
cardFrontEl.addEventListener("touchmove",  onTouchMove,  { passive: true });
cardFrontEl.addEventListener("touchend",   onTouchEnd);

// ============================
// INICIO
// ============================
document.getElementById("selectPlayers")
  .addEventListener("change", refreshPlayerNameInputs);

loadWordsFromCsv();
refreshPlayerNameInputs();
showScreen("screen-start");

// Mostrar versión en la pantalla de inicio (si existe el elemento)
const versionEl = document.getElementById("appVersion");
if (versionEl) {
  versionEl.textContent = "Versión " + APP_VERSION;
}
