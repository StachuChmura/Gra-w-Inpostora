import React, { useState, useEffect, useRef } from "react";
import "./styles.css";

// Ikony - używamy emoji zamiast lucide-react
const Icons = {
  Copy: "📋",
  Check: "✅",
  UserPlus: "👥",
  Play: "🎮",
  Vote: "🗳️",
  RotateCcw: "🔄",
  Settings: "⚙️",
  Plus: "➕",
  X: "❌",
  Users: "👪",
};

// Shared game state storage
const gameRooms = new Map();

// Mock WebSocket
class MockSocket {
  constructor() {
    this.handlers = {};
    this.playerId = Math.random().toString(36).substring(2, 11);
    this.connected = true;
  }

  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  emit(event, data) {
    if (!this.connected) return;

    setTimeout(() => {
      if (event === "createRoom") {
        const roomCode = this.generateRoomCode();
        const player = {
          id: this.playerId,
          nickname: data.nickname,
          isHost: true,
        };
        gameRooms.set(roomCode, {
          code: roomCode,
          players: [player],
          settings: data.settings,
          host: this.playerId,
          createdAt: Date.now(),
        });
        this.roomCode = roomCode;
        this.handlers["roomCreated"]?.forEach((h) => h({ roomCode, ...data }));
        this.startPolling();
      } else if (event === "joinRoom") {
        const room = gameRooms.get(data.roomCode.toUpperCase());
        if (room && room.players.length < room.settings.maxPlayers) {
          const nicknameExists = room.players.some(
            (p) => p.nickname === data.nickname
          );
          if (nicknameExists) {
            this.handlers["joinError"]?.forEach((h) =>
              h({ error: "Nickname jest już zajęty w tym pokoju" })
            );
            return;
          }

          const player = {
            id: this.playerId,
            nickname: data.nickname,
            isHost: false,
          };
          room.players.push(player);
          gameRooms.set(data.roomCode, room);
          this.roomCode = data.roomCode;
          this.handlers["roomJoined"]?.forEach((h) =>
            h({ success: true, players: room.players })
          );
          this.startPolling();
        } else {
          this.handlers["joinError"]?.forEach((h) =>
            h({ error: "Pokój nie istnieje lub jest pełny" })
          );
        }
      } else if (event === "startGame") {
        const room = gameRooms.get(this.roomCode);
        if (room) {
          room.gameState = data.gameState;
          gameRooms.set(this.roomCode, room);
        }
      } else if (event === "submitHint") {
        const room = gameRooms.get(this.roomCode);
        if (room && room.gameState) {
          room.gameState.hints = data.hints;
          room.gameState.currentTurn = data.currentTurn;
          room.gameState.phase = data.phase;
          gameRooms.set(this.roomCode, room);
        }
      } else if (event === "submitVote") {
        const room = gameRooms.get(this.roomCode);
        if (room && room.gameState) {
          room.gameState.votes = data.votes;
          if (Object.keys(data.votes).length === room.players.length) {
            room.gameState.phase = "results";
          }
          gameRooms.set(this.roomCode, room);
        }
      } else if (event === "nextRound") {
        const room = gameRooms.get(this.roomCode);
        if (room) {
          room.gameState = data.gameState;
          gameRooms.set(this.roomCode, room);
        }
      } else if (event === "roundAction") {
        const room = gameRooms.get(this.roomCode);
        if (room && room.gameState) {
          room.gameState.phase = data.phase;
          gameRooms.set(this.roomCode, room);
        }
      } else if (event === "leaveRoom") {
        const room = gameRooms.get(this.roomCode);
        if (room) {
          room.players = room.players.filter((p) => p.id !== this.playerId);
          if (room.players.length === 0) {
            gameRooms.delete(this.roomCode);
          } else if (this.playerId === room.host) {
            room.host = room.players[0].id;
            room.players[0].isHost = true;
          }
          gameRooms.set(this.roomCode, room);
        }
      }
    }, 100);
  }

