import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Users, 
  Settings, 
  Monitor, 
  Send, 
  CheckCircle, 
  AlertCircle,
  ChevronLeft,
  Play,
  SkipForward,
  RotateCcw
} from 'lucide-react';
import './App.css';

const socket = io();

function calculateScore(correct, guess) {
  if (!correct || !guess || correct.length < 3 || guess.length < 3) return 0;
  if (JSON.stringify(correct) === JSON.stringify(guess)) return 10; // サンレンタン
  const matched = guess.filter(g => correct.includes(g)).length;
  if (matched === 3) return 5; // サンレンプク
  if (correct[0] === guess[0] && correct[1] === guess[1]) return 3; // 1-2位
  if (matched === 2) return 2; // 2つ的中
  if (correct[0] === guess[0]) return 1; // 1位的中
  return 0;
}

function App() {
  const [state, setState] = useState({
    current_q: 1,
    q_text: "",
    options: [],
    is_open: false,
    show_ans: false,
    last_ans: ["", "", ""]
  });
  const [revealStep, setRevealStep] = useState('OFF'); // 'OFF', 'LIST', '3RD', '2ND', '1ST'
  const [myName, setMyName] = useState(localStorage.getItem('sanrentan_name') || '');
  const [guesses, setGuesses] = useState(['', '', '']);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    socket.on('sync-state', (newState) => {
      setState(newState);
      if (!newState.is_open) {
        setVoteSuccess(false);
      } else {
        const saved = localStorage.getItem(`sanrentan_guess_${newState.current_q}`);
        if (saved) {
          setVoteSuccess(true);
        } else {
          setVoteSuccess(false);
        }
      }
    });

    socket.on('vote-success', () => setVoteSuccess(true));
    socket.on('ranking-data', (data) => setRanking(data));
    socket.on('ranking-reveal-update', (step) => setRevealStep(step));
    socket.on('votes-reset', (qNum) => {
      if (qNum === null) {
        // 全問リセット: sanrentan_guess_* を全削除
        Object.keys(localStorage)
          .filter(k => k.startsWith('sanrentan_guess_'))
          .forEach(k => localStorage.removeItem(k));
      } else {
        localStorage.removeItem(`sanrentan_guess_${qNum}`);
      }
      setVoteSuccess(false);
      setGuesses(['', '', '']);
    });

    // 初回読み込み
    socket.emit('get-ranking');

    return () => {
      socket.off('sync-state');
      socket.off('vote-success');
      socket.off('ranking-data');
      socket.off('ranking-reveal-update');
      socket.off('votes-reset');
    };
  }, []);

  const submitVote = () => {
    if (!myName.trim()) return alert("名前を入力してください");
    if (new Set(guesses).size !== 3 || guesses.includes('')) return alert("重複なく3名選んでください");
    localStorage.setItem('sanrentan_name', myName);
    localStorage.setItem(`sanrentan_guess_${state.current_q}`, JSON.stringify(guesses));
    socket.emit('submit-vote', { name: myName, guesses });
  };

  const loadRanking = () => socket.emit('get-ranking');

  return (
    <BrowserRouter>
      <div className="container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={
            <ParticipantView 
              state={state} 
              myName={myName} 
              setMyName={setMyName} 
              guesses={guesses} 
              setGuesses={setGuesses} 
              submitVote={submitVote} 
              voteSuccess={voteSuccess} 
              ranking={ranking}
              loadRanking={loadRanking}
            />
          } />
          <Route path="/monitor" element={<MonitorView state={state} ranking={ranking} revealStep={revealStep} />} />
          <Route path="/admin" element={<AdminView state={state} socket={socket} ranking={ranking} revealStep={revealStep} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function ParticipantView({ state, myName, setMyName, guesses, setGuesses, submitVote, voteSuccess, ranking, loadRanking }) {
  const [isRankingView, setIsRankingView] = useState(false);

  if (isRankingView) {
    return <RankingView ranking={ranking} goBack={() => setIsRankingView(false)} />;
  }

  // ローカル保存された自身の予想からこの問題の獲得ポイントを計算
  const savedGuessesStr = localStorage.getItem(`sanrentan_guess_${state.current_q}`);
  const savedGuesses = savedGuessesStr ? JSON.parse(savedGuessesStr) : null;
  const pointsEarned = savedGuesses ? calculateScore(state.last_ans, savedGuesses) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
       <div className="flex-between" style={{ marginBottom: '30px' }}>
        <h2 className="brand-title">
          SANRENTAN
        </h2>
      </div>

      <div className="glass-card neon-glow" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '10px' }}>第 {state.current_q} 問</div>
        <h1 style={{ margin: '0 0 30px 0', fontSize: '2.5rem' }}>{state.q_text}</h1>
        
        {state.show_ans ? (
          <div style={{ marginTop: '20px' }}>
              <h2 style={{ color: '#ff4b4b' }}>正解発表</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  <div className="ans-badge gold">🥇 {state.last_ans[0]}</div>
                  <div className="ans-badge silver">🥈 {state.last_ans[1]}</div>
                  <div className="ans-badge bronze">🥉 {state.last_ans[2]}</div>
              </div>

              {/* 自分の予想と獲得ポイントの表示 */}
              <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  {savedGuesses ? (
                      <>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '8px' }}>あなたの予想</div>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.9rem', marginBottom: '15px' }}>
                              <span>1位: <strong>{savedGuesses[0]}</strong></span>
                              <span>2位: <strong>{savedGuesses[1]}</strong></span>
                              <span>3位: <strong>{savedGuesses[2]}</strong></span>
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                              獲得ポイント: <span style={{ color: '#10b981', fontSize: '1.5rem' }}>{pointsEarned}</span> pts
                          </div>
                      </>
                  ) : (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                          この問題は未投票です
                      </div>
                  )}
              </div>
          </div>
        ) : state.is_open ? (
          !voteSuccess ? (
            <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
              <label>お名前</label>
              <input className="input-glass" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="例：田中 太郎" />
              <div style={{ display: 'grid', gap: '15px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i}>
                    <label>{i+1}位予想</label>
                    <select className="select-glass" value={guesses[i]} onChange={(e) => {
                      const newGuesses = [...guesses];
                      newGuesses[i] = e.target.value;
                      setGuesses(newGuesses);
                    }}>
                      <option value="">未選択</option>
                      {state.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={submitVote} className="btn-primary" style={{ width: '100%', marginTop: '30px' }}>送信</button>
            </div>
          ) : (
            <div style={{ padding: '40px' }}>
                <CheckCircle size={64} style={{ color: '#00e676', marginBottom: '20px' }} />
                <h3>受付完了！発表をお待ちください</h3>
            </div>
          )
        ) : (
          <div style={{ padding: '40px' }}>
            <AlertCircle size={48} style={{ color: 'var(--text-dim)', marginBottom: '10px' }} />
            <p>準備中...</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MonitorView({ state, ranking, revealStep }) {
  if (revealStep !== 'OFF') {
    return <MonitorRankingView ranking={ranking} revealStep={revealStep} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: '1.5rem', color: 'var(--text-dim)', marginBottom: '20px' }}>第 {state.current_q} 問</div>
      <h1 style={{ fontSize: '5rem', margin: '0 0 60px 0', fontWeight: 800 }}>{state.q_text}</h1>
      
      {!state.show_ans ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {state.options.map(opt => (
            <motion.div key={opt} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="glass-card" style={{ padding: '30px 50px', fontSize: '2.5rem', fontWeight: 'bold' }}>
              {opt}
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
            <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="ans-badge gold" style={{ fontSize: '4rem', padding: '30px 100px' }}>
                1位：{state.last_ans[0]}
            </motion.div>
            <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="ans-badge silver" style={{ fontSize: '3.5rem', padding: '25px 85px' }}>
                2位：{state.last_ans[1]}
            </motion.div>
            <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="ans-badge bronze" style={{ fontSize: '3rem', padding: '20px 70px' }}>
                3位：{state.last_ans[2]}
            </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function MonitorRankingView({ ranking, revealStep }) {
  const top3 = ranking.slice(0, 3);
  const midRanks = ranking.slice(3, 10); // 4位〜10位
  const lowerRanks = ranking.slice(10); // 11位〜
  const prizeRank = ranking.length >= 25 ? ranking[24] : null; // 25位

  const steps = ['LOWER', 'MID', '3RD', '2ND', '1ST', 'PRIZE'];
  const stepIndex = steps.indexOf(revealStep);
  const showLower = stepIndex >= 0;
  const showMid = stepIndex >= 1;
  const show3rd = stepIndex >= 2;
  const show2nd = stepIndex >= 3;
  const show1st = stepIndex >= 4;
  const showPrize = stepIndex >= 5;

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };
  const fadeUp = {
    hidden: { y: 12, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div style={{ textAlign: 'center', padding: '30px 20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '3.5rem', marginBottom: '30px', fontWeight: 800 }}>
        <Trophy size={40} style={{ color: '#ffd700', verticalAlign: 'middle', marginRight: '12px' }} />
        総合ランキング発表
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 1位 */}
        <AnimatePresence>
          {show1st && top3[0] && (
            <motion.div
              key="1st"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="ranking-champion"
            >
              <div className="ranking-champion-label">🏆 優勝</div>
              <div className="ranking-champion-name">{top3[0].name}</div>
              <div className="ranking-champion-pts">{top3[0].total} pts</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2位 */}
        <AnimatePresence>
          {show2nd && top3[1] && (
            <motion.div
              key="2nd"
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="ranking-podium ranking-silver"
            >
              <span className="ranking-podium-label">🥈 2位</span>
              <span className="ranking-podium-name">{top3[1].name}</span>
              <span className="ranking-podium-pts">{top3[1].total} pts</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3位 */}
        <AnimatePresence>
          {show3rd && top3[2] && (
            <motion.div
              key="3rd"
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="ranking-podium ranking-bronze"
            >
              <span className="ranking-podium-label">🥉 3位</span>
              <span className="ranking-podium-name">{top3[2].name}</span>
              <span className="ranking-podium-pts">{top3[2].total} pts</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4位〜10位 */}
        <AnimatePresence>
          {showMid && midRanks.length > 0 && (
            <motion.div
              key="mid"
              variants={stagger}
              initial="hidden"
              animate="show"
              className="ranking-section"
            >
              <div className="ranking-section-label">4位〜10位</div>
              {midRanks.map((r, i) => (
                <motion.div key={r.name} variants={fadeUp} className="ranking-row">
                  <span className="ranking-row-rank">{i + 4}位</span>
                  <span className="ranking-row-name">{r.name}</span>
                  <span className="ranking-row-pts">{r.total} pts</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 11位〜 */}
        <AnimatePresence>
          {showLower && lowerRanks.length > 0 && (
            <motion.div
              key="lower"
              variants={stagger}
              initial="hidden"
              animate="show"
              className="ranking-section"
            >
              <div className="ranking-section-label">11位〜{ranking.length}位</div>
              <div className="ranking-lower-scroll">
                {lowerRanks.map((r, i) => (
                  <motion.div key={r.name} variants={fadeUp} className="ranking-row compact">
                    <span className="ranking-row-rank">{i + 11}位</span>
                    <span className="ranking-row-name">{r.name}</span>
                    <span className="ranking-row-pts">{r.total} pts</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 25位 特別賞 */}
        <AnimatePresence>
          {showPrize && prizeRank && (
            <motion.div
              key="prize"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="ranking-prize"
            >
              🎁 25位（特別賞）：{prizeRank.name}（{prizeRank.total} pts）
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AdminView({ state, socket, ranking, revealStep }) {
  const [qNum, setQNum] = useState(state.current_q);
  const [qText, setQText] = useState(state.q_text);
  const [opts, setOpts] = useState(state.options.join(','));
  const [correct, setCorrect] = useState(['', '', '']);
  const [pwd, setPwd] = useState('');
  const [isLogged, setIsLogged] = useState(false);

  if (!isLogged) {
    return (
      <div className="glass-card" style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
        <h3>管理者ログイン</h3>
        <input type="password" className="input-glass" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="パスワードを入力" />
        <button className="btn-primary" style={{ width: '100%' }} onClick={() => pwd === 'admin123' ? setIsLogged(true) : alert('誤り')}>ログイン</button>
      </div>
    );
  }

  const setStep = (step) => socket.emit('admin-reveal-step', step);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>🔧 管理ポータル</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Link to="/" className="glass-card" style={{ padding: '8px 12px', color: 'white', textDecoration: 'none', fontSize: '0.8rem' }}>参加者</Link>
                <Link to="/monitor" className="glass-card" style={{ padding: '8px 12px', color: 'white', textDecoration: 'none', fontSize: '0.8rem' }}>モニター</Link>
            </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
                <h3>1. 問題・受付設定</h3>
                <label>問題番号</label>
                <input type="number" className="input-glass" value={qNum} onChange={(e) => setQNum(e.target.value)} />
                <label>問題文</label>
                <input className="input-glass" value={qText} onChange={(e) => setQText(e.target.value)} />
                <label>選択肢 (カンマ区切り)</label>
                <textarea className="input-glass" value={opts} onChange={(e) => setOpts(e.target.value)} rows={3} />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" style={{ flex: 2 }} onClick={() => socket.emit('admin-action', { type: 'UPDATE_QUESTION', payload: { current_q: parseInt(qNum), q_text: qText, options: opts.split(',').map(s => s.trim()) } })}>投票開始</button>
                    <button className="btn-danger" style={{ flex: 1 }} onClick={() => socket.emit('admin-action', { type: 'CLOSE_VOTING' })}>締切</button>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { if(confirm('この問題の全投票をリセットしますか？')) socket.emit('admin-action', { type: 'RESET_VOTES' }); }}>リセット</button>
                </div>
            </div>
            <div>
                <h3>2. 正解入力・採点</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[0,1,2].map(i => (
                        <select key={i} className="select-glass" value={correct[i]} onChange={(e) => { const c = [...correct]; c[i] = e.target.value; setCorrect(c); }}>
                            <option value="">{i+1}位の正解</option>
                            {state.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ))}
                </div>
                <button className="btn-primary" style={{ marginTop: '10px', width: '100%' }} onClick={() => socket.emit('admin-action', { type: 'REVEAL_RESULTS', payload: { correct } })}>正解発表</button>
            </div>
        </div>

        <div style={{ marginTop: '30px', borderTop: '1px solid rgba(255,75,75,0.3)', paddingTop: '20px', background: 'rgba(255,75,75,0.05)', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ color: '#ff4b4b', margin: '0 0 12px 0' }}>⚠️ 全データリセット</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>
                スコア・投票・ユーザーデータをすべて削除し、第1問からやり直します。参加者のブラウザの投票済みフラグも解除されます。
            </p>
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('全データをリセットします。この操作は取り消せません。よろしいですか？')) {
                  socket.emit('admin-action', { type: 'RESET_ALL' });
                }
              }}
            >
              <RotateCcw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              全データリセット（第1問からやり直し）
            </button>
        </div>

        <div style={{ marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
            <h3>3. 最終ランキング演出コントロール</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => setStep('LOWER')}><Play size={16} /> 参加者〜11位</button>
                <button className="btn-primary" onClick={() => setStep('MID')}><SkipForward size={16} /> 10〜4位</button>
                <button className="btn-primary" onClick={() => setStep('3RD')}><SkipForward size={16} /> 3位発表</button>
                <button className="btn-primary" onClick={() => setStep('2ND')}><SkipForward size={16} /> 2位発表</button>
                <button className="btn-primary" onClick={() => setStep('1ST')}><Trophy size={16} /> 優勝者発表</button>
                <button className="btn-primary" onClick={() => setStep('PRIZE')}>🎁 25位(特別賞)</button>
                <button className="btn-secondary" onClick={() => setStep('OFF')}><RotateCcw size={16} /> 演出リセット</button>
            </div>
        </div>
      </div>

      {/* 管理者用全順位表示 */}
      <div className="glass-card" style={{ padding: '20px', fontSize: '0.85rem' }}>
        <h3>📊 リアルタイム全順位</h3>
        <div style={{ maxHeight: '650px', overflowY: 'auto' }}>
            {ranking.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: i === 24 ? 'rgba(255,75,75,0.1)' : 'transparent' }}>
                    <span>{i+1}. {r.name} {i === 24 ? '🎁' : ''}</span>
                    <span style={{ fontWeight: 'bold' }}>{r.total} pts</span>
                </div>
            ))}
        </div>
        <button onClick={() => socket.emit('get-ranking')} className="btn-primary" style={{ width: '100%', marginTop: '15px', background: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>ランキングを再計算</button>
      </div>
    </div>
  );
}

function RankingView({ ranking, goBack }) {
    return (
        <motion.div initial={{ opacity: 0 }} className="glass-card" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={goBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginRight: '15px' }}><ChevronLeft size={24} /></button>
                <h1 style={{ margin: 0 }}><Trophy style={{ color: '#ffd700', marginRight: '10px' }} /> あなたの順位結果</h1>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}><th style={{ textAlign: 'left', padding: '15px' }}>順位</th><th style={{ textAlign: 'left', padding: '15px' }}>名前</th><th style={{ textAlign: 'right', padding: '15px' }}>ポイント</th></tr></thead>
                <tbody>{ranking.map((row, i) => (
                    <tr key={row.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}><td style={{ padding: '15px', fontWeight: 'bold' }}>{i + 1}</td><td style={{ padding: '15px' }}>{row.name}</td><td style={{ padding: '15px', textAlign: 'right', color: '#00e676', fontWeight: 'bold' }}>{row.total} pts</td></tr>
                ))}</tbody>
            </table>
        </motion.div>
    );
}

export default App;
