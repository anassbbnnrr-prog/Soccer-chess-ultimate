// =========================================================================
// SOCCER CHESS ULTIMATE - CORE ENGINE (FIXED PHYSICS, KNIGHT & VISUALS + PAWN MODE)
// =========================================================================

const canvas = document.getElementById("gameBoard");
let ctx = null;

const ROWS = 16;
const COLS = 11;
const GOAL_COLS = [3, 4, 5, 6, 7]; 
let cellSize = 50;

let gameMode = "ONLY_MOVE";
let gameState = "MENU"; 
let turn = "white";
let winningScore = 3;

let score = { white: 0, black: 0 };
let pieces = [];
let selectedPiece = null;
let selectedPieceType = "P";
let validMoves = [];

let ballPos = { r: 8, c: 5 };
let firstPiecePlaced = false;
let graveyard = []; 

let knightMovesCount = 0;
let activeKnight = null;
let pieceWithExtraTurn = null; 
let lastActionSquare = null; 

let offsideEnabled = true;
let showOffsideLines = true;
let showUnsafeSquares = false; // إظهار المربعات الغير الآمنة

// أسلوب اللعب الحالي للكمبيوتر (يُختار عشوائياً عند بداية كل مباراة)
let aiMatchStyle = "PRESS"; // POSSESSION | COUNTER_ATTACK | PRESS
let aiVsAiMode = false;     // وضع AI ضد AI
let aiVsAiTurnCount = 0;   // عداد الأدوار لمنع التكرار اللانهائي
let moveHistory = [];       // سجل الحركات للكشف عن التكرار

// بيانات التعلم من مباريات الإنسان (تُخزَّن في localStorage)
let humanGameLog = JSON.parse(localStorage.getItem('soccerChessHumanLog') || '{"moves":[],"wins":0,"losses":0,"goals":0}');

const defaultTheme = {
    dark: "#161b22",
    light: "#21262d",
    team1: "#ffffff",
    team2: "#3498db"
};

let theme = { ...defaultTheme };

const PIECE_LIMITS = {
    white: { K: 1, Q: 1, R: 2, B: 2, N: 0, P: 8 },
    black: { K: 1, Q: 0, R: 2, B: 2, N: 1, P: 8 }
};

// تمت إضافة البيدق المميز "S"
const PIECE_ICONS = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟", S: "♟️✨" };

const sounds = {
    move: new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_default/move-self.mp3"),
    capture: new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_default/capture.mp3"),
    goal: new Audio("https://www.soundjay.com/human/crowd-cheer-01.mp3"),
    whistle: new Audio("https://www.soundjay.com/soccer/referee-whistle-01.mp3"),
    win: new Audio("https://www.soundjay.com/human/applause-01.mp3"),
    bgMusic: new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'),
    counterMusic: new Audio('https://ia800905.us.archive.org/12/items/al-qawlu-qawlu-sawarim/al-qawlu-qawlu-sawarim.mp3')
};
sounds.bgMusic.loop = true;
sounds.bgMusic.volume = 0.3;
sounds.counterMusic.loop = true;
sounds.counterMusic.volume = 0.4;

let playAgainstAI = false; 
let aiWeights = JSON.parse(localStorage.getItem('soccerChessUltimateAI')) || {
    capturePiece: 50, passForward: 30, shootGoal: 1000, advanceToGoal: 10, defendPenalty: 40
};

window.onload = () => {
    if (canvas) {
        ctx = canvas.getContext("2d");
        resize();
    }
    initEvents();
    loadTheme();
    resetBoard(); 
};

function initEvents() {
    const safeBind = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) el[event] = callback;
    };

    safeBind("onlyMoveBtn", "onclick", () => { 
        gameMode = "ONLY_MOVE"; 
        playAgainstAI = false;
        prepareSetupUI();
    });

    // تغيير الحدث لزر طور البيادق الجديد
    safeBind("pawnModeBtn", "onclick", () => { 
        gameMode = "PAWN_MODE"; 
        playAgainstAI = false;
        prepareSetupUI();
    });

    safeBind("playVsAIBtn", "onclick", () => { 
        gameMode = "ONLY_MOVE"; 
        playAgainstAI = true; 
        prepareSetupUI();
    });

    safeBind("playVsAIPawnBtn", "onclick", () => { 
        gameMode = "PAWN_MODE"; 
        playAgainstAI = true; 
        aiVsAiMode = false;
        prepareSetupUI();
    });

    safeBind("aiVsAiBtn", "onclick", () => { 
        gameMode = "ONLY_MOVE"; 
        playAgainstAI = true;
        aiVsAiMode = true;
        aiMatchStyle = "COUNTER_ATTACK"; // الأسود دائماً هجمة مرتدة في هذا الوضع
        prepareAiVsAiUI();
    });

    safeBind("coinFlipBtn", "onclick", () => {
        document.getElementById("coinFlipBtn").style.display = "none";
        document.getElementById("setup-overlay").style.display = "block";
        startSetupPhase();
    });

    document.querySelectorAll(".piece-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".piece-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedPieceType = btn.dataset.type;
        };
    });

    safeBind("endTurnBtn", "onclick", () => endCurrentTurn());

    safeBind("toggleUnsafeBtn", "onclick", () => {
        showUnsafeSquares = !showUnsafeSquares;
        const btn = document.getElementById("toggleUnsafeBtn");
        if (btn) btn.innerText = showUnsafeSquares ? "🟢 إخفاء المربعات الخطرة" : "🔴 إظهار المربعات الخطرة";
        draw();
    });

    safeBind("backToMenuBtn", "onclick", () => {
        // إيقاف كل شيء والعودة للقائمة
        gameState = "MENU";
        aiVsAiMode = false;
        playAgainstAI = false;
        selectedPiece = null; validMoves = [];
        if (sounds.counterMusic && sounds.counterMusic.pause) sounds.counterMusic.pause();
        // إظهار القائمة الرئيسية وإخفاء باقي العناصر
        document.getElementById("menuCard").style.display = "block";
        document.getElementById("controls").style.display = "none";
        document.getElementById("coinFlipBtn").style.display = "none";
        document.getElementById("setup-overlay").style.display = "none";
        let lbl = document.getElementById("aiStyleLabel");
        if (lbl) lbl.style.display = "none";
        let vsDiv = document.getElementById("aiVsAiStatus");
        if (vsDiv) vsDiv.style.display = "none";
        updateStatus(); draw();
    });
}

function prepareSetupUI() {
    document.getElementById("menuCard").style.display = "none"; 
    document.getElementById("coinFlipBtn").innerText = "بدء التوزيع (الأبيض يبدأ)";
    document.getElementById("coinFlipBtn").style.display = "block"; 
}

function prepareAiVsAiUI() {
    document.getElementById("menuCard").style.display = "none";
    resetBoard(); // يُنظف القطع والكرة

    // الأبيض (استحواذ)
    const whiteFormation = [
        { type:"Q", r:9,  c:5 },
        { type:"R", r:11, c:3 }, { type:"R", r:11, c:7 },
        { type:"B", r:10, c:4 }, { type:"B", r:10, c:6 },
        { type:"P", r:13, c:2 }, { type:"P", r:13, c:4 },
        { type:"P", r:13, c:6 }, { type:"P", r:13, c:8 },
        { type:"B", r:12, c:5 }
    ];
    whiteFormation.forEach(p => pieces.push({ type:p.type, color:"white", r:p.r, c:p.c, moved:false }));

    // الأسود (هجمة مرتدة)
    deployAIFormation();

    ballPos = { r:8, c:5 };
    gameState = "PLAYING";
    turn = "white";
    aiVsAiTurnCount = 0; // إعادة تعيين عداد الأدوار

    document.getElementById("setup-overlay").style.display = "none";
    document.getElementById("controls").style.display = "flex";

    // عداد المباريات
    let gamesPlayed = (humanGameLog.aiVsAiGames || 0);
    let wWins = humanGameLog.aiVsAiWhiteWins || 0;
    let bWins = humanGameLog.aiVsAiBlackWins || 0;

    let lbl = document.getElementById("aiStyleLabel");
    if (lbl) {
        lbl.style.display = "block";
        lbl.innerText = `🤖 AI vs AI | مباراة #${gamesPlayed + 1}`;
    }
    let vsDiv = document.getElementById("aiVsAiStatus");
    if (vsDiv) {
        vsDiv.style.display = "block";
        vsDiv.innerText = `⚪ استحواذ ${wWins}  –  ${bWins} هجمة مرتدة ⚫`;
    }

    sounds.whistle.play();
    updateStatus(); draw();
    setTimeout(() => processAILogic(), 600);
}

function updatePieceButtons(color) {
    document.querySelectorAll(".piece-btn").forEach(btn => {
        const type = btn.dataset.type;
        let visible = false;

        if (gameMode === "PAWN_MODE") {
            // طور البيادق: بيدق عادي + بيدق مميز فقط
            visible = (type === "P" || type === "S");
        } else {
            // ONLY_MOVE: كل القطع ما عدا S، وبما يتوافق مع حدود اللاعب الحالي
            if (type === "S" || type === "K") {
                visible = false;
            } else {
                visible = (PIECE_LIMITS[color][type] > 0);
            }
        }

        btn.style.display = visible ? "inline-block" : "none";
        btn.classList.remove("active");
    });

    // اختيار القطعة الافتراضية حسب الطور
    if (gameMode === "PAWN_MODE") {
        selectedPieceType = "P";
        const pBtn = document.querySelector(".piece-btn[data-type='P']");
        if (pBtn) pBtn.classList.add("active");
    } else {
        // في ONLY_MOVE: الملكة افتراضية (أفضل قطعة للبدء عند F8)
        selectedPieceType = "Q";
        const qBtn = document.querySelector(".piece-btn[data-type='Q']");
        if (qBtn) qBtn.classList.add("active");
    }

    // تحديث تلميح الإعداد
    const hint = document.getElementById("setup-hint");
    if (hint) {
        hint.textContent = gameMode === "PAWN_MODE"
            ? "طور البيادق: ضع بيادق عادية أو مميزة في نصف ملعبك."
            : `دور ${color === "white" ? "الأبيض" : "الأسود"}: أول قطعة على الكرة (F${color === "white" ? "8" : "9"}).`;
    }
}

function startSetupPhase() {
    turn = "white"; 
    gameState = "SETUP";
    resetBoard(); 
    updatePieceButtons("white"); // تحديث الأزرار بناءً على الطور واللاعب
    sounds.whistle.play();
    sounds.bgMusic.play().catch(error => console.warn("الموسيقى بحاجة لتفاعل يدوي."));
    updateStatus();
    draw();
}

