import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// 静的ファイルの配信設定 (Reactビルド済みファイル)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

const DB_PATH = './db.json';

// --- 初期データ構造 ---
const defaultState = {
  settings: {
    current_q: 1,
    q_text: "第1レースの勝者は？",
    options: ["ランナーA", "ランナーB", "ランナーC", "ランナーD", "ランナーE"],
    is_open: false,
    show_ans: false,
    last_ans: ["", "", ""]
  },
  scores: [], // { q_id, name, g1, g2, g3, score }
  users: []   // { name }
};

// --- DB操作ユーティリティ ---
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2));
    return defaultState;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(state) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

let db = loadDB();

// --- 採点ロジック ---
function calculateScore(correct, guess) {
  if (JSON.stringify(correct) === JSON.stringify(guess)) return 6; // サンレンタン
  const matched = guess.filter(g => correct.includes(g)).length;
  if (matched === 3) return 4; // サンレンプク
  if (correct[0] === guess[0] && correct[1] === guess[1]) return 3; // 1-2位
  if (matched === 2) return 2; // 2つ的中
  if (correct[0] === guess[0]) return 1; // 1位的中
  return 0;
}

// --- Socket通信 ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // 接続時に現在の状態を送信
  socket.emit('sync-state', db.settings);

  // 投票
  socket.on('submit-vote', ({ name, guesses }) => {
    const q_id = db.settings.current_q;
    // 既存の投票を確認
    const existingIndex = db.scores.findIndex(s => s.q_id === q_id && s.name === name);
    const voteData = { q_id, name, g1: guesses[0], g2: guesses[1], g3: guesses[2], score: 0 };
    
    if (existingIndex > -1) {
      db.scores[existingIndex] = voteData;
    } else {
      db.scores.push(voteData);
    }
    
    if (!db.users.find(u => u.name === name)) {
      db.users.push({ name });
    }
    
    saveDB(db);
    io.emit('vote-count-update', db.scores.filter(s => s.q_id === q_id).length);
    socket.emit('vote-success', voteData);
  });

  // 管理者操作
  socket.on('admin-action', (action) => {
    const { type, payload } = action;
    
    switch (type) {
      case 'UPDATE_QUESTION':
        db.settings = { ...db.settings, ...payload, is_open: true, show_ans: false };
        break;
      case 'CLOSE_VOTING':
        db.settings.is_open = false;
        break;
      case 'REVEAL_RESULTS':
        const correct = payload.correct; // [ans1, ans2, ans3]
        db.settings.last_ans = correct;
        db.settings.show_ans = true;
        db.settings.is_open = false;
        
        // 全参加者の採点
        db.scores = db.scores.map(s => {
          if (s.q_id === db.settings.current_q) {
            return { ...s, score: calculateScore(correct, [s.g1, s.g2, s.g3]) };
          }
          return s;
        });
        break;
      case 'RESET_ALL':
        db = { ...defaultState };
        break;
    }
    
    saveDB(db);
    io.emit('sync-state', db.settings);
    if (type === 'REVEAL_RESULTS') {
        const currentScores = db.scores.filter(s => s.q_id === db.settings.current_q);
        io.emit('results-broadcast', { correct: db.settings.last_ans, scores: currentScores });
    }
  });

  // ランキング要求
  socket.on('get-ranking', () => {
    const ranking = db.users.map(user => {
      const total = db.scores
        .filter(s => s.name === user.name)
        .reduce((sum, s) => sum + s.score, 0);
      return { name: user.name, total };
    }).sort((a, b) => b.total - a.total);
    
    socket.emit('ranking-data', ranking);
  });

  // ランキング演出コントロール
  socket.on('admin-reveal-step', (step) => {
    // step: 'OFF' | 'LIST' | '3RD' | '2ND' | '1ST'
    io.emit('ranking-reveal-update', step);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

  // その他のリクエストはすべてReactのindex.htmlに飛ばす (SPA対応)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
