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
      if (!newState.is_open) setVoteSuccess(false);
    });

    socket.on('vote-success', () => setVoteSuccess(true));
    socket.on('ranking-data', (data) => setRanking(data));
    socket.on('ranking-reveal-update', (step) => setRevealStep(step));

    // 初回読み込み
    socket.emit('get-ranking');

    return () => {
      socket.off('sync-state');
      socket.off('vote-success');
      socket.off('ranking-data');
      socket.off('ranking-reveal-update');
    };
  }, []);

  const submitVote = () => {
    if (!myName.trim()) return alert("名前を入力してください");
    if (new Set(guesses).size !== 3 || guesses.includes('')) return alert("重複なく3名選んでください");
    localStorage.setItem('sanrentan_name', myName);
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, fontWeight: 800, letterSpacing: '2px', background: 'var(--accent-gold)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
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
              <button onClick={() => { loadRanking(); setIsRankingView(true); }} className="btn-primary" style={{ marginTop: '40px', background: 'rgba(255,255,255,0.1)' }}>
                  自分の順位を確認
              </button>
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
  // 10-4位 + 25位の抽出
  const midRanks = ranking.slice(3, 10);
  const prizeRank = ranking[24]; // 25位
  const top3 = ranking.slice(0, 3);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '40px' }}><Trophy style={{ color: '#ffd700' }} /> 総合ランキング発表</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* 左側：10位〜4位 + 25位 */}
        <div style={{ minHeight: '600px' }}>
          <AnimatePresence>
            {['LIST', '3RD', '2ND', '1ST'].includes(revealStep) && (
              <motion.div variants={container} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {midRanks.map((r, i) => (
                  <motion.div key={r.name} variants={item} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', fontSize: '1.5rem' }}>
                      <span>{i + 4}位：{r.name}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{r.total} pts</span>
                  </motion.div>
                ))}
                {prizeRank && (
                  <motion.div variants={item} className="glass-card" style={{ marginTop: '20px', border: '2px solid #ff4b4b', padding: '15px 30px', fontSize: '1.8rem', background: 'rgba(255, 75, 75, 0.1)' }}>
                      <span>🎁 25位（特別賞）：{prizeRank.name}</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右側：トップ3個別に表示 */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '20px', justifyContent: 'center', minHeight: '600px' }}>
           <AnimatePresence>
              {revealStep === '1ST' ? (
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }} className="ans-badge gold" style={{ fontSize: '5rem', padding: '40px' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🏆 優勝</div>
                    {top3[0]?.name}
                    <div style={{ fontSize: '2rem', marginTop: '10px' }}>{top3[0]?.total} pts</div>
                </motion.div>
              ) : null}
              {['2ND', '1ST'].includes(revealStep) ? (
                <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="ans-badge silver" style={{ fontSize: '4rem', padding: '20px' }}>
                    🥈 2位：{top3[1]?.name} ({top3[1]?.total} pts)
                </motion.div>
              ) : null}
              {['3RD', '2ND', '1ST'].includes(revealStep) ? (
                <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="ans-badge bronze" style={{ fontSize: '3rem', padding: '15px' }}>
                    🥉 3位：{top3[2]?.name} ({top3[2]?.total} pts)
                </motion.div>
              ) : null}
           </AnimatePresence>
        </div>
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
                    <button className="btn-primary" style={{ flex: 1, background: '#ff4b4b' }} onClick={() => socket.emit('admin-action', { type: 'CLOSE_VOTING' })}>締切</button>
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

        <div style={{ marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
            <h3>3. 最終ランキング演出コントロール</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => setStep('LIST')}><Play size={16} /> 10〜4位/25位表示</button>
                <button className="btn-primary" onClick={() => setStep('3RD')}><SkipForward size={16} /> 3位発表</button>
                <button className="btn-primary" onClick={() => setStep('2ND')}><SkipForward size={16} /> 2位発表</button>
                <button className="btn-primary" onClick={() => setStep('1ST')}><Trophy size={16} /> 優勝者発表</button>
                <button className="btn-primary" style={{ background: '#444' }} onClick={() => setStep('OFF')}><RotateCcw size={16} /> 演出リセット</button>
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