function startPlayingPhase() {
    gameState = "PLAYING";
    document.getElementById("setup-overlay").style.display = "none";
    document.getElementById("controls").style.display = "flex";
    if (playAgainstAI) {
        let lbl = document.getElementById("aiStyleLabel");
        if (lbl) { lbl.style.display = "block"; lbl.innerText = "أسلوب الكمبيوتر: جاري الاختيار..."; }
        setTimeout(chooseMatchStyle, 300); // نختار الأسلوب بعد لحظة للتشويق
    }
    updateStatus();
}

function resetBoard() {
    pieces = [
        { type: "K", color: "black", r: 0, c: 5, moved: false },
        { type: "K", color: "white", r: 15, c: 5, moved: false }
    ];
    ballPos = { r: 8, c: 5 };
    selectedPiece = null;
    validMoves = [];
    graveyard = [];
    firstPiecePlaced = false;
    pieceWithExtraTurn = null;
    activeKnight = null;
    knightMovesCount = 0;
    lastActionSquare = null; 
    moveHistory = [];
}

function resize() {
    if (!canvas) return;
    const area = document.getElementById("board-area");
    const availW = area ? area.clientWidth  - 16 : window.innerWidth  * 0.75;
    const availH = area ? area.clientHeight - 16 : window.innerHeight * 0.92;
    cellSize = Math.floor(Math.min(availW / COLS, availH / ROWS));
    if (cellSize < 20) cellSize = 20;
    canvas.width  = COLS * cellSize;
    canvas.height = ROWS * cellSize;
    draw();
}
window.addEventListener("resize", resize);

function insideBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
function getPiece(r, c) { return pieces.find(p => p.r === r && p.c === c); }
function hasBall(piece) { return ballPos.r === piece.r && ballPos.c === piece.c; }
function isOpponentGoal(r, c, color) {
    if (!GOAL_COLS.includes(c)) return false;
    return (color === "white" && r === 0) || (color === "black" && r === 15);
}
function isOwnPenaltyArea(r, c, color) {
    if (!GOAL_COLS.includes(c)) return false;
    if (color === "white" && r >= 13 && r <= 15) return true;
    if (color === "black" && r >= 0 && r <= 2) return true;
    return false;
}

function crossesAnyWall(r1, c1, r2, c2) {
    let minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    if (minC <= 2 && maxC >= 3) {
        let y = r1 + (r2 - r1) * (2.5 - c1) / (c2 - c1);
        if (y < 1 || y > 15) return true; 
    }
    if (minC <= 7 && maxC >= 8) {
        let y = r1 + (r2 - r1) * (7.5 - c1) / (c2 - c1);
        if (y < 1 || y > 15) return true; 
    }
    return false;
}

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_DIRS = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]];

function slideMoves(piece, dirs) {
    let moves = [];
    dirs.forEach(dir => {
        let prev_r = piece.r;
        let prev_c = piece.c;
        for (let i = 1; i < 16; i++) {
            let nr = piece.r + dir[0] * i;
            let nc = piece.c + dir[1] * i;
            if (!insideBoard(nr, nc)) break;
            if (crossesAnyWall(prev_r, prev_c, nr, nc)) break; 
            
            let target = getPiece(nr, nc);
            if (!target) { moves.push({ r: nr, c: nc, type: "move" }); } 
            else {
                if (target.color !== piece.color && hasBall(target)) moves.push({ r: nr, c: nc, type: "capture" });
                break; 
            }
            prev_r = nr;
            prev_c = nc;
        }
    });
    return moves;
}

function stepMoves(piece, maxSteps, dirs) {
    let moves = [];
    dirs.forEach(dir => {
        let prev_r = piece.r;
        let prev_c = piece.c;
        for (let i = 1; i <= maxSteps; i++) {
            let nr = piece.r + dir[0] * i;
            let nc = piece.c + dir[1] * i;
            if (!insideBoard(nr, nc)) break;
            if (crossesAnyWall(prev_r, prev_c, nr, nc)) break; 
            
            let target = getPiece(nr, nc);
            if (!target) { moves.push({ r: nr, c: nc, type: "move" }); } 
            else {
                if (target.color !== piece.color && hasBall(target)) moves.push({ r: nr, c: nc, type: "capture" });
                break;
            }
            prev_r = nr;
            prev_c = nc;
        }
    });
    return moves;
}

function knightMoves(piece) {
    let moves = [];
    KNIGHT_DIRS.forEach(dir => {
        let nr = piece.r + dir[0]; let nc = piece.c + dir[1];
        if (!insideBoard(nr, nc)) return;
        if (crossesAnyWall(piece.r, piece.c, nr, nc)) return; 
        
        let target = getPiece(nr, nc);
        if (!target) moves.push({ r: nr, c: nc, type: "move" });
        else if (target.color !== piece.color && hasBall(target)) moves.push({ r: nr, c: nc, type: "capture" });
    });
    return moves;
}

function getBallMoves(piece) {
    let moves = [];
    if (!hasBall(piece)) return moves;
    let passDirs = [], isKnightPass = false;

    // تم إضافة البيدق المميز للاتجاهات الخاصة بالتمرير
    if (piece.type === "Q" || piece.type === "P" || piece.type === "S" || piece.type === "K") passDirs = QUEEN_DIRS; 
    else if (piece.type === "R") passDirs = ROOK_DIRS; 
    else if (piece.type === "B") passDirs = BISHOP_DIRS; 
    else if (piece.type === "N") { passDirs = KNIGHT_DIRS; isKnightPass = true; }

    let canShoot = (piece.color === "white" && piece.r <= 7) || (piece.color === "black" && piece.r >= 8);

    let isTargetOpponentPenalty = (r, c, color) => {
        if (!GOAL_COLS.includes(c)) return false;
        return (color === "white" && r >= 0 && r <= 2) || (color === "black" && r >= 13 && r <= 15);
    };

    if (isKnightPass) {
        passDirs.forEach(dir => {
            let nr = piece.r + dir[0]; let nc = piece.c + dir[1];
            if (!insideBoard(nr, nc)) return;
            if (crossesAnyWall(piece.r, piece.c, nr, nc)) return; 
            
            if (!canShoot && isTargetOpponentPenalty(nr, nc, piece.color)) return;

            let target = getPiece(nr, nc);
            if (!target) { 
                if (isOpponentGoal(nr, nc, piece.color) && canShoot) moves.push({ r: nr, c: nc, type: "shoot" }); 
            } 
            else if (target.color === piece.color && !isOffside(nr, piece.color)) moves.push({ r: nr, c: nc, type: "pass" });
        });
    } else {
        passDirs.forEach(dir => {
            let prev_r = piece.r;
            let prev_c = piece.c;
            for (let i = 1; i < 16; i++) {
                let nr = piece.r + dir[0] * i; let nc = piece.c + dir[1] * i;
                if (!insideBoard(nr, nc)) break;

                // التسديد للمرمى لا يخضع لفحص الجدار لأن خطوط المرمى هي أطراف الملعب
                let isShootTarget = canShoot && isOpponentGoal(nr, nc, piece.color);
                if (!isShootTarget && crossesAnyWall(prev_r, prev_c, nr, nc)) break;
                
                let target = getPiece(nr, nc);

                if (!canShoot && isTargetOpponentPenalty(nr, nc, piece.color)) {
                    // السماح بالتمرير إذا كانت هناك قطعة صديقة داخل منطقة الجزاء
                    if (target && target.color === piece.color && !isOffside(nr, piece.color)) {
                        moves.push({ r: nr, c: nc, type: "pass" });
                    }
                    break;
                }

                if (!target) { 
                    if (isShootTarget) moves.push({ r: nr, c: nc, type: "shoot" }); 
                } 
                else {
                    if (target.color === piece.color && !isOffside(nr, piece.color)) moves.push({ r: nr, c: nc, type: "pass" });
                    break; 
                }
                prev_r = nr;
                prev_c = nc;
            }
        });
    }
    return moves;
}

function getValidMoves(piece) {
    let moves = [];
    if (pieceWithExtraTurn && pieceWithExtraTurn !== piece) return [];
    
    if (pieceWithExtraTurn && pieceWithExtraTurn === piece) {
        moves = getBallMoves(piece);
        if (piece.type === "N" && knightMovesCount === 1) {
            moves = moves.concat(knightMoves(piece));
        }
    } else if (activeKnight && activeKnight !== piece) {
        return [];
    } else {
        switch (piece.type) {
            case "Q": moves = slideMoves(piece, QUEEN_DIRS); break;
            case "R": moves = slideMoves(piece, ROOK_DIRS); break;
            case "B": moves = slideMoves(piece, BISHOP_DIRS); break;
            case "N": moves = knightMoves(piece); break;
            case "P": moves = stepMoves(piece, 2, QUEEN_DIRS); break; 
            case "S": moves = stepMoves(piece, 3, QUEEN_DIRS); break; // البيدق المميز يتحرك 3 مربعات
            case "K": moves = stepMoves(piece, 1, QUEEN_DIRS); break; 
        }
        if (hasBall(piece)) moves = moves.concat(getBallMoves(piece));
    }

    let uniqueMoves = [];
    moves.forEach(m => {
        if ((m.type === "move" || m.type === "capture") && isOwnPenaltyArea(m.r, m.c, piece.color)) {
            if (!isOwnPenaltyArea(piece.r, piece.c, piece.color)) {
                let piecesInArea = pieces.filter(p => p.color === piece.color && isOwnPenaltyArea(p.r, p.c, piece.color));
                let nonKingCount = piecesInArea.filter(p => p.type !== "K").length;
                if (piece.type !== "K" && nonKingCount >= 2) return; 
            }
        }

        if (isOpponentGoal(m.r, m.c, piece.color)) {
            if (m.type !== "shoot") { 
                if (hasBall(piece)) {
                    let isFromOwnHalf = (piece.color === "white") ? (piece.r >= 8) : (piece.r <= 7);
                    if (isFromOwnHalf) return; 
                } else {
                    let targetHasBall = (ballPos.r === m.r && ballPos.c === m.c);
                    if (!targetHasBall) return; 
                }
            }
        }

        let existing = uniqueMoves.find(u => u.r === m.r && u.c === m.c);
        if (existing) { if (m.type !== "move") existing.type = m.type; } 
        else uniqueMoves.push(m);
    });
    return uniqueMoves;
}

if (canvas) {
    canvas.onclick = (e) => {
        if (gameState === "MENU") return;
        if (aiVsAiMode) return; // في وضع AI vs AI لا يتدخل الإنسان
        
        const rect = canvas.getBoundingClientRect();
        const c = Math.floor((e.clientX - rect.left) / cellSize);
        const r = Math.floor((e.clientY - rect.top) / cellSize);

        if (!insideBoard(r, c)) return;
        if (playAgainstAI && turn === "black") return;

        if (gameState === "SETUP") handleSetup(r, c);
        else if (gameState === "PLAYING") handlePlay(r, c);
    };
}

