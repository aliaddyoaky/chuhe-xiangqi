import { RED, BLACK, other, sideOf, typeOf, initialBoard, legalMoves, applyMove, inCheck, gameOutcome, chooseAIMove, GLYPHS } from './engine.mjs';

const $ = id => document.getElementById(id);
const els = {
  board:$('board'), pieces:$('pieceLayer'), hints:$('hintLayer'), last:$('lastMove'),
  status:$('statusText'), list:$('moveList'), count:$('moveCount'), undo:$('undoButton'),
  topName:$('topName'), topSub:$('topSub'), bottomName:$('bottomName'), bottomSub:$('bottomSub'),
  topBadge:$('topBadge'), bottomBadge:$('bottomBadge'), modeLabel:$('modeLabel'),
  modeSummary:$('modeSummary'), resultLink:$('showResultButton')
};
const INITIAL = () => ({ board:initialBoard(), turn:RED, move:null, notation:null });
let mode = 'ai';
let difficulty = 'normal';
let history = [INITIAL()];
let selected = null;
let aiTimer = null;
let generation = 0;
let started = false;
let wasStarted = false;
let pendingStartMode = null;
let pendingStartDifficulty = difficulty;
let remote = {peer:null,conn:null,role:null,code:null,connected:false,awaiting:false,token:0};
const startDialog=$('startDialog');
const roomDialog=$('roomDialog');
const settingsDialog=$('settingsDialog');
const resultDialog=$('resultDialog');
const resignDialog=$('resignDialog');
let resigningSide = RED;

try {
  const saved=JSON.parse(localStorage.getItem('chuhe-save'));
  if (saved && ['ai','local'].includes(saved.mode) && Array.isArray(saved.history) && saved.history.length && saved.history.every(h => Array.isArray(h.board) && h.board.length===90 && [RED,BLACK].includes(h.turn))) {
    mode=saved.mode; history=saved.history;
    difficulty=['easy','normal','hard'].includes(saved.difficulty)?saved.difficulty:'normal';
    wasStarted=saved.matchStarted!==false;
  }
} catch { /* Start a fresh game when browser storage is unavailable. */ }

const current = () => history.at(-1);
function save() {
  if (mode==='remote') return;
  wasStarted=started;
  try { localStorage.setItem('chuhe-save',JSON.stringify({mode,difficulty,history,matchStarted:started})); } catch {}
}
function clearAI() { if (aiTimer) clearTimeout(aiTimer); aiTimer=null; generation++; }
function posStyle(square) {
  const flipped=mode==='remote' && remote.role==='guest';
  return `--x:${flipped?8-square%9:square%9};--y:${flipped?9-Math.floor(square/9):Math.floor(square/9)}`;
}
const names={r:'車',n:'馬',b:'象',a:'士',k:'將',c:'砲',p:'卒'};
const redNames={r:'俥',n:'傌',b:'相',a:'仕',k:'帥',c:'炮',p:'兵'};
const numerals='零一二三四五六七八九';
function notation(board,move) {
  const piece=board[move.from], side=sideOf(piece), kind=typeOf(piece);
  const fx=move.from%9, fy=Math.floor(move.from/9), tx=move.to%9, ty=Math.floor(move.to/9);
  const file=x => numerals[side===RED ? 9-x : x+1];
  const action=fy===ty?'平':((side===RED ? ty<fy : ty>fy)?'進':'退');
  const target=(fy===ty || ['n','b','a'].includes(kind))?file(tx):numerals[Math.abs(ty-fy)];
  return `${side===RED?redNames[kind]:names[kind]}${file(fx)}${action}${target}`;
}
function winnerText(outcome) { return `${outcome.winner===RED?'红':'黑'}方胜 · ${outcome.reason}`; }
function currentOutcome() { return current().outcome ?? gameOutcome(current().board,current().turn); }

