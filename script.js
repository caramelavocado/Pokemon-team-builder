// --------------------
// Simple localStorage cache for API responses
// --------------------
const CACHE_PREFIX = "pokeCache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheKey(url) {
  return CACHE_PREFIX + url;
}

async function cachedFetchJson(url, ttlMs = DEFAULT_TTL_MS) {
  const key = cacheKey(url);
  const raw = localStorage.getItem(key);

  if (raw) {
    try {
      const cached = JSON.parse(raw);
      const age = Date.now() - cached.time;
      if (age < ttlMs && cached.data) {
        return cached.data;
      }
    } catch {
      // if cache is corrupted, ignore it
    }
  }

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();

  localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
  return data;
}

// --------------------
// DOM refs
// --------------------
const nameInput = document.getElementById("nameInput");
const findBtn = document.getElementById("findBtn");
const addBtn = document.getElementById("addBtn");

const spriteImg = document.getElementById("sprite");
const cryAudio = document.getElementById("cryAudio");

const moveSelects = [
  document.getElementById("move1"),
  document.getElementById("move2"),
  document.getElementById("move3"),
  document.getElementById("move4"),
];

const statusDiv = document.getElementById("status");
const teamBody = document.getElementById("teamBody");

// current loaded pokemon data (so Add to Team knows what to add)
let currentPokemon = null;

// --------------------
// Helpers
// --------------------
function setStatus(msg, isError = false) {
  statusDiv.textContent = msg;
  statusDiv.style.color = isError ? "crimson" : "black";
}

function clearPokemonDisplay() {
  spriteImg.removeAttribute("src");
  spriteImg.removeAttribute("title");

  cryAudio.removeAttribute("src");
  cryAudio.load();

  moveSelects.forEach(sel => {
    sel.innerHTML = "";
    sel.disabled = true;
  });

  currentPokemon = null;
}

function getBestImageUrl(p) {
  // Prefer official artwork; fall back to front_default
  return (
    p?.sprites?.other?.["official-artwork"]?.front_default ||
    p?.sprites?.front_default ||
    ""
  );
}

function getCryUrl(p) {
  // PokeAPI pokemon endpoint often includes cries.latest (not guaranteed for all)
  return p?.cries?.latest || p?.cries?.legacy || "";
}

function fillMoveDropdowns(moveNames) {
  // Put a placeholder option first
  moveSelects.forEach((sel, idx) => {
    sel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select move ${idx + 1}`;
    sel.appendChild(placeholder);

    for (const m of moveNames) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    }

    sel.disabled = false;
  });
}

function getSelectedMoves() {
  return moveSelects.map(sel => sel.value).filter(v => v && v.trim().length > 0);
}

function addTeamRow(pokemonName, spriteUrl, moves) {
  const tr = document.createElement("tr");

  const tdLeft = document.createElement("td");
  const img = document.createElement("img");
  img.className = "teamSprite";
  img.src = spriteUrl || "";
  img.alt = pokemonName;

  const nameSpan = document.createElement("div");
  nameSpan.textContent = pokemonName;

  tdLeft.appendChild(img);
  tdLeft.appendChild(nameSpan);

  const tdRight = document.createElement("td");
  const ul = document.createElement("ul");
  moves.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m;
    ul.appendChild(li);
  });
  tdRight.appendChild(ul);

  tr.appendChild(tdLeft);
  tr.appendChild(tdRight);

  teamBody.appendChild(tr);
}

// --------------------
// Main: load a pokemon
// --------------------
async function loadPokemon() {
  const query = nameInput.value.trim().toLowerCase();
  if (!query) {
    setStatus("Type a Pokémon name or ID first.", true);
    return;
  }

  setStatus("Loading...");
  clearPokemonDisplay();

  try {
    const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query)}`;
    const data = await cachedFetchJson(url);

    currentPokemon = data;

    // Image
    const imgUrl = getBestImageUrl(data);
    if (imgUrl) {
      spriteImg.src = imgUrl;
      spriteImg.title = data.name;
    }

    // Audio
    const cryUrl = getCryUrl(data);
    if (cryUrl) {
      cryAudio.src = cryUrl;
      cryAudio.load();
    } else {
      // Some pokemon may not have a cry URL; keep the audio empty
      cryAudio.removeAttribute("src");
      cryAudio.load();
    }

    // Moves
    // data.moves is big; we'll turn it into a list of move names
    const moveNames = (data.moves || [])
      .map(m => m?.move?.name)
      .filter(Boolean)
      .sort();

    if (moveNames.length === 0) {
      setStatus("No moves found for this Pokémon.", true);
      return;
    }

    fillMoveDropdowns(moveNames);
    setStatus(`Loaded: ${data.name}`);
  } catch (err) {
    setStatus("Could not find that Pokémon. Try a name like 'snorlax' or a number 1–151.", true);
    console.error(err);
  }
}

// --------------------
// Add to team
// --------------------
function addToTeam() {
  if (!currentPokemon) {
    setStatus("Find a Pokémon first.", true);
    return;
  }

  const moves = getSelectedMoves();
  if (moves.length !== 4) {
    setStatus("Please choose 4 moves before adding to the team.", true);
    return;
  }

  const name = currentPokemon.name;
  const imgUrl = getBestImageUrl(currentPokemon);

  addTeamRow(name, imgUrl, moves);
  setStatus(`${name} added to team!`);
}

// --------------------
// Events
// --------------------
findBtn.addEventListener("click", loadPokemon);

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadPokemon();
});

addBtn.addEventListener("click", addToTeam);

// Initial state
clearPokemonDisplay();
setStatus("Ready.");