  generateRoomCode() {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (gameRooms.has(code));
    return code;
  }

  startPolling() {
    if (this.polling) return;
    this.polling = setInterval(() => {
      if (!this.roomCode) return;
      const room = gameRooms.get(this.roomCode);
      if (room) {
        this.handlers["playersUpdate"]?.forEach((h) =>
          h({ players: room.players })
        );
        if (room.gameState) {
          this.handlers["gameStateUpdate"]?.forEach((h) =>
            h({ gameState: room.gameState })
          );
        }
      } else {
        this.handlers["roomClosed"]?.forEach((h) => h());
        this.disconnect();
      }
    }, 500);
  }

  disconnect() {
    this.connected = false;
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }
}

const DEFAULT_WORDS = [
  // Podstawowe
  "jabłko",
  "komputer",
  "samolot",
  "pianino",
  "słońce",
  "ocean",
  "książka",
  "gitara",
  "parasolka",
  "czekolada",
  "telefon",
  "rower",
  "księżyc",
  "kwiat",
  "lodówka",
  "zegarek",
  "lampa",
  "krzesło",
  "kawa",
  "pizza",
  "motyl",
  "drzewo",

  // Zwierzęta
  "kot",
  "pies",
  "ptak",
  "ryba",
  "wąż",
  "żaba",
  "mysz",
  "koń",
  "krowa",
  "świnia",
  "owca",
  "koza",
  "kura",
  "kogut",
  "kaczka",
  "gęś",
  "indyk",
  "królik",
  "jeż",
  "wiewiórka",
  "lis",
  "wilk",
  "niedźwiedź",
  "łoś",
  "jeleń",
  "sarna",
  "dzik",
  "zając",
  "bóbr",
  "wydra",

  // Owoce i warzywa
  "gruszka",
  "śliwka",
  "czereśnia",
  "wiśnia",
  "truskawka",
  "malina",
  "jeżyna",
  "porzeczka",
  "agrest",
  "arbuz",
  "melon",
  "winogrono",
  "pomarańcza",
  "cytryna",
  "grejpfrut",
  "mandarynka",
  "banan",
  "ananas",
  "mango",
  "kiwi",
  "awokado",
  "kokos",
  "marchewka",
  "ziemniak",
  "cebula",
  "czosnek",
  "pomidor",
  "ogórek",
  "sałata",
  "kapusta",
  "kalafior",
  "brokuł",
  "szpinak",
  "dynia",
  "cukinia",
  "bakłażan",
  "papryka",
  "rzodkiewka",

  // Zawody
  "lekarz",
  "nauczyciel",
  "inżynier",
  "programista",
  "pilot",
  "kierowca",
  "kucharz",
  "kelner",
  "sprzedawca",
  "księgowy",
  "architekt",
  "malarz",
  "muzyk",
  "aktor",
  "sportowiec",
  "strażak",
  "policjant",
  "żołnierz",
  "listonosz",
  "rolnik",

  // Sport
  "piłka",
  "bramka",
  "boisko",
  "zawodnik",
  "trener",
  "sędzia",
  "kibic",
  "mecz",
  "turniej",
  "puchar",
  "medal",
  "zwycięzca",
  "przegrany",
  "remis",
  "gol",
  "asysta",

  // Technologia
  "tablet",
  "laptop",
  "klawiatura",
  "myszka",
  "monitor",
  "drukarka",
  "skaner",
  "router",
  "internet",
  "wi-fi",
  "bluetooth",
  "aplikacja",
  "program",
  "system",
  "plik",
  "folder",
  "hasło",
  "użytkownik",

  // POPKULTURA - Filmy i Seriale
  "Wiedźmin",
  "Netflix",
  "Potter",
  "Hogwart",
  "Voldemort",
  "GwiezdneWojny",
  "Jedi",
  "Vader",
  "LordOfTheRings",
  "Gandalf",
  "Sauron",
  "Shrek",
  "KungFuPanda",
  "Batman",
  "Superman",
  "Spiderman",
  "Ironman",
  "Avengers",
  "Thanos",
  "Joker",

  // POPKULTURA - Gry
  "Minecraft",
  "Fortnite",
  "AmongUs",
  "Roblox",
  "Cyberpunk",
  "Witcher",
  "GTA",
  "CallOfDuty",
  "FIFA",
  "LeagueOfLegends",
  "Valorant",
  "Overwatch",
  "WorldOfWarcraft",
  "EldenRing",
  "DarkSouls",
  "Skyrim",
  "Fallout",
  "MassEffect",
  "BaldursGate",

  // POPKULTURA - Anime
  "Naruto",
  "OnePiece",
  "AttackOnTitan",
  "DemonSlayer",
  "MyHeroAcademia",
  "DragonBall",
  "DeathNote",
  "FullmetalAlchemist",
  "SailorMoon",
  "Pokemon",
  "Bleach",
  "HunterXHunter",
  "JoJo",
  "Evangelion",
  "OnePunchMan",

  // POPKULTURA - Internet/Memy
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "Twitter",
  "Stream",
  "Meme",
  "Challenge",
  "Vlog",
  "Podcast",
  "Influencer",
  "Algorithm",
  "Hashtag",

  // PRZEDMIOTY CODZIENNEGO UŻYTKU
  "klucze",
  "portfel",
  "okulary",
  "lusterko",
  "grzebień",
  "szczotka",
  "pasta",
  "szampon",
  "mydło",
  "ręcznik",
  "gąbka",
  "maszynka",
  "żel",
  "dezodorant",
  "perfuma",
  "krem",
  "balsam",
  "chusteczki",
  "parasol",
  "torba",
  "plecak",
  "portmonetka",
  "długopis",
  "ołówek",
  "zeszyt",
  "książka",
  "notes",
  "kalendarz",
  "termos",
  "kubek",
  "talerz",
  "widelec",
  "nóż",
  "łyżka",
  "szklanka",
  "miska",
  "patelnia",
  "garnek",
  "sitko",
  "łyżka",
  "chochla",
  "toster",
  "czajnik",
  "mikrofalówka",
  "piekarnik",
  "zmywarka",
  "odkurzacz",
  "pralka",
  "żelazko",
  "deska",
  "szafa",
  "komoda",
  "łóżko",
  "poduszka",
  "kołdra",
  "prześcieradło",
  "zasłony",
  "dywan",
  "lampa",
  "żyrandol",
  "wazon",
  "obraz",
  "lustro",
  "wiadro",
  "mop",
  "szczotka",
  "środek",
  "płyn",
  "proszek",
  "pasta",
  "gąbka",

  // EDUKACJA
  "szkoła",
  "nauczyciel",
  "uczeń",
  "matematyka",
  "historia",
  "geografia",
  "przyroda",
  "wychowanie",
  "język",
  "chemia",
  "fizyka",
  "biologia",
  "informatyka",
  "plastyka",
  "muzyka",
  "wf",
  "religia",
  "etyka",
  "dyrektor",
  "sekretariat",
  "świetlica",
  "stołówka",
  "biblioteka",
  "boisko",
  "sala",
  "laboratorium",

  // NATURA
  "góra",
  "rzeka",
  "jezioro",
  "morze",
  "las",
  "łąka",
  "pole",
  "deszcz",
  "śnieg",
  "grad",
  "wiatr",
  "burza",
  "tęcza",
  "chmura",
  "mgła",
  "rosa",
  "szron",
  "lód",
  "skała",
  "piasek",
  "ziemia",
  "glina",
  "kamień",
  "żwir",
  "krzew",
  "krzak",
  "trawa",
  "mech",
  "grzyb",
  "kwiat",
  "kłos",
  "liść",
  "korzeń",
  "gałąź",
  "pień",

  // TRANSPORT
  "samochód",
  "autobus",
  "tramwaj",
  "pociąg",
  "metro",
  "taksówka",
  "rower",
  "hulajnoga",
  "deska",
  "rolki",
  "skateboard",
  "łódka",
  "statek",
  "prom",
  "jacht",
  "katamaran",
  "helikopter",
  "balon",
  "szybowiec",
  "rakieta",
  "spacer",

  // MUZYKA
  "fortepian",
  "skrzypce",
  "wiolonczela",
  "kontrabas",
  "flet",
  "klarnet",
  "obój",
  "fagot",
  "trąbka",
  "puzon",
  "waltornia",
  "tuba",
  "perkusja",
  "ksylofon",
  "harfa",
  "gitara",
  "bas",
  "keyboard",
  "syntezator",
  "mikrofon",
  "głośnik",
  "wzmacniacz",
  "słuchawki",
  "koncert",
  "festival",
  "zespół",
  "solista",
  "chór",
  "orkiestra",
  "dyrygent",
  "nuty",
  "akord",
  "rytm",
  "melodia",
  "harmonia",

  // SZTUKA
  "malarstwo",
  "rzeźba",
  "grafika",
  "fotografia",
  "film",
  "teatr",
  "opera",
  "balet",
  "performance",
  "instalacja",
  "kolaż",
  "fresk",
  "witraz",
  "mozaika",
  "akwarela",
  "olej",
  "akryl",
  "pastele",
  "ołówek",
  "węgiel",
  "tusz",
  "pędzel",
  "płótno",
  "papier",
  "glina",
  "drewno",
  "metal",
  "kamień",
  "szkło",
  "ceramika",
];