function render() {
  const {board,turn,move}=current();
  const outcome=currentOutcome();
  const thinking=started && mode==='ai' && turn===BLACK && !outcome;
  const canPlay=started && !outcome && !thinking && (mode!=='remote' || (remote.connected && !remote.awaiting && turn===(remote.role==='host'?RED:BLACK)));
  const legal=selected!==null && canPlay ? legalMoves(board,turn,selected) : [];
  els.pieces.replaceChildren(); els.hints.replaceChildren(); els.last.replaceChildren();
  if (move) for (const square of [move.from,move.to]) {
    const mark=document.createElement('div'); mark.className='last-position'; mark.style=posStyle(square); els.last.append(mark);
  }
  for (let square=0;square<90;square++) {
    const piece=board[square]; if (!piece) continue;
    const el=document.createElement('button');
    el.type='button'; el.className=`piece ${sideOf(piece)===RED?'red':'black'}`;
    if (sideOf(piece)===turn && canPlay) el.classList.add('selectable');
    if (square===selected) el.classList.add('selected');
    if (typeOf(piece)==='k' && sideOf(piece)===turn && inCheck(board,turn)) el.classList.add('in-check');
    el.style=posStyle(square); el.dataset.square=square;
    el.setAttribute('aria-label',`${sideOf(piece)===RED?'红':'黑'}方${GLYPHS[piece]}，第${Math.floor(square/9)+1}行第${square%9+1}列`);
    const glyph=document.createElement('span'); glyph.textContent=GLYPHS[piece]; el.append(glyph); els.pieces.append(el);
  }
  for (const {to} of legal) {
    const hint=document.createElement('button'); hint.type='button';
    hint.className=`hint${board[to]?' capture':''}`; hint.style=posStyle(to); hint.dataset.square=to;
    hint.setAttribute('aria-label',`走到第${Math.floor(to/9)+1}行第${to%9+1}列`); els.hints.append(hint);
  }
  els.modeLabel.textContent=mode==='ai'?'人机对弈':mode==='local'?'双人对弈':'远程对弈';
  $('difficultyLabel').hidden=mode!=='ai';
  $('difficultyLabel').textContent=`${{easy:'入门',normal:'标准',hard:'挑战'}[difficulty]}难度`;
  els.modeSummary.querySelector('.summary-symbol').textContent=mode==='ai'?'✦':mode==='local'?'♙':'◇';
  const flipped=mode==='remote'&&remote.role==='guest';
  const topSide=flipped?RED:BLACK, bottomSide=other(topSide);
  els.topName.textContent=mode==='ai'?'电脑棋手':mode==='remote'?'对手':`${topSide===RED?'红':'黑'}方棋手`;
  els.bottomName.textContent=mode==='remote'||mode==='ai'?'你':`${bottomSide===RED?'红':'黑'}方棋手`;
  els.topSub.textContent=`执${topSide===RED?'红':'黑'} · ${topSide===RED?'先':'后'}手`;
  els.bottomSub.textContent=`执${bottomSide===RED?'红':'黑'} · ${bottomSide===RED?'先':'后'}手`;
  const topIcon=document.querySelector('.opponent .player-icon'), bottomIcon=document.querySelector('.self .player-icon');
  topIcon.textContent=topSide===RED?'帥':'將'; bottomIcon.textContent=bottomSide===RED?'帥':'將';
  topIcon.classList.toggle('red-icon',topSide===RED); topIcon.classList.toggle('black-icon',topSide===BLACK);
  bottomIcon.classList.toggle('red-icon',bottomSide===RED); bottomIcon.classList.toggle('black-icon',bottomSide===BLACK);
  els.board.setAttribute('aria-label',`中国象棋棋盘，${bottomSide===RED?'红':'黑'}方在下，${topSide===RED?'红':'黑'}方在上`);
  els.topBadge.classList.toggle('active',started&&turn===topSide&&!outcome); els.bottomBadge.classList.toggle('active',started&&turn===bottomSide&&!outcome);
  const turnBadge=side=>!started?'尚未开始':outcome?'对局结束':turn===side?(mode==='remote'&&!remote.connected?'等待连接':thinking?'正在思考':'请走棋'):'等待走棋';
  els.topBadge.textContent=turnBadge(topSide); els.bottomBadge.textContent=turnBadge(bottomSide);
  els.status.textContent=mode==='remote'&&!remote.connected?`房间 ${remote.code||'------'} · 等待连接`:!started?'请选择对弈模式，开始新的一局':outcome?winnerText(outcome):thinking?'电脑正在思考下一步…':inCheck(board,turn)?`${turn===RED?'红':'黑'}方被将军，请先解将`:`轮到${turn===RED?'红':'黑'}方走棋${mode==='local'?' · 同屏双人':mode==='remote'?` · 房间 ${remote.code}`:''}`;
  els.undo.disabled=mode==='remote'||!started||history.length<=1||!!outcome;
  $('restartButton').disabled=mode==='remote';
  $('resignButton').disabled=!started||!!outcome;
  $('leaveActiveRoom').hidden=mode!=='remote';
  $('resultRematch').hidden=mode==='remote';
  $('resultChoose').textContent=mode==='remote'?'退出房间':'更换对手';
  els.resultLink.hidden=!started||!outcome;
  const plays=history.slice(1); els.count.textContent=`第 ${Math.ceil(plays.length/2)} 回合`;
  els.list.replaceChildren();
  if (!plays.length) { const empty=document.createElement('div'); empty.className='empty-moves'; empty.textContent='落子之后，棋谱会出现在这里。'; els.list.append(empty); }
  else for (let i=0;i<plays.length;i+=2) {
    const row=document.createElement('div'); row.className='move-row';
    for (const value of [`${i/2+1}.`,plays[i].notation,plays[i+1]?.notation||'···']) {
      const span=document.createElement('span'); span.textContent=value; row.append(span);
    }
    els.list.append(row);
  }
  els.list.scrollTop=els.list.scrollHeight;
}