function handleSetup(r, c) {
    if (getPiece(r, c)) return;

    if (isOwnPenaltyArea(r, c, turn)) {
        let piecesInArea = pieces.filter(p => p.color === turn && isOwnPenaltyArea(p.r, p.c, turn));
        let nonKingCount = piecesInArea.filter(p => p.type !== "K").length;
        if (selectedPieceType !== "K" && nonKingCount >= 2) {
            if (!playAgainstAI || turn === "white") alert("لا يسمح بوضع أكثر من قطعتين (غير الملك) داخل منطقة الحارس الخاص بك!");
            return;
        }
    }

    let isGoalLine = (turn === "white" && r === 15) || (turn === "black" && r === 0);
    if (isGoalLine && GOAL_COLS.includes(c)) {
        if (selectedPieceType !== "P" && selectedPieceType !== "S") {
            if (!playAgainstAI || turn === "white") alert("غير مسموح! في منطقة المرمى يُسمح بوضع بيدق واحد فقط بجانب الملك.");
            return;
        }
        let pawnsInGoal = pieces.filter(p => p.color === turn && (p.type === "P" || p.type === "S") && ((turn === "white" && p.r === 15) || (turn === "black" && p.r === 0)) && GOAL_COLS.includes(p.c)).length;
        if (pawnsInGoal >= 1) {
            if (!playAgainstAI || turn === "white") alert("لقد وضعت بيدقاً بالفعل في منطقة المرمى!");
            return;
        }
    }

    if (!firstPiecePlaced) {
        if (r !== ballPos.r || c !== ballPos.c) return;
        if (!canPlacePiece(turn, selectedPieceType)) { if (!playAgainstAI || turn === "white") alert("لا يمكنك استخدام هذه القطعة في هذا الطور!"); return; }
        pieces.push({ type: selectedPieceType, color: turn, r, c, moved: false });
        firstPiecePlaced = true;
        updateStatus(); draw();
        return;
    }

    if ((turn === "white" && r < 8) || (turn === "black" && r > 7)) return;
    if (selectedPieceType === "K") { if (!playAgainstAI || turn === "white") alert("الملك موجود مسبقاً!"); return; }
    if (!canPlacePiece(turn, selectedPieceType)) { if (!playAgainstAI || turn === "white") alert("لقد وصلت للحد الأقصى أو أن القطعة غير مسموحة في هذا الطور!"); return; }

    pieces.push({ type: selectedPieceType, color: turn, r, c, moved: false });

    // تعديل عدد القطع بناءً على الطور (8 في طور البيادق، 10 في الطور العادي)
    let requiredPieces = (gameMode === "PAWN_MODE") ? 8 : 10;

    if (totalSetupPieces(turn) === requiredPieces) {
        if (turn === "white") {
            if (playAgainstAI) {
                deployAIFormation();
                startPlayingPhase();
                turn = "white"; 
                ballPos = { r: 8, c: 5 };
                alert("الكمبيوتر قام بنشر تشكيلته التكتيكية.. انطلاق المباراة!");
                sounds.whistle.play();
            } else {
                turn = "black";
                firstPiecePlaced = false;
                ballPos = { r: 7, c: 5 };
                updatePieceButtons("black"); // تحديث الأزرار للاعب الأسود
                alert("انتهى الأبيض، حان دور الأسود (أول قطعة يجب أن توضع على الكرة)");
            }
        } else {
            startPlayingPhase();
            turn = "white";
            ballPos = { r: 8, c: 5 };
            alert("اكتمل التوزيع.. انطلاق المباراة!");
            sounds.whistle.play();
        }
    }
    updateStatus(); draw();
}

function deployAIFormation() {
    if (gameMode === "PAWN_MODE") {
        // تشكيلة البيادق: لا بيادق داخل منطقة الحارس (صفوف 0-2)
        // الحد الأقصى قطعتان غير ملك داخل المنطقة — هنا نضعها خارجاً كلياً
        const aiFormationPawn = [
            { type: "P", r: 3, c: 3 }, { type: "P", r: 3, c: 5 }, { type: "P", r: 3, c: 7 },
            { type: "P", r: 4, c: 2 }, { type: "P", r: 4, c: 6 },
            { type: "P", r: 5, c: 4 }, { type: "P", r: 5, c: 8 },
            { type: "S", r: 6, c: 5 }  // البيدق المميز أعمق في الملعب
        ];
        aiFormationPawn.forEach(p => pieces.push({ type: p.type, color: "black", r: p.r, c: p.c, moved: false }));
    } else {
        const aiFormation = [
            { type: "P", r: 2, c: 2 }, { type: "P", r: 2, c: 4 }, { type: "P", r: 2, c: 6 }, { type: "P", r: 2, c: 8 },
            { type: "R", r: 4, c: 3 }, { type: "B", r: 4, c: 5 }, { type: "R", r: 4, c: 7 },
            { type: "B", r: 6, c: 3 }, { type: "N", r: 6, c: 5 }, { type: "B", r: 6, c: 7 }
        ];
        aiFormation.forEach(p => pieces.push({ type: p.type, color: "black", r: p.r, c: p.c, moved: false }));
    }
}

function handlePlay(r, c) {
    let move = validMoves.find(m => m.r === r && m.c === c);
    if (move && selectedPiece) { executeMove(selectedPiece, move); return; }

    let clickedPiece = getPiece(r, c);
    if (!clickedPiece) {
        let deadPieces = graveyard.filter(p => p.r === r && p.c === c && p.color === turn);
        if (deadPieces.length > 0) { handleRespawnSelection(deadPieces, r, c); return; }
    }

    if (clickedPiece && clickedPiece.color === turn) {
        if (pieceWithExtraTurn && clickedPiece !== pieceWithExtraTurn) return; 
        if (activeKnight && clickedPiece !== activeKnight) return; 
        selectedPiece = clickedPiece; validMoves = getValidMoves(clickedPiece); draw();
    } else { selectedPiece = null; validMoves = []; draw(); }
}

function handleRespawnSelection(deadPieces, r, c) {
    if (getPiece(r, c)) { alert("المربع مشغول بقطعة أخرى! لا يمكنك الإحياء هنا حالياً."); return; }
    let optionsText = deadPieces.map((p, idx) => `${idx + 1} - ${PIECE_ICONS[p.type]}`).join("\n");
    let choice = prompt(`اختر رقم القطعة التي تريد إعادتها للحياة في هذا المربع:\n${optionsText}`);
    let selectedIdx = parseInt(choice) - 1;
    if (selectedIdx >= 0 && selectedIdx < deadPieces.length) {
        let revivedPiece = deadPieces[selectedIdx];
        pieces.push({ type: revivedPiece.type, color: revivedPiece.color, r: r, c: c, moved: true });
        graveyard = graveyard.filter(p => p !== revivedPiece);
        sounds.move.play(); alert(`تمت إعادة القطعة ${PIECE_ICONS[revivedPiece.type]} للحياة!`);
        endCurrentTurn();
    }
}

function executeMove(piece, move) {
    let beforeScore = evaluateBoard(turn, null);
    let pieceHadBall = hasBall(piece);
    let isCapture = (move.type === "capture");

    lastActionSquare = { r: piece.r, c: piece.c };
    recordHumanMove(move.type);
    recordMoveHistory(turn, piece.type, piece.r, piece.c, move.r, move.c, move.type);

    if (move.type === "pass") {
        ballPos = { r: move.r, c: move.c }; sounds.move.play(); reviewMove(turn, beforeScore, move); endCurrentTurn(); return;
    }

    if (move.type === "shoot") {
        piece.r = move.r; piece.c = move.c; ballPos = { r: move.r, c: move.c }; checkGoal(); reviewMove(turn, beforeScore, move); return;
    }

    if (isCapture) {
        let victim = getPiece(move.r, move.c);
        if (victim) graveyard.push({ type: victim.type, color: victim.color, r: move.r, c: move.c });
        pieces = pieces.filter(p => !(p.r === move.r && p.c === move.c));
        sounds.capture.play();
    } else sounds.move.play();

    piece.r = move.r; piece.c = move.c; piece.moved = true;
    if (pieceHadBall) ballPos = { r: move.r, c: move.c };

    if (hasBall(piece) && isOpponentGoal(piece.r, piece.c, piece.color)) {
        checkGoal();
        reviewMove(turn, beforeScore, move);
        selectedPiece = null; validMoves = [];
        return; 
    }

    reviewMove(turn, beforeScore, move);
    selectedPiece = null; validMoves = [];

    if (piece.type === "N") {
        knightMovesCount++;
        
        if (isCapture) {
            if (knightMovesCount === 1) {
                activeKnight = piece;
                pieceWithExtraTurn = piece; 
                validMoves = getValidMoves(piece); 
                if (!aiVsAiMode && (!playAgainstAI || turn === "white")) alert("⚽ الحصان قطع الكرة في حركته الأولى! يمكنه التمرير/التسديد الآن، أو التحرك للحركة الثانية.");
                draw();
                if (aiVsAiMode) setTimeout(processAILogic, 400);
                else if (playAgainstAI && turn === "black") setTimeout(processAILogic, 400);
                return; 
            } else { 
                activeKnight = null; knightMovesCount = 0;
                triggerExtraTurnForPassShoot(piece); return;
            }
        } else {
            if (knightMovesCount === 1) {
                activeKnight = piece; 
                if (hasBall(piece)) pieceWithExtraTurn = piece; 
                selectedPiece = piece; 
                validMoves = getValidMoves(piece); 
                draw();
                if (aiVsAiMode) setTimeout(processAILogic, 400);
                else if (playAgainstAI && turn === "black") setTimeout(processAILogic, 400);
                return; 
            } else {
                if (hasBall(piece)) {
                    activeKnight = null; knightMovesCount = 0;
                    triggerExtraTurnForPassShoot(piece); 
                    return;
                }
                endCurrentTurn(); return;
            }
        }
    }

    if (isCapture) { triggerExtraTurnForPassShoot(piece); return; }

    if (gameMode === "ONLY_MOVE" || gameMode === "PAWN_MODE") endCurrentTurn();
    else { draw(); if (aiVsAiMode) setTimeout(processAILogic, 300); else if (playAgainstAI && turn === "black") setTimeout(endCurrentTurn, 300); }
}

function triggerExtraTurnForPassShoot(piece) {
    pieceWithExtraTurn = piece;
    // في AI vs AI لا alerts — في اللاعب الإنساني فقط
    if (!aiVsAiMode && (!playAgainstAI || turn === "white")) {
        alert("⚽ الكرة معك الآن! يسمح لك بتمرير أو تسديد الكرة، أو إنهاء الدور للاحتفاظ بها.");
    }
    selectedPiece = piece; validMoves = getBallMoves(piece);
    if (validMoves.length === 0) { endCurrentTurn(); return; }
    draw();
    // AI يلعب دوره الإضافي
    if (aiVsAiMode) setTimeout(processAILogic, 400);
    else if (playAgainstAI && turn === "black") setTimeout(processAILogic, 500);
}