const PolishImpostorGame = () => {
  const [screen, setScreen] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameSettings, setGameSettings] = useState({
    minPlayers: 3,
    maxPlayers: 10,
    impostorCount: 1,
    customWords: [],
  });
  const [gameState, setGameState] = useState({
    phase: "lobby",
    word: "",
    isImpostor: false,
    currentTurn: 0,
    hints: [],
    votes: {},
    round: 1,
  });
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [customWordInput, setCustomWordInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [revealCard, setRevealCard] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const socketRef = useRef(null);

  // Load nickname from localStorage
  useEffect(() => {
    const savedNickname = localStorage.getItem("impostorNickname");
    if (savedNickname) setNickname(savedNickname);
  }, []);

  // Save nickname to localStorage
  useEffect(() => {
    if (nickname) localStorage.setItem("impostorNickname", nickname);
  }, [nickname]);

  // Initialize socket
  useEffect(() => {
    socketRef.current = new MockSocket();

    socketRef.current.on("playersUpdate", (data) => {
      setPlayers(data.players);
    });

    socketRef.current.on("gameStateUpdate", (data) => {
      setGameState((prev) => ({ ...prev, ...data.gameState }));
    });

    socketRef.current.on("roomClosed", () => {
      setError("Pokój został zamknięty");
      setScreen("home");
    });

    socketRef.current.on("joinError", (data) => {
      setError(data.error);
      setLoading(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Animation for card flip
  useEffect(() => {
    if (gameState.phase === "reveal") {
      setTimeout(() => setRevealCard(true), 500);
    }
  }, [gameState.phase]);

  const validateNickname = (name) => {
    return name.length >= 2 && name.length <= 15;
  };

  const createRoom = () => {
    if (!validateNickname(nickname)) {
      setError("Nickname musi mieć 2-15 znaków");
      return;
    }

    setError("");
    setLoading(true);
    setIsHost(true);

    socketRef.current.emit("createRoom", { nickname, settings: gameSettings });
    socketRef.current.on("roomCreated", (data) => {
      setRoomCode(data.roomCode);
      setPlayers([{ id: socketRef.current.playerId, nickname, isHost: true }]);
      setScreen("lobby");
      setLoading(false);
    });
  };

  const joinRoom = () => {
    if (!inputCode || !nickname) {
      setError("Wprowadź nickname i kod pokoju");
      return;
    }

    if (!validateNickname(nickname)) {
      setError("Nickname musi mieć 2-15 znaków");
      return;
    }

    if (inputCode.length < 4) {
      setError("Kod pokoju musi mieć co najmniej 4 znaki");
      return;
    }

    setError("");
    setLoading(true);

    socketRef.current.emit("joinRoom", {
      roomCode: inputCode.toUpperCase(),
      nickname,
    });
    socketRef.current.on("roomJoined", (data) => {
      if (data.success) {
        setPlayers(data.players);
        setRoomCode(inputCode.toUpperCase());
        setScreen("lobby");
        setLoading(false);
      }
    });
  };

  const leaveRoom = () => {
    socketRef.current.emit("leaveRoom");
    setScreen("home");
    setRoomCode("");
    setPlayers([]);
    setIsHost(false);
    setGameState({
      phase: "lobby",
      word: "",
      isImpostor: false,
      currentTurn: 0,
      hints: [],
      votes: {},
      round: 1,
    });
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const addCustomWord = () => {
    const word = customWordInput.trim();
    if (word && !gameSettings.customWords.includes(word)) {
      if (word.length < 3 || word.length > 20) {
        setError("Słowo musi mieć 3-20 znaków");
        return;
      }
      setGameSettings({
        ...gameSettings,
        customWords: [...gameSettings.customWords, word],
      });
      setCustomWordInput("");
      setError("");
    }
  };

  const removeCustomWord = (word) => {
    setGameSettings({
      ...gameSettings,
      customWords: gameSettings.customWords.filter((w) => w !== word),
    });
  };

  const startGame = () => {
    if (players.length < gameSettings.minPlayers) {
      setError(
        `Potrzeba co najmniej ${gameSettings.minPlayers} graczy do rozpoczęcia gry`
      );
      return;
    }

    const allWords = [...DEFAULT_WORDS, ...gameSettings.customWords];
    if (allWords.length === 0) {
      setError("Dodaj przynajmniej jedno słowo do puli");
      return;
    }

    const secretWord = allWords[Math.floor(Math.random() * allWords.length)];
    const impostorIndices = [];

    while (
      impostorIndices.length <
      Math.min(gameSettings.impostorCount, players.length - 1)
    ) {
      const idx = Math.floor(Math.random() * players.length);
      if (!impostorIndices.includes(idx)) impostorIndices.push(idx);
    }

    const isPlayerImpostor = impostorIndices.includes(
      players.findIndex((p) => p.id === socketRef.current.playerId)
    );
    const startingPlayer = Math.floor(Math.random() * players.length);

    const newGameState = {
      phase: "reveal",
      word: secretWord,
      isImpostor: isPlayerImpostor,
      currentTurn: startingPlayer,
      hints: [],
      votes: {},
      round: 1,
      impostorIndices,
    };

    setGameState(newGameState);
    setRevealCard(false);
    setError("");
    socketRef.current.emit("startGame", { gameState: newGameState });
  };

  const proceedToHints = () => {
    setGameState({ ...gameState, phase: "hints" });
  };

  const submitHint = (hint) => {
    const newHints = [
      ...gameState.hints,
      { playerId: socketRef.current.playerId, player: nickname, hint },
    ];
    const nextTurn = (gameState.currentTurn + 1) % players.length;

    const newPhase = newHints.length === players.length ? "roundEnd" : "hints";

    setGameState({
      ...gameState,
      hints: newHints,
      currentTurn: nextTurn,
      phase: newPhase,
    });
    socketRef.current.emit("submitHint", {
      hints: newHints,
      currentTurn: nextTurn,
      phase: newPhase,
    });
  };

  const startVoting = () => {
    setGameState({ ...gameState, phase: "voting", votes: {} });
    socketRef.current.emit("roundAction", { phase: "voting" });
  };

  const submitVote = (votedPlayer) => {
    const newVotes = {
      ...gameState.votes,
      [socketRef.current.playerId]: votedPlayer,
    };
    setGameState({ ...gameState, votes: newVotes });
    socketRef.current.emit("submitVote", { votes: newVotes });
  };

  const startNextRound = () => {
    const allWords = [...DEFAULT_WORDS, ...gameSettings.customWords];
    const secretWord = allWords[Math.floor(Math.random() * allWords.length)];
    const impostorIndices = [];

    while (
      impostorIndices.length <
      Math.min(gameSettings.impostorCount, players.length - 1)
    ) {
      const idx = Math.floor(Math.random() * players.length);
      if (!impostorIndices.includes(idx)) impostorIndices.push(idx);
    }

    const isPlayerImpostor = impostorIndices.includes(
      players.findIndex((p) => p.id === socketRef.current.playerId)
    );
    const startingPlayer = Math.floor(Math.random() * players.length);

    const newGameState = {
      phase: "reveal",
      word: secretWord,
      isImpostor: isPlayerImpostor,
      currentTurn: startingPlayer,
      hints: [],
      votes: {},
      round: gameState.round + 1,
      impostorIndices,
    };

    setGameState(newGameState);
    setRevealCard(false);
    socketRef.current.emit("nextRound", { gameState: newGameState });
  };

  // Home Screen
  if (screen === "home") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full transform transition-transform home-card">
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full text-3xl font-bold mb-4 shadow-lg">
              🕵️ Polish Impostor
            </div>
            <p className="text-gray-600 text-sm">
              Gra imposterska dla 3+ graczy
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Twój nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg"
              maxLength={15}
            />

            <button
              onClick={createRoom}
              disabled={!nickname || loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  {Icons.Play}
                  Stwórz Pokój
                </>
              )}
            </button>

            <div className="flex items-center gap-2 my-6">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">lub</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            <input
              type="text"
              placeholder="Kod pokoju"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg text-center font-mono uppercase"
              maxLength={6}
            />

            <button
              onClick={joinRoom}
              disabled={!nickname || !inputCode || loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  {Icons.UserPlus}
                  Dołącz do Pokoju
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby Screen
  if (screen === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-purple-600">
                  🕵️ Poczekalnia
                </h1>
                <button
                  onClick={leaveRoom}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors"
                >
                  Wyjdź
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 px-4 py-2 rounded-full font-mono text-purple-700 font-bold text-xl">
                  {roomCode}
                </div>
                <button
                  onClick={copyRoomLink}
                  className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 transition-colors"
                >
                  {copied ? Icons.Check : Icons.Copy}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {isHost && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="mb-4 flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
              >
                {Icons.Settings}
                Ustawienia Gry
              </button>
            )}

            {showSettings && isHost && (
              <div className="bg-purple-50 rounded-2xl p-6 mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Liczba impostorów: {gameSettings.impostorCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={gameSettings.impostorCount}
                    onChange={(e) =>
                      setGameSettings({
                        ...gameSettings,
                        impostorCount: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Własne słowa
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={customWordInput}
                      onChange={(e) => setCustomWordInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addCustomWord()}
                      placeholder="Dodaj słowo..."
                      className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                      maxLength={20}
                    />
                    <button
                      onClick={addCustomWord}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                    >
                      {Icons.Plus}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gameSettings.customWords.map((word, idx) => (
                      <div
                        key={idx}
                        className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full flex items-center gap-2 text-sm"
                      >
                        {word}
                        <button
                          onClick={() => removeCustomWord(word)}
                          className="hover:text-purple-900"
                        >
                          {Icons.X}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {players.map((player, idx) => (
                <div
                  key={player.id}
                  className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-4 text-center transform transition-transform player-card"
                >
                  <div className="text-4xl mb-2">
                    {
                      [
                        "🦊",
                        "🐻",
                        "🐨",
                        "🐼",
                        "🦁",
                        "🐯",
                        "🐸",
                        "🐹",
                        "🐰",
                        "🦝",
                      ][idx % 10]
                    }
                  </div>
                  <div className="font-bold text-gray-800">
                    {player.nickname}
                  </div>
                  {player.isHost && (
                    <div className="text-xs text-purple-600 font-semibold mt-1">
                      👑 Host
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center text-gray-600 mb-4">
              Graczy: {players.length} / {gameSettings.maxPlayers}
              <br />
              <span className="text-sm">
                Minimum: {gameSettings.minPlayers}
              </span>
            </div>

            {isHost && (
              <button
                onClick={startGame}
                disabled={players.length < gameSettings.minPlayers}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {Icons.Play}
                Rozpocznij Grę
              </button>
            )}

            {!isHost && (
              <div className="text-center text-gray-600 font-semibold">
                Czekaj na hosta...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Role Reveal Screen
  if (gameState.phase === "reveal") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-white text-4xl font-bold mb-8">
            Runda {gameState.round}
          </h2>
          <div
            className={`w-80 h-96 mx-auto cursor-pointer card-flip ${
              revealCard ? "card-flipped" : ""
            }`}
            onClick={() => setRevealCard(true)}
          >
            <div className="card-front bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl shadow-2xl flex items-center justify-center">
              <div className="text-white text-6xl">🎴</div>
            </div>
            <div
              className="card-back rounded-3xl shadow-2xl flex flex-col items-center justify-center"
              style={{
                backgroundColor: gameState.isImpostor ? "#ef4444" : "#10b981",
              }}
            >
              <div className="text-white text-6xl mb-4">
                {gameState.isImpostor ? "🎭" : "📝"}
              </div>
              <div className="text-white text-3xl font-bold mb-4">
                {gameState.isImpostor ? "IMPOSTOR" : "SŁOWO"}
              </div>
              {!gameState.isImpostor && (
                <div className="text-white text-4xl font-bold bg-white bg-opacity-20 px-6 py-3 rounded-2xl">
                  {gameState.word}
                </div>
              )}
            </div>
          </div>
          <p className="text-white mt-8 text-xl">
            {!revealCard
              ? "Kliknij kartę, aby zobaczyć swoją rolę"
              : "Zapamiętaj swoją rolę!"}
          </p>
          {revealCard && (
            <button
              onClick={proceedToHints}
              className="mt-8 bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all"
            >
              Gotowy! →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Hints Phase
  if (gameState.phase === "hints") {
    const isMyTurn =
      players[gameState.currentTurn]?.id === socketRef.current?.playerId;
    const [hintInput, setHintInput] = useState("");

    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-blue-600 mb-2">
                Runda Wskazówek
              </h2>
              <div className="text-gray-600">
                Kolej:{" "}
                <span className="font-bold text-blue-600">
                  {players[gameState.currentTurn]?.nickname}
                </span>
              </div>
              {!gameState.isImpostor && (
                <div className="mt-2 bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block font-bold">
                  Twoje słowo: {gameState.word}
                </div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {gameState.hints.map((hint, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="text-3xl">
                    {
                      [
                        "🦊",
                        "🐻",
                        "🐨",
                        "🐼",
                        "🦁",
                        "🐯",
                        "🐸",
                        "🐹",
                        "🐰",
                        "🦝",
                      ][players.findIndex((p) => p.id === hint.playerId) % 10]
                    }
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">{hint.player}</div>
                    <div className="text-gray-600 italic">"{hint.hint}"</div>
                  </div>
                </div>
              ))}
            </div>

            {isMyTurn ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={hintInput}
                  onChange={(e) => setHintInput(e.target.value)}
                  placeholder="Podaj wskazówkę..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && hintInput.trim()) {
                      submitHint(hintInput);
                      setHintInput("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (hintInput.trim()) {
                      submitHint(hintInput);
                      setHintInput("");
                    }
                  }}
                  disabled={!hintInput.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Wyślij Wskazówkę
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-600 font-semibold py-4">
                Czekaj na swoją kolej...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Round End Screen
  if (gameState.phase === "roundEnd") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-red-600 text-center mb-8">
              Koniec Rundy Wskazówek
            </h2>

            <div className="space-y-3 mb-8">
              {gameState.hints.map((hint, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="text-3xl">
                    {
                      [
                        "🦊",
                        "🐻",
                        "🐨",
                        "🐼",
                        "🦁",
                        "🐯",
                        "🐸",
                        "🐹",
                        "🐰",
                        "🦝",
                      ][players.findIndex((p) => p.id === hint.playerId) % 10]
                    }
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">{hint.player}</div>
                    <div className="text-gray-600 italic">"{hint.hint}"</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={startNextRound}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-6 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {Icons.RotateCcw}
                Kolejna Runda
              </button>
              <button
                onClick={startVoting}
                className="bg-gradient-to-r from-red-500 to-pink-600 text-white py-6 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {Icons.Vote}
                Głosuj na Impostora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Voting Screen
  if (gameState.phase === "voting") {
    const hasVoted = gameState.votes[socketRef.current?.playerId];

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-red-600 text-center mb-8">
              {Icons.Vote} Głosowanie
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Zagłosowano: {Object.keys(gameState.votes).length} /{" "}
              {players.length}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {players.map((player, idx) => (
                <button
                  key={player.id}
                  onClick={() => !hasVoted && submitVote(player.nickname)}
                  disabled={hasVoted}
                  className={`rounded-2xl p-6 text-center transform transition-all ${
                    hasVoted
                      ? gameState.votes[socketRef.current?.playerId] ===
                        player.nickname
                        ? "bg-gradient-to-br from-red-500 to-pink-500 text-white scale-105"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-br from-red-100 to-pink-100 hover:scale-105 hover:shadow-lg cursor-pointer"
                  }`}
                >
                  <div className="text-4xl mb-2">
                    {
                      [
                        "🦊",
                        "🐻",
                        "🐨",
                        "🐼",
                        "🦁",
                        "🐯",
                        "🐸",
                        "🐹",
                        "🐰",
                        "🦝",
                      ][idx % 10]
                    }
                  </div>
                  <div className="font-bold">{player.nickname}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (gameState.phase === "results") {
    const voteCounts = {};
    Object.values(gameState.votes).forEach((vote) => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    const mostVoted = Object.entries(voteCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-orange-600 text-center mb-8">
              🎉 Wyniki Głosowania
            </h2>

            <div className="mb-8 bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl p-6">
              <div className="text-center">
                <div className="text-5xl mb-4">🏆</div>
                <div className="text-2xl font-bold text-gray-800 mb-2">
                  Najwięcej głosów: {mostVoted}
                </div>
                <div className="text-gray-600">
                  ({voteCounts[mostVoted]} głosów)
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {players.map((player, idx) => (
                <div
                  key={player.id}
                  className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {
                        [
                          "🦊",
                          "🐻",
                          "🐨",
                          "🐼",
                          "🦁",
                          "🐯",
                          "🐸",
                          "🐹",
                          "🐰",
                          "🦝",
                        ][idx % 10]
                      }
                    </div>
                    <div className="font-bold text-gray-800">
                      {player.nickname}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {voteCounts[player.nickname] || 0} {Icons.Vote}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mb-6 bg-blue-100 rounded-2xl p-4">
              <div className="font-bold text-blue-800 text-xl mb-2">
                Słowo było:
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {gameState.word}
              </div>
            </div>

            <button
              onClick={() => setScreen("lobby")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all"
            >
              Powrót do Poczekalni
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PolishImpostorGame;