function commitMove(move) {
  const old=current();
  history.push({board:applyMove(old.board,move),turn:other(old.turn),move,notation:notation(old.board,move)});
  selected=null; save(); render();
  if (mode==='remote' && remote.role==='host') sendSync();
  const outcome=currentOutcome();
  if (outcome) showResult(outcome);
  else scheduleAI();
}
function scheduleAI() {
  const {board,turn}=current();
  if (!started || mode!=='ai' || turn!==BLACK || currentOutcome() || settingsDialog.open || resignDialog.open) return;
  clearAI(); const ticket=generation;
  aiTimer=setTimeout(() => {
    if (ticket!==generation || mode!=='ai' || current().turn!==BLACK) return;
    const choice=chooseAIMove(current().board,{easy:1,normal:2,hard:3}[difficulty]);
    aiTimer=null;
    if (choice) commitMove(choice);
  },420);
}
function handleSquare(square) {
  const {board,turn}=current();
  if (!started || currentOutcome() || (mode==='ai'&&turn===BLACK) || (mode==='remote'&&(!remote.connected||remote.awaiting||turn!==(remote.role==='host'?RED:BLACK)))) return;
  if (selected!==null) {
    const move=legalMoves(board,turn,selected).find(m=>m.to===square);
    if (move) {
      if (mode==='remote'&&remote.role==='guest') {
        remote.awaiting=true; selected=null; remote.conn.send({type:'move',from:move.from,to:move.to,ply:history.length-1}); render();
      } else commitMove(move);
      return;
    }
  }
  selected=sideOf(board[square])===turn?(selected===square?null:square):null;
  render();
}
els.board.addEventListener('click',event => {
  const target=event.target.closest('[data-square]');
  if (target) handleSquare(Number(target.dataset.square));
});
function reset(nextMode=mode) { clearAI(); mode=nextMode; history=[INITIAL()]; selected=null; started=true; save(); render(); }
$('restartButton').addEventListener('click',()=>{
  if (settingsDialog.open) settingsDialog.close();
  if (started) reset(); else openStart();
});
els.undo.addEventListener('click',()=>{
  clearAI(); if(!started||history.length<=1)return;
  const pendingAI=mode==='ai' && current().turn===BLACK;
  history.pop();
  if (mode==='ai' && !pendingAI && history.length>1) history.pop();
  selected=null; save(); render(); scheduleAI();
});
function setChoices(first,second,third,selectedMode) {
  for (const [button,value] of [[first,'ai'],[second,'local'],[third,'remote']]) {
    button.classList.toggle('selected',selectedMode===value);
    button.setAttribute('aria-pressed',String(selectedMode===value));
  }
}
function openStart() {
  clearAI(); started=false; selected=null; pendingStartMode=null; pendingStartDifficulty=difficulty;
  const outcome=currentOutcome();
  const resumeOnly=(wasStarted || history.length>1) && !outcome;
  $('startTitle').textContent=resumeOnly?'继续未完成的对局':'落子之前，先选对手';
  $('startIntro').textContent=resumeOnly?'本局已开始。请先完成当前对局，之后再选择模式和难度。':'楚河为界，红方先行。选择一种对弈方式，开始这一局。';
  $('startChoices').hidden=resumeOnly;
  $('beginButton').hidden=resumeOnly;
  setChoices($('startAi'),$('startLocal'),$('startRemote'),null);
  updateStartDifficulty();
  $('startDifficultyArea').hidden=true;
  $('beginButton').disabled=true; $('beginButton').textContent='请选择对弈方式';
  const canContinue=resumeOnly || history.length>1 || !!outcome;
  $('continueButton').hidden=!canContinue;
  $('continueButton').classList.toggle('resume-primary',resumeOnly);
  $('continueButton').textContent=outcome?'查看上局':'继续上局';
  render(); startDialog.showModal();
}
startDialog.addEventListener('cancel',event=>event.preventDefault());
function showResult(outcome) {
  $('resultTitle').textContent=`${outcome.winner===RED?'红':'黑'}方获胜`;
  $('resultReason').textContent=outcome.reason;
  if (!resultDialog.open) resultDialog.showModal();
}
for (const [id,value] of [['startAi','ai'],['startLocal','local'],['startRemote','remote']]) {
  $(id).addEventListener('click',()=>{
    pendingStartMode=value;
    setChoices($('startAi'),$('startLocal'),$('startRemote'),value);
    updateStartDifficulty();
    $('beginButton').disabled=false;
    $('beginButton').textContent=value==='remote'?'创建或加入房间':'开始对弈';
  });
}
function updateStartDifficulty() {
  $('startDifficultyArea').hidden=pendingStartMode!=='ai';
  for (const [id,value] of [['startEasy','easy'],['startNormal','normal'],['startHard','hard']]) {
    $(id).classList.toggle('selected',pendingStartDifficulty===value);
    $(id).setAttribute('aria-pressed',String(pendingStartDifficulty===value));
  }
}
for (const [id,value] of [['startEasy','easy'],['startNormal','normal'],['startHard','hard']]) {
  $(id).addEventListener('click',()=>{ pendingStartDifficulty=value; updateStartDifficulty(); });
}
$('beginButton').addEventListener('click',()=>{
  if (!pendingStartMode) return;
  startDialog.close();
  if (pendingStartMode==='remote') { openRoom(); return; }
  difficulty=pendingStartDifficulty; reset(pendingStartMode);
});
$('continueButton').addEventListener('click',()=>{
  startDialog.close(); started=true; save(); render();
  const outcome=currentOutcome();
  if (outcome) showResult(outcome); else scheduleAI();
});
function openSettings() {
  clearAI(); settingsDialog.showModal();
}
$('settingsButton').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('close',scheduleAI);
$('resultRematch').addEventListener('click',()=>{ resultDialog.close(); reset(); });
$('resultChoose').addEventListener('click',()=>{ resultDialog.close(); if(mode==='remote') leaveRemote(); else openStart(); });
$('viewBoard').addEventListener('click',()=>resultDialog.close());
els.resultLink.addEventListener('click',()=>{ settingsDialog.close(); showResult(currentOutcome()); });
$('resignButton').addEventListener('click',()=>{
  if (!started || currentOutcome()) return;
  resigningSide=mode==='ai'?RED:mode==='remote'?(remote.role==='host'?RED:BLACK):current().turn;
  $('resignExplanation').textContent=`${resigningSide===RED?'红':'黑'}方认输后，本局立即结束，${resigningSide===RED?'黑':'红'}方获胜。`;
  clearAI(); settingsDialog.close(); resignDialog.showModal();
});
$('cancelResign').addEventListener('click',()=>resignDialog.close());
resignDialog.addEventListener('close',scheduleAI);
$('confirmResign').addEventListener('click',()=>{
  clearAI();
  if (mode==='remote' && remote.role==='guest') {
    if (remote.connected) remote.conn.send({type:'resign'});
    resignDialog.close(); return;
  }
  current().outcome={winner:other(resigningSide),reason:`${resigningSide===RED?'红':'黑'}方认输`};
  save(); resignDialog.close(); render();
  if (mode==='remote') sendSync();
  showResult(currentOutcome());
});