function endCurrentTurn() {
    turn = (turn === "white") ? "black" : "white";
    pieces.forEach(p => p.moved = false);
    pieceWithExtraTurn = null; activeKnight = null; knightMovesCount = 0;
    selectedPiece = null; validMoves = [];
    updateStatus(); draw();
    if (gameState !== "PLAYING") return;
    if (aiVsAiMode) {
        aiVsAiTurnCount = (aiVsAiTurnCount || 0) + 1;
        // إذا لم يُسجَّل هدف بعد 120 دور، نُعيد الكرة للمركز (مثل ضربة الانطلاق)
        if (aiVsAiTurnCount >= 120) {
            aiVsAiTurnCount = 0;
            ballPos = { r: 8, c: 5 };
            draw();
        }
        setTimeout(processAILogic, 500);
    } else if (playAgainstAI && turn === "black") {
        setTimeout(processAILogic, 600);
    }
}

function checkGoal() {
    if (ballPos.r === 0) {
        score.white++;
        sounds.goal.play();
        if (!aiVsAiMode) alert("⚽ هدف رائع للفريق الأبيض!");
        aiVsAiTurnCount = 0;
        if (score.white === winningScore) endGame("white"); else resetAfterGoal();
    } else if (ballPos.r === 15) {
        score.black++;
        sounds.goal.play();
        if (!aiVsAiMode) alert("⚽ هدف رائع للفريق الأسود!");
        aiVsAiTurnCount = 0;
        if (score.black === winningScore) endGame("black"); else resetAfterGoal();
    }
}

function resetAfterGoal() {
    if (aiVsAiMode) {
        // تسجيل إحصائيات AI vs AI قبل إعادة التشغيل
        humanGameLog.aiVsAiGames = (humanGameLog.aiVsAiGames || 0) + 1;
        localStorage.setItem('soccerChessHumanLog', JSON.stringify(humanGameLog));
        setTimeout(() => prepareAiVsAiUI(), 800); // إعادة تشغيل سريعة
        return;
    }
    resetBoard();
    gameState = "SETUP"; turn = "white"; firstPiecePlaced = false; ballPos = { r: 8, c: 5 };
    document.getElementById("setup-overlay").style.display = "block";
    document.getElementById("controls").style.display = "none";
    let lbl = document.getElementById("aiStyleLabel");
    if (lbl) lbl.style.display = "none";
    if (sounds.counterMusic && sounds.counterMusic.pause) { sounds.counterMusic.pause(); sounds.counterMusic.currentTime = 0; }
    updatePieceButtons("white");
    updateStatus(); draw();
}

function endGame(winnerName) {
    if (aiVsAiMode) {
        // تسجيل الفائز وإعادة التشغيل بدون reload
        humanGameLog.aiVsAiGames = (humanGameLog.aiVsAiGames || 0) + 1;
        if (winnerName === "white") humanGameLog.aiVsAiWhiteWins = (humanGameLog.aiVsAiWhiteWins || 0) + 1;
        else humanGameLog.aiVsAiBlackWins = (humanGameLog.aiVsAiBlackWins || 0) + 1;
        localStorage.setItem('soccerChessHumanLog', JSON.stringify(humanGameLog));
        score = { white: 0, black: 0 };
        setTimeout(() => prepareAiVsAiUI(), 1000);
        return;
    }
    sounds.win.play();
    if (playAgainstAI) learnFromMatch(winnerName); 
    let wText = winnerName === "white" ? "الأبيض" : "الأسود";
    alert(`🏆 مبروك! حسم الفريق ${wText} المباراة لصالحها!`);
    location.reload();
}

function draw() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let isLight = (r + c) % 2 === 0;
            ctx.fillStyle = isLight ? theme.light : theme.dark;
            if ((r === 0 || r === 15) && GOAL_COLS.includes(c)) ctx.fillStyle = r === 0 ? "rgba(255, 255, 255, 0.05)" : "rgba(52, 152, 219, 0.05)";
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

            ctx.fillStyle = "rgba(255, 255, 255, 0.25)"; ctx.font = `${Math.floor(cellSize * 0.22)}px Arial`;
            ctx.textAlign = "left"; ctx.textBaseline = "bottom";
            ctx.fillText(String.fromCharCode(65 + c) + (16 - r), c * cellSize + 2, (r + 1) * cellSize - 2);

            let deadPieces = graveyard.filter(p => p.r === r && p.c === c && p.color === turn);
            if (deadPieces.length > 0 && !getPiece(r, c)) {
                ctx.fillStyle = "rgba(230, 126, 34, 0.2)"; ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                ctx.fillStyle = "rgba(230, 126, 34, 0.8)"; ctx.font = `${Math.floor(cellSize * 0.3)}px Cairo`;
                ctx.fillText("✨ إحياء", (c + 0.5) * cellSize, (r + 0.85) * cellSize);
            }
        }
    }

    if (lastActionSquare && gameState === "PLAYING") {
        ctx.fillStyle = "rgba(255, 215, 0, 0.2)"; 
        ctx.fillRect(lastActionSquare.c * cellSize, lastActionSquare.r * cellSize, cellSize, cellSize);
        
        ctx.strokeStyle = "rgba(255, 215, 0, 0.8)"; 
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(255, 215, 0, 1)";
        ctx.shadowBlur = 10;
        ctx.strokeRect(lastActionSquare.c * cellSize, lastActionSquare.r * cellSize, cellSize, cellSize);
        ctx.shadowBlur = 0; 
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(0, (ROWS / 2) * cellSize); ctx.lineTo(COLS * cellSize, (ROWS / 2) * cellSize); ctx.stroke();
    ctx.beginPath(); ctx.arc((COLS / 2) * cellSize, (ROWS / 2) * cellSize, cellSize * 1.5, 0, Math.PI * 2); ctx.stroke();

    let goalStartX = GOAL_COLS[0] * cellSize; let goalWidth = GOAL_COLS.length * cellSize;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; ctx.lineWidth = 2;
    ctx.strokeRect(goalStartX, 0, goalWidth, 3 * cellSize); 
    ctx.strokeRect(goalStartX, (ROWS - 3) * cellSize, goalWidth, 3 * cellSize); 

    ctx.strokeStyle = "#e74c3c"; 
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(goalStartX, 0); ctx.lineTo(goalStartX, cellSize);
    ctx.moveTo(goalStartX + goalWidth, 0); ctx.lineTo(goalStartX + goalWidth, cellSize);
    ctx.moveTo(goalStartX, (ROWS - 1) * cellSize); ctx.lineTo(goalStartX, ROWS * cellSize);
    ctx.moveTo(goalStartX + goalWidth, (ROWS - 1) * cellSize); ctx.lineTo(goalStartX + goalWidth, ROWS * cellSize);
    ctx.stroke();

    if (showOffsideLines && gameState === "PLAYING") drawOffsideLines();
    if (showUnsafeSquares && gameState === "PLAYING") drawUnsafeSquares();
    drawValidMoves();

    pieces.forEach(p => {
        ctx.fillStyle = p.color === "white" ? theme.team1 : theme.team2;
        if (selectedPiece && selectedPiece.r === p.r && selectedPiece.c === p.c) ctx.fillStyle = "#e74c3c";
        ctx.font = `${Math.floor(cellSize * 0.7)}px Cairo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(PIECE_ICONS[p.type] || "", (p.c + 0.5) * cellSize, (p.r + 0.5) * cellSize);
        if (hasBall(p)) {
            ctx.font = `${cellSize * 0.4}px Arial`; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
            ctx.fillText("⚽", (p.c + 0.95) * cellSize, (p.r + 0.95) * cellSize);
        }
    });

    let isBallLoose = !pieces.some(p => p.r === ballPos.r && p.c === ballPos.c);
    if (isBallLoose) {
        ctx.font = `${cellSize * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("⚽", (ballPos.c + 0.5) * cellSize, (ballPos.r + 0.5) * cellSize);
    }
}

function drawUnsafeSquares() {
    let blackThreats = buildThreatMap("black");  // مربعات يهددها الأسود
    let whiteThreats = buildThreatMap("white");  // مربعات يهددها الأبيض

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let key = r * 100 + c;
            let threatenedByBlack = blackThreats.has(key);   // خطر على الأبيض
            let threatenedByWhite = whiteThreats.has(key);   // خطر على الأسود

            if (threatenedByBlack && threatenedByWhite) {
                // متنازع عليه من الطرفين
                ctx.fillStyle = "rgba(231,76,60,0.22)";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                ctx.fillStyle = "rgba(231,76,60,0.7)";
                ctx.font = `${Math.floor(cellSize * 0.25)}px Arial`;
                ctx.textAlign = "center"; ctx.textBaseline = "top";
                ctx.fillText("⚡", (c + 0.5) * cellSize, r * cellSize + 2);
            } else if (threatenedByBlack) {
                // الأسود يسيطر — خطر على الأبيض
                ctx.fillStyle = "rgba(52,152,219,0.18)";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            } else if (threatenedByWhite) {
                // الأبيض يسيطر — خطر على الأسود
                ctx.fillStyle = "rgba(255,255,255,0.13)";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }
}

function drawValidMoves() {
    validMoves.forEach(m => {
        if (m.type === "capture") ctx.fillStyle = "rgba(231, 76, 60, 0.6)"; 
        else if (m.type === "pass") ctx.fillStyle = "rgba(241, 196, 15, 0.7)"; 
        else if (m.type === "shoot") ctx.fillStyle = "rgba(155, 89, 182, 0.85)"; 
        else ctx.fillStyle = "rgba(46, 204, 113, 0.6)"; 
        ctx.fillRect(m.c * cellSize, m.r * cellSize, cellSize, cellSize);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(m.c * cellSize, m.r * cellSize, cellSize, cellSize);
    });
}

function totalSetupPieces(color) { return pieces.filter(p => p.color === color && p.type !== "K").length; }

// تحديث نظام الحدود لمنع القطع الأخرى في طور البيادق
function canPlacePiece(color, type) {
    if (type === "K") return false;
    let count = pieces.filter(p => p.color === color && p.type === type).length;
    
    if (gameMode === "PAWN_MODE") {
        if (type === "P") return count < 7;
        if (type === "S") return count < 1;
        return false; // يمنع وضع الرخ أو الفارس إلخ
    } else {
        if (type === "S") return false; // البيدق المميز متاح فقط في طور البيادق
        return count < PIECE_LIMITS[color][type];
    }
}

function loadTheme() {
    const saved = localStorage.getItem("soccerChessTheme");
    if (saved) theme = JSON.parse(saved);
}

function updateStatus() {
    const statusObj = document.getElementById("statusMsg");
    if (!statusObj) return;
    let turnName = turn === "white" ? "الأبيض" : "الأسود";
    let stateName = gameState === "MENU" ? "القائمة الرئيسية" : (gameState === "SETUP" ? "مرحلة التوزيع" : "المباراة جارية");
    statusObj.innerText = `الطور: ${gameMode} | الدور: ${turnName} | الحالة: ${stateName} | النتيجة: ${score.white} - ${score.black}`;
}

function getOffsideRow(defenseColor) {
    let defenders = pieces.filter(p => p.color === defenseColor && p.type !== "K");
    if (defenders.length === 0) return defenseColor === "black" ? 0 : 15;
    return defenseColor === "black" ? Math.min(...defenders.map(p => p.r)) : Math.max(...defenders.map(p => p.r));
}

function isOffside(targetR, attackerColor) {
    if (!offsideEnabled) return false;
    let defColor = attackerColor === "white" ? "black" : "white";
    let line = getOffsideRow(defColor);
    return attackerColor === "white" ? (targetR < line) : (targetR > line);
}

function drawOffsideLines() {
    ctx.setLineDash([8, 8]); ctx.lineWidth = 3;
    let bLine = getOffsideRow("black"); ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
    ctx.beginPath(); ctx.moveTo(0, bLine * cellSize); ctx.lineTo(COLS * cellSize, bLine * cellSize); ctx.stroke();
    let wLine = getOffsideRow("white"); ctx.strokeStyle = "rgba(52, 152, 219, 0.8)";
    ctx.beginPath(); ctx.moveTo(0, (wLine + 1) * cellSize); ctx.lineTo(COLS * cellSize, (wLine + 1) * cellSize); ctx.stroke();
    ctx.setLineDash([]);
}

function reviewMove(moveColor, beforeScore, moveAction) {
    if (playAgainstAI && moveColor === "black") return;
    let opponentColor = moveColor === "white" ? "black" : "white";

    // أسوأ حركة: المنافس يستطيع التسجيل فوراً
    if (canTeamShootNow(opponentColor)) {
        showModernBadge("Blunder 🔴", "#df1616"); return;
    }

    // هدف مباشر
    let wasGoal = moveAction.type === "shoot" && (ballPos.r === 0 || ballPos.r === 15);
    if (wasGoal) { showModernBadge("Goal! ⚽", "#ffd700"); return; }

    // الكرة الآن في خطر حقيقي (قطعة خصم تستطيع أخذها مباشرة)
    let ballInDanger = !isBallSafeNow(moveColor);
    if (ballInDanger) {
        showModernBadge("Mistake ⚠️", "#ff9800");
        return;
    }

    // تقييم الحالة بعد الحركة
    let afterScore = evaluateBoard(moveColor, null);
    let diff = afterScore - beforeScore;

    let forcedGoalNow = hasForcedGoalPath(moveColor);
    let doubleNow = hasDoubleShotThreat(moveColor);
    let strategicallySafe = isBallSafeStrategically(moveColor);

    // تمريرة مباشرة لمن يستطيع التسديد فوراً = حركة واضحة، ليست Brilliant
    let wasObviousPass = (moveAction.type === "pass") && canTeamShootNow(moveColor);

    let grade, color;
    if ((forcedGoalNow || doubleNow) && !wasObviousPass) {
        // طريق مضمون للهدف أو تهديد مزدوج عبر حركة غير واضحة = Brilliant
        grade = doubleNow ? "Brilliant 🔮" : "Great Find 🔮";
        color = "#00e5ff";
    } else if (wasObviousPass || doubleNow) {
        grade = "Great Move 🌟"; color = "#1565c0";
    } else if (strategicallySafe && diff >= 1500) {
        grade = "Best Move ✨"; color = "#00c853";
    } else if (diff >= 500) {
        grade = "Good 👍"; color = "#4caf50";
    } else if (diff >= -500) {
        grade = "Neutral ➡️"; color = "#8b949e";
    } else {
        grade = "Mistake ⚠️"; color = "#ff9800";
    }
    showModernBadge(grade, color);
}


function showModernBadge(text, bg) {
    let old = document.getElementById("moveBadgeNode");
    if (old) old.remove();
    let badge = document.createElement("div"); badge.id = "moveBadgeNode"; badge.innerText = text;
    badge.style.position = "fixed"; badge.style.top = "15%"; badge.style.left = "50%"; badge.style.transform = "translate(-50%, -50%)";
    badge.style.background = bg; badge.style.color = "#ffffff"; badge.style.padding = "12px 24px";
    badge.style.borderRadius = "30px"; badge.style.fontSize = "16px"; badge.style.fontWeight = "bold";
    badge.style.fontFamily = "Cairo, sans-serif"; badge.style.boxShadow = "0 8px 20px rgba(0,0,0,0.5)";
    badge.style.zIndex = "999999"; badge.style.textAlign = "center"; badge.style.pointerEvents = "none";
    badge.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    document.body.appendChild(badge);
    setTimeout(() => { badge.style.opacity = "0"; badge.style.transform = "translate(-50%, -100%)"; setTimeout(() => badge.remove(), 400); }, 1800);
}

// =========================================================================
// FOOTBALL-CHESS AI ENGINE v2 — ball-centric evaluation with real look-ahead
// =========================================================================
//
// فلسفة هذا المحرك:
// 1) لا "شطرنج عادي". كل تقييم يبدأ بسؤال: من يملك الكرة؟ وهل هي آمنة؟
// 2) لا نكتب آلاف if/else يدوية. كل فكرة (Forced Goal, Double Threat, Safe
//    Square, Pressing...) تتحول لنقاط (Score) داخل evaluateBoard().
// 3) قبل اختيار حركة، نحاكيها فعلياً على نسخة من الحالة (simulateMove) ثم
//    نقيّم الوضع الناتج — بدل تقييم الحركة "كنية" بمعزل عن نتيجتها.
// 4) "مربع آمن" له طبقتان: آمن الآن (safeNow) وآمن بعد رد فعل واحد للخصم
//    (safeAfterReply) — نحاكي أسوأ رد فعل ممكن للخصم وننظر هل ما زال آمناً.

// ---------- أدوات أساسية ----------

function getTeamBallHolder(color) {
    return pieces.find(p => hasBall(p) && p.color === color) || null;
}

// هل تستطيع القطعة الوصول لمربع (r,c) في حركة قانونية واحدة؟
// "المربع غير الآمن" = أي مربع يمكن لقطعة خصم الوقوف فيه بحركة واحدة.
// نتجاهل هنا اشتراطات الكرة والأوفسايد — فقط الهندسة الحركية.
function canPieceReachSquare(piece, r, c) {
    if (piece.type === "N") {
        return KNIGHT_DIRS.some(d => {
            let nr = piece.r + d[0], nc = piece.c + d[1];
            return nr === r && nc === c && insideBoard(nr, nc) && !crossesAnyWall(piece.r, piece.c, nr, nc);
        });
    }

    let dirs;
    let maxSteps = 15;

    if      (piece.type === "R") dirs = ROOK_DIRS;
    else if (piece.type === "B") dirs = BISHOP_DIRS;
    else if (piece.type === "Q") dirs = QUEEN_DIRS;
    else if (piece.type === "K") { dirs = QUEEN_DIRS; maxSteps = 1; }
    else if (piece.type === "P") { dirs = QUEEN_DIRS; maxSteps = 2; }
    else if (piece.type === "S") { dirs = QUEEN_DIRS; maxSteps = 3; }
    else return false;

    for (let dir of dirs) {
        let prev_r = piece.r, prev_c = piece.c;
        for (let i = 1; i <= maxSteps; i++) {
            let nr = piece.r + dir[0] * i;
            let nc = piece.c + dir[1] * i;
            if (!insideBoard(nr, nc)) break;
            if (crossesAnyWall(prev_r, prev_c, nr, nc)) break;
            let blocker = getPiece(nr, nc);
            // قطعة من نفس لون القطعة المُحاسَبة تحجب المسار
            if (blocker && blocker.color === piece.color) break;
            // وصلنا للمربع المستهدف
            if (nr === r && nc === c) return true;
            // قطعة خصم في المسار تحجب ما وراءها
            if (blocker) break;
            prev_r = nr; prev_c = nc;
        }
    }
    return false;
}

// خريطة التهديد: جميع المربعات التي يمكن لأي قطعة خصم الوصول إليها في حركة واحدة
function buildThreatMap(opponentColor) {
    let threatened = new Set();
    pieces.filter(p => p.color === opponentColor).forEach(piece => {
        if (piece.type === "N") {
            KNIGHT_DIRS.forEach(d => {
                let nr = piece.r + d[0], nc = piece.c + d[1];
                if (insideBoard(nr, nc) && !crossesAnyWall(piece.r, piece.c, nr, nc))
                    threatened.add(nr * 100 + nc);
            });
            return;
        }
        let dirs, maxSteps = 15;
        if      (piece.type === "R") dirs = ROOK_DIRS;
        else if (piece.type === "B") dirs = BISHOP_DIRS;
        else if (piece.type === "Q") dirs = QUEEN_DIRS;
        else if (piece.type === "K") { dirs = QUEEN_DIRS; maxSteps = 1; }
        else if (piece.type === "P") { dirs = QUEEN_DIRS; maxSteps = 2; }
        else if (piece.type === "S") { dirs = QUEEN_DIRS; maxSteps = 3; }
        else return;

        dirs.forEach(dir => {
            let prev_r = piece.r, prev_c = piece.c;
            for (let i = 1; i <= maxSteps; i++) {
                let nr = piece.r + dir[0] * i, nc = piece.c + dir[1] * i;
                if (!insideBoard(nr, nc)) break;
                if (crossesAnyWall(prev_r, prev_c, nr, nc)) break;
                let blocker = getPiece(nr, nc);
                if (blocker && blocker.color === piece.color) break;
                threatened.add(nr * 100 + nc);
                if (blocker) break; // قطعة خصم تحجب ما وراءها
                prev_r = nr; prev_c = nc;
            }
        });
    });
    return threatened;
}

function isSquareSafeNow(r, c, forColor) {
    let opponentColor = forColor === "white" ? "black" : "white";
    return !pieces.some(p => p.color === opponentColor && canPieceReachSquare(p, r, c));
}

// آمن استراتيجياً: آمن الآن + يبقى آمناً حتى بعد أفضل رد فعل واحد للخصم
// (نحاكي تحريك كل قطعة خصم خطوة واحدة وننظر هل أصبح أي منها يهدد المربع)
function isSquareSafeAfterReply(r, c, forColor) {
    if (!isSquareSafeNow(r, c, forColor)) return false;
    let opponentColor = forColor === "white" ? "black" : "white";
    let opponentPieces = pieces.filter(p => p.color === opponentColor);

    for (let p of opponentPieces) {
        let theirMoves = getValidMoves(p).filter(m => m.type === "move" || m.type === "capture");
        for (let m of theirMoves) {
            let virtualPiece = { type: p.type, color: p.color, r: m.r, c: m.c };
            if (canPieceReachSquare(virtualPiece, r, c)) return false;
        }
    }
    return true;
}

function canTeamShootNow(color) {
    let holder = getTeamBallHolder(color);
    if (!holder) return false;
    return getBallMoves(holder).some(m => m.type === "shoot");
}

// تهديد منطقة الحارس: كم مدخلاً مختلفاً (تسديدة محتملة) يملكها الفريق الآن؟
function countShotThreats(color) {
    let holder = getTeamBallHolder(color);
    if (!holder) return 0;
    let count = 0;
    let ballMoves = getBallMoves(holder);
    count += ballMoves.filter(m => m.type === "shoot").length > 0 ? 1 : 0;

    let originalBallPos = { ...ballPos };
    for (let m of ballMoves) {
        if (m.type !== "pass") continue;
        let receiver = getPiece(m.r, m.c);
        if (!receiver) continue;
        ballPos = { r: m.r, c: m.c };
        if (getBallMoves(receiver).some(rm => rm.type === "shoot")) count++;
        ballPos = originalBallPos;
    }
    return count;
}

function hasForcedGoalPath(color) { return countShotThreats(color) >= 1; }
function hasDoubleShotThreat(color) { return countShotThreats(color) >= 2; }

function isBallSafeNow(color) {
    let holder = getTeamBallHolder(color);
    if (!holder) return false;
    return isSquareSafeNow(holder.r, holder.c, color);
}

function isBallSafeStrategically(color) {
    let holder = getTeamBallHolder(color);
    if (!holder) return false;
    return isSquareSafeAfterReply(holder.r, holder.c, color);
}

// عدد خطوط التمرير المتاحة لحامل الكرة نحو قطع في مربعات آمنة
function countSafePassOptions(color) {
    let holder = getTeamBallHolder(color);
    if (!holder) return 0;
    return getBallMoves(holder).filter(m => {
        if (m.type !== "pass") return false;
        return isSquareSafeNow(m.r, m.c, color);
    }).length;
}

// ---------- تقييم اللوحة الكامل (Evaluation Function) ----------
// كل فكرة استراتيجية = نقاط. لا شروط متفرعة، فقط جمع نقاط.

function evaluateBoard(color, style) {
    let opponentColor = color === "white" ? "black" : "white";
    let sc = 0;

    let weHaveBall  = !!getTeamBallHolder(color);
    let theyHaveBall = !!getTeamBallHolder(opponentColor);
    let myThreats   = countShotThreats(color);
    let theirThreats = countShotThreats(opponentColor);

    // --- امتلاك الكرة ---
    if (weHaveBall)  sc += 800;
    if (theyHaveBall) sc -= 800;

    // --- تسديد / تهديد مباشر ---
    if (canTeamShootNow(color))       sc += 6000;
    if (canTeamShootNow(opponentColor)) sc -= 9000;

    // --- مسارات الهدف ---
    if (myThreats >= 2)   sc += 12000;
    else if (myThreats >= 1) sc += 4000;

    if (theirThreats >= 2) sc -= 14000;
    else if (theirThreats >= 1) sc -= 5000;

    // --- أمان الكرة ---
    if (weHaveBall) {
        let holder = getTeamBallHolder(color);
        if (isBallSafeStrategically(color)) sc += 600;
        else if (isBallSafeNow(color)) sc += 150;
        else if (style !== "COUNTER") sc -= 800; // الهجمة المرتدة تقبل الخطر في سبيل التقدم
        sc += countSafePassOptions(color) * (style === "COUNTER" ? 30 : 100);
        let adv = color === "black" ? holder.r : (15 - holder.r);
        sc += adv * (style === "COUNTER" ? 120 : 60);
    }
    if (theyHaveBall && !isBallSafeNow(opponentColor)) sc += 1200;

    // --- عدد القطع والانتشار ---
    let myCount    = pieces.filter(p => p.color === color).length;
    let theirCount = pieces.filter(p => p.color === opponentColor).length;
    sc += (myCount - theirCount) * 70;
    let myPieces = pieces.filter(p => p.color === color);
    sc += new Set(myPieces.map(p => p.c)).size * 15;

    // --- مكافآت مرتبطة بالأسلوب ---
    if (style === "POSSESSION") {
        // الاستحواذ: يُكافئ كثرة خيارات التمرير الآمنة والسيطرة على المنتصف
        sc += countSafePassOptions(color) * 80;
        let midControl = myPieces.filter(p => p.r >= 6 && p.r <= 10).length;
        sc += midControl * 50;
        // يُعاقب على إعطاء الخصم تهديداً
        if (theirThreats >= 1) sc -= 3000;
    }
    else if (style === "COUNTER") {
        // هجوم مرتد: التقدم بالكرة بقوة حتى لو المربع غير آمن
        if (weHaveBall) {
            let holder = getTeamBallHolder(color);
            let adv = color === "black" ? holder.r : (15 - holder.r);
            sc += adv * 200; // تكثيف قوي للتقدم
            // لا عقوبة على عدم الأمان في أسلوب الهجمة المرتدة — الخطر مقبول
            // بل نُكافئ التقدم حتى في مربعات مهددة
        }
        // إذا عند الخصم الكرة — ننتظر في مكاننا الدفاعي (لا نضغط)
        if (theyHaveBall) {
            sc += 200; // بقاء في الوضع الدفاعي ينتظر الكرة
        }
    }
    else if (style === "DEFEND") {
        // دفاع منظم: يُكافئ الحفاظ على قطع دفاعية قرب المرمى
        let defenseRow = color === "black" ? (p => p.r <= 5) : (p => p.r >= 10);
        let defenders = myPieces.filter(defenseRow).length;
        sc += defenders * 120;
        // يُكافئ تهديد قطع الخصم المتقدمة
        if (theyHaveBall) {
            let holder = getTeamBallHolder(opponentColor);
            if (holder) {
                let pressure = pieces.filter(p =>
                    p.color === color && canPieceReachSquare(p, holder.r, holder.c)
                ).length;
                sc += pressure * 300;
            }
        }
        // يُعاقب بشدة على التقدم بدون كرة (ابقَ دفاعياً)
        if (!weHaveBall) {
            let advancedPieces = myPieces.filter(p =>
                color === "black" ? p.r > 8 : p.r < 7
            ).length;
            sc -= advancedPieces * 100;
        }
    }
    else if (style === "PRESS") {
        // ضغط عالٍ: يُكافئ تضييق الخناق على حامل الكرة
        if (theyHaveBall) {
            let holder = getTeamBallHolder(opponentColor);
            if (holder) {
                let pressers = pieces.filter(p =>
                    p.color === color && canPieceReachSquare(p, holder.r, holder.c)
                ).length;
                sc += pressers * 400;
            }
        }
    }

    return sc;
}

function simulateMoveAndEvaluate(piece, move, evalColor, style) {
    let savedPieces = pieces;
    let savedBall   = ballPos;

    let simPieces = savedPieces.map(p => ({ ...p }));
    let simBall   = { ...savedBall };

    let simPiece = simPieces.find(p =>
        p.r === piece.r && p.c === piece.c &&
        p.color === piece.color && p.type === piece.type
    );
    if (!simPiece) { return evaluateBoard(evalColor, style); }

    let pieceHadBall = (simBall.r === simPiece.r && simBall.c === simPiece.c);

    if (move.type === "pass" || move.type === "shoot") {
        simBall = { r: move.r, c: move.c };
        if (move.type === "shoot") { simPiece.r = move.r; simPiece.c = move.c; }
    } else {
        if (move.type === "capture") {
            simPieces = simPieces.filter(p => !(p.r === move.r && p.c === move.c));
        }
        simPiece.r = move.r; simPiece.c = move.c;
        if (pieceHadBall) simBall = { r: move.r, c: move.c };
    }

    pieces  = simPieces;
    ballPos = simBall;
    let result = evaluateBoard(evalColor, style);
    pieces  = savedPieces;
    ballPos = savedBall;
    return result;
}

// ---------- اختيار الحركات المرشحة (لتقليل العبء الحسابي) ----------

function getCandidateMoves(piece) {
    let allMoves = getValidMoves(piece);
    if (allMoves.length === 0) return [];

    let shootMoves = allMoves.filter(m => m.type === "shoot");
    if (shootMoves.length > 0) return shootMoves; // التسديد له الأولوية المطلقة

    let captureMoves = allMoves.filter(m => m.type === "capture");
    let passMoves = allMoves.filter(m => m.type === "pass");
    let moveMoves = allMoves.filter(m => m.type === "move");

    if (hasBall(piece)) {
        // حامل الكرة: كل التمريرات + كل القطع المحتملة + الحركات للأمام
        let forwardMoves = moveMoves.filter(m =>
            piece.color === "black" ? m.r > piece.r : m.r < piece.r
        ).slice(0, 6);
        return [...passMoves, ...captureMoves, ...forwardMoves];
    }

    // قطعة بدون كرة: نعطي أولوية لقطع الكرة، ثم التموضع الآمن القريب من الكرة
    let nearBallMoves = moveMoves
        .map(m => ({ m, dist: Math.abs(m.r - ballPos.r) + Math.abs(m.c - ballPos.c) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 6)
        .map(x => x.m);

    let forwardMoves = moveMoves.filter(m =>
        piece.color === "black" ? m.r > piece.r : m.r < piece.r
    ).slice(0, 4);

    let candidates = [...captureMoves, ...nearBallMoves, ...forwardMoves];
    if (candidates.length === 0) candidates = allMoves.slice(0, 8);
    return candidates;
}

// ---------- اختيار أسلوب اللعب ----------
// الأسلوب يُختار عشوائياً عند بداية كل مباراة ويبقى ثابتاً.
// لكن داخل كل دور، يُحدَّد "الوضع التكتيكي الفوري" بناءً على حالة الكرة.

function chooseMatchStyle() {
    // نُرجّح الأساليب بناءً على سجل التعلم من مباريات الإنسان
    let weights = humanGameLog.styleWins || { POSSESSION: 1, COUNTER_ATTACK: 1, PRESS: 1 };
    let total = weights.POSSESSION + weights.COUNTER_ATTACK + weights.PRESS;
    let rand = Math.random() * total;
    if (rand < weights.POSSESSION) aiMatchStyle = "POSSESSION";
    else if (rand < weights.POSSESSION + weights.COUNTER_ATTACK) aiMatchStyle = "COUNTER_ATTACK";
    else aiMatchStyle = "PRESS";

    // موسيقى الهجمات المرتدة
    if (aiMatchStyle === "COUNTER_ATTACK") {
        sounds.bgMusic.pause();
        sounds.counterMusic.play().catch(() => {});
    } else {
        if (sounds.counterMusic.pause) sounds.counterMusic.pause();
    }
    showAIStyleBadge(aiMatchStyle);
}

function pickAITactical(color, matchStyleOverride) {
    let style = matchStyleOverride || aiMatchStyle;
    let weHaveBall = !!getTeamBallHolder(color);
    let myThreats = countShotThreats(color);

    if (style === "POSSESSION") {
        if (weHaveBall) return myThreats >= 1 ? "COUNTER" : "POSSESSION";
        return "PRESS";
    }
    if (style === "COUNTER_ATTACK") {
        if (weHaveBall) return "COUNTER";
        return "DEFEND"; // دفاع منظم لا ضغط عالي
    }
    if (style === "PRESS") {
        if (weHaveBall) return myThreats >= 1 ? "COUNTER" : "POSSESSION";
        return "PRESS";
    }
    return "POSSESSION";
}

function pickAIStyle(color, matchStyleOverride) {
    return pickAITactical(color, matchStyleOverride);
}

const STYLE_BONUS = {
    POSSESSION:  { safePassWeight: 1.6, advanceWeight: 1.0, pressWeight: 0.8 },
    COUNTER:     { safePassWeight: 0.6, advanceWeight: 3.0, pressWeight: 0.5 },
    PRESS:       { safePassWeight: 0.8, advanceWeight: 1.0, pressWeight: 2.5 },
    DEFEND:      { safePassWeight: 1.0, advanceWeight: 0.2, pressWeight: 0.2 }
};

// ---------- المنطق الأساسي لتقييم حركة واحدة (شجرة القرار → نقاط) ----------
// هذا تطبيق مباشر لشجرة القرار: تسديد > Double Threat Forced Goal > Forced
// Goal > أمان القطعة > الضغط/الدعم، لكن مُعبَّر عنه كنقاط إضافية فوق
// evaluateBoard بدل شروط متشعبة منفصلة لكل احتمال.

function scoreMoveForAI(piece, move, color, style) {
    let opponentColor = color === "white" ? "black" : "white";
    let weights = STYLE_BONUS[style];

    // 1) تسديد مباشر = الأولوية القصوى دائماً
    if (move.type === "shoot") return 1000000;

    // باقي الحركات: نحاكي وننظر فعلياً للوحة الناتجة بدل تقييم النية فقط
    let resultScore = simulateMoveAndEvaluate(piece, move, color, style);

    // مكافأة صريحة لرفع الكرة السائبة (الكرة موجودة في مربع الوجهة ولا أحد يمسكها)
    if (move.type === "move") {
        let ballIsLoose = !pieces.some(p => p.r === ballPos.r && p.c === ballPos.c);
        if (ballIsLoose && move.r === ballPos.r && move.c === ballPos.c) {
            resultScore += 2000; // رفع الكرة دائماً أفضل من البقاء بدونها
        }
    }

    if (move.type === "pass") {
        let receiver = getPiece(move.r, move.c);
        if (receiver) {
            let originalBall = { ...ballPos };
            ballPos = { r: move.r, c: move.c };
            let receiverThreats = countShotThreats(color);
            ballPos = originalBall;
            if (receiverThreats >= 2) resultScore += 9000;       // تمريرة تصنع تهديداً مزدوجاً = Brilliant
            else if (receiverThreats >= 1) resultScore += 4000;  // تمريرة تصنع Forced Goal
        }
        resultScore *= weights.safePassWeight;
    }

    if (move.type === "capture") {
        // الخبث الكروي: هل هذا الاستحواذ حقيقي أم سيُعطي الكرة للخصم مباشرة؟
        resultScore += evaluateCapture(piece, move, color);
    }

    if (move.type === "move") {
        if (hasBall(piece)) {
            resultScore *= weights.advanceWeight;
            // مكافأة صريحة قوية للتقدم نحو منطقة التسديد (مستقلة عن أمان المربع)
            if (style === "COUNTER") {
                // الأسود يتقدم نحو صف 15 (هدف الأبيض)
                // الأبيض يتقدم نحو صف 0 (هدف الأسود)
                let advancement = color === "black"
                    ? (move.r - piece.r)
                    : (piece.r - move.r);
                if (advancement > 0) {
                    resultScore += advancement * 1200;
                    let inShootingZone = color === "black" ? move.r >= 8 : move.r <= 7;
                    if (inShootingZone) resultScore += 5000;
                    // تفضيل الأعمدة الجانبية للتسديد (تجنب العمود المركزي المسدود بالملك)
                    if (GOAL_COLS.includes(move.c) && move.c !== 5) resultScore += 2500;
                }
                // إذا كنا في منطقة التسديد وعمود جانبي نضيف مكافأة إضافية
                let alreadyInZone = color === "black" ? piece.r >= 8 : piece.r <= 7;
                if (alreadyInZone && GOAL_COLS.includes(move.c) && move.c !== 5) resultScore += 2000;
            }
            // الاستحواذ: مكافأة للتحرك نحو المرمى أيضاً لكن أخف
            if (style === "POSSESSION") {
                let advancement = color === "black"
                    ? (move.r - piece.r)
                    : (piece.r - move.r);
                if (advancement > 0) resultScore += advancement * 400;
            }
        } else {
            // قطعة بدون كرة: مكافأة الضغط على حامل كرة الخصم أو سد خط تمرير
            let opponentHolder = getTeamBallHolder(opponentColor);
            if (opponentHolder) {
                let virtualPiece = { type: piece.type, color: piece.color, r: move.r, c: move.c };
                if (canPieceReachSquare(virtualPiece, opponentHolder.r, opponentHolder.c)) {
                    resultScore += 3000 * weights.pressWeight;
                }
            }
            // مكافأة الدعم القريب من حامل كرتنا (لتوفير خيار تمرير)
            let myHolder = getTeamBallHolder(color);
            if (myHolder) {
                let distBefore = Math.abs(piece.r - myHolder.r) + Math.abs(piece.c - myHolder.c);
                let distAfter = Math.abs(move.r - myHolder.r) + Math.abs(move.c - myHolder.c);
                if (distAfter < distBefore && isSquareSafeNow(move.r, move.c, color)) resultScore += 400;
            }
        }
    }

    return resultScore;
}

// ---------- الخبث الكروي: هل الاستحواذ حقيقي أم مجرد تبادل مؤقت؟ ----------
// نُحاكي: إذا أخذنا الكرة الآن → هل الخصم يستعيدها فوراً؟
// إذا نعم → الاستحواذ وهمي (bad capture)
// إذا لا، أو إذا كنا نستطيع التسديد/التمرير قبل أن يستعيدها → استحواذ حقيقي
function evaluateCapture(piece, move, color) {
    let opponentColor = color === "white" ? "black" : "white";

    // نحاكي أخذ الكرة
    let savedPieces = pieces;
    let savedBall = ballPos;
    let simPieces = pieces.map(p => ({ ...p }));
    let simBall = { r: move.r, c: move.c };

    // نُطبّق الحركة على النسخة المحاكاة
    simPieces = simPieces.filter(p => !(p.r === move.r && p.c === move.c && p.color === opponentColor));
    let simPiece = simPieces.find(p => p.r === piece.r && p.c === piece.c && p.color === color);
    if (simPiece) { simPiece.r = move.r; simPiece.c = move.c; }

    pieces = simPieces;
    ballPos = simBall;

    // السؤال 1: هل نستطيع التسديد مباشرة بعد الاستحواذ؟
    let canShootAfter = canTeamShootNow(color);

    // السؤال 2: هل نستطيع تمرير آمن؟
    let safePassAfter = countSafePassOptions(color) > 0;

    // السؤال 3: هل الكرة آمنة (الخصم لا يستطيع استعادتها فوراً)؟
    let ballSafeAfter = isBallSafeNow(color);

    // السؤال 4: هل الخصم يستطيع استعادتها مباشرة ويُسدد؟
    let opponentCanRecaptureAndShoot = false;
    if (!ballSafeAfter) {
        let opponentMoves = [];
        simPieces.filter(p => p.color === opponentColor).forEach(p => {
            let caps = getValidMoves(p).filter(m => m.type === "capture");
            opponentMoves.push(...caps);
        });
        for (let om of opponentMoves) {
            let simPieces2 = simPieces.map(p => ({ ...p }));
            let simBall2 = { r: om.r, c: om.c };
            let op = simPieces2.find(p => p.r === om.r && p.c === om.c && p.color === color);
            simPieces2 = simPieces2.filter(p => !(p.r === om.r && p.c === om.c && p.color === color));
            let capturer = simPieces2.find(p => p.color === opponentColor && canPieceReachSquare(p, om.r, om.c));
            if (capturer) {
                pieces = simPieces2; ballPos = simBall2;
                if (canTeamShootNow(opponentColor)) { opponentCanRecaptureAndShoot = true; }
                break;
            }
        }
    }

    pieces = savedPieces;
    ballPos = savedBall;

    // تقييم جودة الاستحواذ
    if (canShootAfter)                          return 15000;  // ممتاز: تسديد مباشر
    if (safePassAfter && ballSafeAfter)         return 8000;   // جيد: تمرير آمن
    if (ballSafeAfter)                          return 3000;   // مقبول: محتفظ بالكرة بأمان
    if (!ballSafeAfter && safePassAfter)        return 1000;   // متعادل: خطر لكن تمرير ممكن
    if (opponentCanRecaptureAndShoot)           return -5000;  // خبث الخصم: استحواذ سيئ جداً
    return -1000;                                              // استحواذ مؤقت: سيستعيدها الخصم
}

function processAILogic() {
    if (!playAgainstAI || gameState !== "PLAYING") return;
    if (aiVsAiMode) {
        playAITurnForColor(turn);
    } else if (turn === "black") {
        playAITurn();
    }
}

// --- فلترة القطع المرشحة بذكاء ---
function getRelevantPieces(color) {
    let all = pieces.filter(p => p.color === color);
    if (pieceWithExtraTurn) return [pieceWithExtraTurn];
    if (activeKnight && activeKnight.color === color) return [activeKnight];

    let holder = getTeamBallHolder(color);
    let opponentHolder = getTeamBallHolder(color === "black" ? "white" : "black");
    let ballR = ballPos.r, ballC = ballPos.c;
    const PROXIMITY = 7;

    let relevant = all.filter(p => {
        // الملك يبقى في منطقته الدفاعية — لا يُحرَّك إلا في الضرورة القصوى
        if (p.type === "K") {
            let inOwnArea = isOwnPenaltyArea(p.r, p.c, color);
            // نُشرك الملك فقط إذا خرج من منطقته أو إذا كانت الكرة في منطقة الخطر
            if (!inOwnArea) return true; // إذا خرج الملك نعيده
            let ballNearGoal = color === "white" ? ballPos.r >= 12 : ballPos.r <= 3;
            return ballNearGoal; // يُحرَّك الملك فقط إذا الكرة قريبة من مرماه
        }
        if (holder && p === holder) return true;
        let dist = Math.abs(p.r - ballR) + Math.abs(p.c - ballC);
        if (dist <= PROXIMITY) return true;
        if (opponentHolder) {
            let distToEnemy = Math.abs(p.r - opponentHolder.r) + Math.abs(p.c - opponentHolder.c);
            if (distToEnemy <= PROXIMITY) return true;
        }
        // تضمين قطعة واحدة بعيدة لتقديمها للأمام (تموضع هجومي)
        return false;
    });

    if (relevant.length === 0) {
        let sorted = all.filter(p => p.type !== "K").sort((a,b) =>
            (Math.abs(a.r-ballR)+Math.abs(a.c-ballC)) - (Math.abs(b.r-ballR)+Math.abs(b.c-ballC))
        );
        relevant = sorted.slice(0, 3);
    }
    return relevant;
}

// --- قرار إعادة الإحياء للـ AI ---
// يُقيِّم هل من الأفضل إعادة إحياء قطعة مقاتلة بدل تحريك قطعة أخرى
function getBestRespawnMove(color) {
    let myGraveyard = graveyard.filter(p => p.color === color);
    if (myGraveyard.length === 0) return null;

    let myPieces = pieces.filter(p => p.color === color);
    // نُعيد الإحياء إذا كان عدد قطعنا أقل من الخصم
    let opponentColor = color === "white" ? "black" : "white";
    let theirCount = pieces.filter(p => p.color === opponentColor).length;
    if (myPieces.length >= theirCount) return null; // لا حاجة للإحياء

    // أفضل قطعة للإحياء (الأقوى)
    const pieceValue = { Q: 9, R: 5, B: 3, N: 3, S: 2, P: 1 };
    let bestDead = myGraveyard.sort((a,b) =>
        (pieceValue[b.type] || 1) - (pieceValue[a.type] || 1)
    )[0];

    // أفضل مربع للإحياء (قريب من الكرة وآمن)
    let candidates = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // الإحياء في نصف الفريق فقط
            let inOwnHalf = color === "white" ? r >= 8 : r <= 7;
            if (!inOwnHalf) continue;
            if (getPiece(r, c)) continue;
            if (isOwnPenaltyArea(r, c, color)) continue;
            let dist = Math.abs(r - ballPos.r) + Math.abs(c - ballPos.c);
            if (dist > 6) continue;
            if (isSquareSafeNow(r, c, color)) {
                candidates.push({ r, c, dist });
            }
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a,b) => a.dist - b.dist);
    return { piece: bestDead, square: candidates[0] };
}

// --- عرض الأسلوب الحالي في الواجهة ---
function showAIStyleBadge(style, forColor) {
    const labels = {
        POSSESSION:    "⚙️ استحواذ",
        COUNTER_ATTACK:"⚡ هجمة مرتدة",
        PRESS:         "🔥 ضغط عالي",
        COUNTER:       "⚡ هجوم سريع",
        DEFEND:        "🛡️ دفاع منظم"
    };
    if (aiVsAiMode) {
        // في وضع AI vs AI نُعدِّل السبورة الكبيرة فقط
        let el = document.getElementById("aiVsAiStatus");
        if (el) {
            let wStyle = labels[pickAITactical("white", "POSSESSION")] || "";
            let bStyle = labels[pickAITactical("black", "COUNTER_ATTACK")] || "";
            el.innerText = `⚪ أبيض: ${wStyle}   |   ⚫ أسود: ${bStyle}`;
        }
        return;
    }
    let el = document.getElementById("aiStyleLabel");
    if (el) el.innerText = "أسلوب الكمبيوتر: " + (labels[style] || style);
}

function playAITurn() {
    playAITurnForColor("black");
}

// دالة مشتركة تُشغّل دور AI لأي لون (تُستخدم في وضع AI vs AI أيضاً)
function playAITurnForColor(color) {
    let matchStyle = color === "black" ? aiMatchStyle : "POSSESSION";
    let style = pickAIStyle(color, matchStyle);
    if (color === "black" && !aiVsAiMode) showAIStyleBadge(style, color);

    // --- 1. تحقق من إعادة الإحياء أولاً ---
    if (!pieceWithExtraTurn && !activeKnight) {
        let respawnMove = getBestRespawnMove(color);
        if (respawnMove) {
            let { piece: dead, square } = respawnMove;
            pieces.push({
                type: dead.type, color: dead.color,
                r: square.r, c: square.c, moved: true
            });
            graveyard = graveyard.filter(p => p !== dead);
            sounds.move.play();
            endCurrentTurn();
            return;
        }
    }

    // --- 2. احسب الحركة المثلى ---
    let bestMove = null, bestPiece = null, maxScore = -Infinity;
    let aiPieces = getRelevantPieces(color);
    let inRepetition = isRepetition();

    aiPieces.forEach(p => {
        let candidates = getCandidateMoves(p);
        candidates.forEach(m => {
            let randFactor = aiVsAiMode ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 5);
            let moveScore = scoreMoveForAI(p, m, color, style) + randFactor;

            // --- عقوبة التكرار: إذا اكتُشف loop نُعاقب الحركات المتكررة ---
            if (inRepetition) {
                let histEntry = `${color}:${p.type}:${p.r},${p.c}->${m.r},${m.c}:${m.type}`;
                if (moveHistory.slice(-6).includes(histEntry)) {
                    moveScore -= 50000; // عقوبة كبيرة جداً لمنع التكرار
                }
            }

            // --- مكافأة التموضع المستقبلي (قطع بدون كرة تتقدم لمناطق تهديد) ---
            if (m.type === "move" && !hasBall(p)) {
                let opponentGoalRow = color === "black" ? 15 : 0;
                // مكافأة للقطع التي تتقدم نحو نصف الخصم في مربعات آمنة
                let inOpponentHalf = color === "black" ? m.r >= 8 : m.r <= 7;
                if (inOpponentHalf && isSquareSafeNow(m.r, m.c, color)) {
                    // هل من هذا المربع يمكن التهديد مستقبلاً؟
                    let virtualPiece = { type: p.type, color, r: m.r, c: m.c };
                    let threatensGoalArea = GOAL_COLS.some(gc =>
                        [opponentGoalRow, opponentGoalRow === 0 ? 1 : 14].some(gr =>
                            canPieceReachSquare(virtualPiece, gr, gc)
                        )
                    );
                    if (threatensGoalArea) moveScore += 1200;
                    else moveScore += 400;
                }
            }

            if (moveScore > maxScore) { maxScore = moveScore; bestMove = m; bestPiece = p; }
        });
    });

    if (bestMove && bestPiece) {
        selectedPiece = bestPiece;
        executeMove(bestPiece, bestMove);
    } else {
        endCurrentTurn();
    }
}


function recordHumanMove(moveType) {
    if (aiVsAiMode) return;
    if (playAgainstAI && turn === "white") {
        humanGameLog.moves.push(moveType);
        if (humanGameLog.moves.length > 200) humanGameLog.moves.shift();
    }
}

function recordMoveHistory(color, pieceType, fromR, fromC, toR, toC, moveType) {
    let entry = `${color}:${pieceType}:${fromR},${fromC}->${toR},${toC}:${moveType}`;
    moveHistory.push(entry);
    if (moveHistory.length > 24) moveHistory.shift();
}

// هل تكررت نفس الحركات ثلاث مرات؟
function isRepetition() {
    if (moveHistory.length < 6) return false;
    let last = moveHistory.slice(-2);  // آخر حركتين (دور الطرفين)
    let prev = moveHistory.slice(-4, -2);
    let pprev = moveHistory.slice(-6, -4);
    return last[0] === pprev[0] && last[1] === pprev[1] &&
           prev[0] === pprev[0] && prev[1] === pprev[1];
}

function learnFromMatch(winnerColor) {
    if (!playAgainstAI) return;

    // تحليل أسلوب اللاعب الإنساني من حركاته المسجَّلة
    let moves = humanGameLog.moves;
    let passCount = moves.filter(m => m === "pass").length;
    let shootCount = moves.filter(m => m === "shoot").length;
    let captureCount = moves.filter(m => m === "capture").length;
    let total = moves.length || 1;

    // هل يلعب الإنسان بكثير تمريرات (استحواذ) أم يسرع للتسديد (هجوم مرتد) أم يضغط؟
    let humanStyle = passCount/total > 0.4 ? "POSSESSION"
                   : shootCount/total > 0.2 ? "COUNTER_ATTACK"
                   : "PRESS";

    // تحديث أوزان الأساليب: الأسلوب الذي يفوز على هذا الإنسان يأخذ وزناً أعلى
    if (!humanGameLog.styleWins) humanGameLog.styleWins = { POSSESSION: 1, COUNTER_ATTACK: 1, PRESS: 1 };

    if (winnerColor === "black") {
        // الكمبيوتر فاز — نُعزز الأسلوب الذي استخدمه
        humanGameLog.styleWins[aiMatchStyle] = (humanGameLog.styleWins[aiMatchStyle] || 1) + 2;
        humanGameLog.wins = (humanGameLog.wins || 0) + 1;
    } else {
        // الإنسان فاز — نُضعف الأسلوب الذي خسر به ونُقوي الأسلوب المضاد لأسلوبه
        humanGameLog.styleWins[aiMatchStyle] = Math.max(1, (humanGameLog.styleWins[aiMatchStyle] || 1) - 1);
        // الأسلوب المضاد لأسلوب الإنسان يأخذ دفعة
        let counter = humanStyle === "POSSESSION" ? "PRESS"
                    : humanStyle === "PRESS" ? "COUNTER_ATTACK"
                    : "POSSESSION";
        humanGameLog.styleWins[counter] = (humanGameLog.styleWins[counter] || 1) + 1;
        humanGameLog.losses = (humanGameLog.losses || 0) + 1;
    }

    humanGameLog.moves = []; // إعادة تعيين سجل الحركات للمباراة القادمة
    localStorage.setItem('soccerChessHumanLog', JSON.stringify(humanGameLog));

    // aiWeights التقليدي
    if (winnerColor === 'black') { aiWeights.advanceToGoal += 1; aiWeights.passForward += 2; } 
    else {
        aiWeights.capturePiece += (Math.random() > 0.5 ? 5 : -5);
        aiWeights.defendPenalty += (Math.random() > 0.5 ? 10 : 0);
        aiWeights.advanceToGoal += (Math.random() > 0.5 ? 2 : -2);
        for (let key in aiWeights) { if (aiWeights[key] < 1) aiWeights[key] = 1; }
    }
    localStorage.setItem('soccerChessUltimateAI', JSON.stringify(aiWeights));
}