function setRoomStatus(message) { $('roomStatus').textContent=message; }
function displayRoom(code) {
  $('roomWaiting').hidden=!code;
  $('roomActions').hidden=!!code;
  if (code) $('roomCode').textContent=code;
}
function openRoom() {
  mode='remote'; started=false; history=[INITIAL()]; selected=null;
  try { localStorage.removeItem('chuhe-save'); } catch {}
  displayRoom(null); $('roomInput').value=''; setRoomStatus(''); render();
  if (!roomDialog.open) roomDialog.showModal();
}
function destroyPeer() {
  remote.token++;
  try { remote.conn?.close(); } catch {}
  try { remote.peer?.destroy(); } catch {}
  remote={peer:null,conn:null,role:null,code:null,connected:false,awaiting:false,token:remote.token};
}
function leaveRemote() {
  if (mode==='remote' && remote.conn?.open) remote.conn.send({type:'closed'});
  destroyPeer();
  if (roomDialog.open) roomDialog.close();
  if (settingsDialog.open) settingsDialog.close();
  mode='ai'; history=[INITIAL()]; started=false; wasStarted=false; selected=null;
  save(); openStart();
}
function roomError(error) {
  const name=error?.type||'';
  if (name==='peer-unavailable') setRoomStatus('没有找到该房间。请确认房间号，并让创建者保持页面打开。');
  else if (name==='network'||name==='server-error'||name==='socket-error') setRoomStatus('无法连接联机服务，请检查网络后重试。');
  else setRoomStatus('连接未成功，请重试。');
  if (!roomDialog.open) roomDialog.showModal();
}
function sendSync() {
  if (remote.role!=='host'||!remote.conn?.open) return;
  remote.conn.send({type:'sync',moves:history.slice(1).map(h=>h.move),outcome:current().outcome||null});
}
function rebuildRemote(data) {
  if (!Array.isArray(data.moves)||data.moves.length>400) return null;
  const result=[INITIAL()];
  for (const item of data.moves) {
    if (!item || !Number.isInteger(item.from)||!Number.isInteger(item.to)) return null;
    const previous=result.at(-1);
    const move=legalMoves(previous.board,previous.turn,item.from).find(candidate=>candidate.to===item.to);
    if (!move) return null;
    result.push({board:applyMove(previous.board,move),turn:other(previous.turn),move,notation:notation(previous.board,move)});
  }
  if (data.outcome) {
    if (![RED,BLACK].includes(data.outcome.winner)||typeof data.outcome.reason!=='string'||data.outcome.reason.length>50) return null;
    result.at(-1).outcome={winner:data.outcome.winner,reason:data.outcome.reason};
  }
  return result;
}
function attachConnection(conn,token) {
  if (remote.conn?.open) {
    conn.on('open',()=>{ conn.send({type:'full'}); setTimeout(()=>conn.close(),100); });
    return;
  }
  remote.conn=conn;
  conn.on('open',()=>{
    if (token!==remote.token) return;
    remote.connected=true; remote.awaiting=false;
    if (remote.role==='host') {
      started=true; sendSync(); setRoomStatus('对手已加入，红方先行。');
      if (roomDialog.open) roomDialog.close();
    } else setRoomStatus('已连接，正在同步棋局…');
    render();
  });
  conn.on('data',data=>{
    if (token!==remote.token||!data||typeof data!=='object') return;
    if (remote.role==='host') {
      if (data.type==='move' && remote.connected && started && !currentOutcome() && current().turn===BLACK && data.ply===history.length-1 && Number.isInteger(data.from) && Number.isInteger(data.to)) {
        const move=legalMoves(current().board,BLACK,data.from).find(m=>m.to===data.to);
        if (move) commitMove(move); else sendSync();
      } else if (data.type==='resign' && remote.connected && started && !currentOutcome()) {
        current().outcome={winner:RED,reason:'黑方认输'}; sendSync(); render(); showResult(currentOutcome());
      } else if (data.type==='move') sendSync();
    } else if (data.type==='sync') {
      const rebuilt=rebuildRemote(data);
      if (!rebuilt) { setRoomStatus('棋局数据无效，请退出房间后重试。'); return; }
      const previousOutcome=currentOutcome();
      history=rebuilt; started=true; remote.awaiting=false; remote.connected=true; selected=null;
      if (roomDialog.open) roomDialog.close();
      render();
      const outcome=currentOutcome();
      if (outcome && !previousOutcome) showResult(outcome);
    } else if (data.type==='full') {
      setRoomStatus('房间已有两名玩家，请换一个房间号。');
      if (!roomDialog.open) roomDialog.showModal();
    } else if (data.type==='closed') {
      setRoomStatus('创建者已退出房间。');
      if (!roomDialog.open) roomDialog.showModal();
    }
  });
  conn.on('close',()=>{
    if (token!==remote.token||remote.conn!==conn) return;
    remote.conn=null; remote.connected=false; remote.awaiting=false;
    setRoomStatus(remote.role==='host'?'对手已断线。房间仍在，可让对方重新输入房间号加入。':'连接已断开。请退出房间后重新加入。');
    if (!roomDialog.open && !resultDialog.open) roomDialog.showModal();
    render();
  });
  conn.on('error',error=>{ if(token===remote.token)roomError(error); });
}
function randomRoomCode() {
  const values=new Uint32Array(1); crypto.getRandomValues(values);
  return String(values[0]%1000000).padStart(6,'0');
}
function createRoom(attempt=0) {
  destroyPeer(); mode='remote'; history=[INITIAL()]; started=false; selected=null;
  remote.role='host'; remote.code=randomRoomCode();
  const token=remote.token, code=remote.code;
  setRoomStatus('正在创建房间…'); displayRoom(null); render();
  if (!window.Peer) { setRoomStatus('联机组件未加载，请刷新网页后重试。'); return; }
  const peer=new window.Peer(`chuhe-xiangqi-${code}`); remote.peer=peer;
  peer.on('open',()=>{
    if(token!==remote.token)return;
    displayRoom(code); setRoomStatus('房间已创建，等待另一位玩家加入。'); render();
  });
  peer.on('connection',conn=>{ if(token===remote.token)attachConnection(conn,token); else conn.close(); });
  peer.on('error',error=>{
    if(token!==remote.token)return;
    if(error?.type==='unavailable-id'&&attempt<8) { createRoom(attempt+1); return; }
    roomError(error);
  });
  peer.on('disconnected',()=>{ if(token===remote.token&&!peer.destroyed)peer.reconnect(); });
}
function joinRoom(code) {
  destroyPeer(); mode='remote'; history=[INITIAL()]; started=false; selected=null;
  remote.role='guest'; remote.code=code;
  const token=remote.token;
  displayRoom(null); setRoomStatus('正在加入房间…'); render();
  if (!window.Peer) { setRoomStatus('联机组件未加载，请刷新网页后重试。'); return; }
  const peer=new window.Peer(); remote.peer=peer;
  peer.on('open',()=>{
    if(token!==remote.token)return;
    const conn=peer.connect(`chuhe-xiangqi-${code}`,{serialization:'json'});
    attachConnection(conn,token);
  });
  peer.on('error',error=>{if(token===remote.token)roomError(error);});
  peer.on('disconnected',()=>{ if(token===remote.token&&!peer.destroyed)peer.reconnect(); });
}
$('createRoom').addEventListener('click',()=>createRoom());
$('joinRoom').addEventListener('click',()=>{
  const code=$('roomInput').value.trim();
  if(!/^\d{6}$/.test(code)) { setRoomStatus('请输入完整的六位数字房间号。'); $('roomInput').focus(); return; }
  joinRoom(code);
});
$('roomInput').addEventListener('input',event=>{ event.target.value=event.target.value.replace(/\D/g,'').slice(0,6); });
$('roomInput').addEventListener('keydown',event=>{ if(event.key==='Enter')$('joinRoom').click(); });
$('copyRoom').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText(remote.code); setRoomStatus('房间号已复制，发给朋友即可加入。'); }
  catch { setRoomStatus('复制失败，请手动记下房间号。'); }
});
$('leaveRoom').addEventListener('click',leaveRemote);
$('leaveActiveRoom').addEventListener('click',leaveRemote);
roomDialog.addEventListener('cancel',event=>event.preventDefault());
const rules=$('rulesDialog');
$('rulesButton').addEventListener('click',()=>rules.showModal());
$('closeRules').addEventListener('click',()=>rules.close());
$('gotIt').addEventListener('click',()=>rules.close());
rules.addEventListener('click',event=>{ if(event.target===rules)rules.close(); });
function restoreFromLink() {
  const params=new URLSearchParams(location.search);
  const code=params.get('restore');
  if (!code || !/^[0-9a-z]{4,400}$/.test(code) || code.length%4) return;
  const restored=[INITIAL()];
  for (let offset=0;offset<code.length;offset+=4) {
    const from=parseInt(code.slice(offset,offset+2),36);
    const to=parseInt(code.slice(offset+2,offset+4),36);
    const state=restored.at(-1);
    if (from>=90 || to>=90) return;
    const move=legalMoves(state.board,state.turn,from).find(candidate=>candidate.to===to);
    if (!move) return;
    restored.push({board:applyMove(state.board,move),turn:other(state.turn),move,notation:notation(state.board,move)});
  }
  history=restored;
  mode=params.get('mode')==='local'?'local':'ai';
  save();
  window.history.replaceState(null,'',location.pathname);
}
restoreFromLink();
openStart();
