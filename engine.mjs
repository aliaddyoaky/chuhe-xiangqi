export const RED = 'r';
export const BLACK = 'b';
export const other = side => side === RED ? BLACK : RED;
export const sideOf = piece => piece?.[0] ?? null;
export const typeOf = piece => piece?.[1] ?? null;
export const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
export const index = (x, y) => y * 9 + x;

export function initialBoard() {
  const board = Array(90).fill(null);
  const back = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
  for (let x = 0; x < 9; x++) {
    board[index(x, 0)] = `b${back[x]}`;
    board[index(x, 9)] = `r${back[x]}`;
  }
  for (const x of [1, 7]) {
    board[index(x, 2)] = 'bc';
    board[index(x, 7)] = 'rc';
  }
  for (const x of [0, 2, 4, 6, 8]) {
    board[index(x, 3)] = 'bp';
    board[index(x, 6)] = 'rp';
  }
  return board;
}

function palace(side, x, y) {
  return x >= 3 && x <= 5 && (side === BLACK ? y >= 0 && y <= 2 : y >= 7 && y <= 9);
}

export function pseudoMoves(board, from) {
  const piece = board[from];
  if (!piece) return [];
  const side = sideOf(piece), kind = typeOf(piece);
  const x = from % 9, y = Math.floor(from / 9), moves = [];
  const add = (tx, ty) => {
    if (!inside(tx, ty)) return;
    const to = index(tx, ty);
    if (sideOf(board[to]) !== side) moves.push({ from, to });
  };
  if (kind === 'r' || kind === 'c') {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let tx = x + dx, ty = y + dy, screen = false;
      while (inside(tx, ty)) {
        const target = board[index(tx, ty)];
        if (kind === 'r') {
          if (target) { if (sideOf(target) !== side) add(tx, ty); break; }
          add(tx, ty);
        } else if (!screen) {
          if (target) screen = true;
          else add(tx, ty);
        } else if (target) {
          if (sideOf(target) !== side) add(tx, ty);
          break;
        }
        tx += dx; ty += dy;
      }
    }
  } else if (kind === 'n') {
    for (const [lx, ly, dx, dy] of [
      [0,-1,-1,-2],[0,-1,1,-2],[0,1,-1,2],[0,1,1,2],
      [-1,0,-2,-1],[-1,0,-2,1],[1,0,2,-1],[1,0,2,1]
    ]) if (inside(x+lx,y+ly) && !board[index(x+lx,y+ly)]) add(x+dx,y+dy);
  } else if (kind === 'b') {
    for (const [dx, dy] of [[2,2],[2,-2],[-2,2],[-2,-2]]) {
      const tx=x+dx, ty=y+dy;
      if (!inside(tx,ty) || (side === BLACK && ty > 4) || (side === RED && ty < 5)) continue;
      if (!board[index(x+dx/2,y+dy/2)]) add(tx,ty);
    }
  } else if (kind === 'a') {
    for (const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      if (palace(side,x+dx,y+dy)) add(x+dx,y+dy);
    }
  } else if (kind === 'k') {
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if (palace(side,x+dx,y+dy)) add(x+dx,y+dy);
    }
    const direction = side === RED ? -1 : 1;
    for (let ty = y+direction; inside(x,ty); ty += direction) {
      const target = board[index(x,ty)];
      if (target) { if (target === `${other(side)}k`) add(x,ty); break; }
    }
  } else if (kind === 'p') {
    const forward = side === RED ? -1 : 1;
    add(x,y+forward);
    if (side === RED ? y <= 4 : y >= 5) {
      add(x-1,y); add(x+1,y);
    }
  }
  return moves;
}

export function applyMove(board, move) {
  const next = board.slice();
  next[move.to] = next[move.from];
  next[move.from] = null;
  return next;
}

export function inCheck(board, side) {
  const king = board.indexOf(`${side}k`);
  if (king < 0) return true;
  const enemy = other(side);
  for (let i = 0; i < 90; i++) {
    if (sideOf(board[i]) !== enemy) continue;
    if (pseudoMoves(board, i).some(move => move.to === king)) return true;
  }
  return false;
}

export function legalMoves(board, side, from = null) {
  const moves = [];
  const start = from === null ? 0 : from;
  const end = from === null ? 90 : from + 1;
  for (let i = start; i < end; i++) {
    if (sideOf(board[i]) !== side) continue;
    for (const move of pseudoMoves(board, i)) {
      if (!inCheck(applyMove(board, move), side)) moves.push(move);
    }
  }
  return moves;
}

export function gameOutcome(board, turn) {
  if (!board.includes('rk')) return { winner: BLACK, reason: '红方将帅被擒' };
  if (!board.includes('bk')) return { winner: RED, reason: '黑方将帅被擒' };
  if (legalMoves(board, turn).length) return null;
  return { winner: other(turn), reason: inCheck(board, turn) ? '将死' : '困毙' };
}

const VALUES = { k: 10000, r: 900, c: 450, n: 420, b: 220, a: 220, p: 110 };
function score(board) {
  let total = 0;
  for (let i=0; i<90; i++) {
    const piece=board[i]; if (!piece) continue;
    const side=sideOf(piece), kind=typeOf(piece), y=Math.floor(i/9);
    let value=VALUES[kind];
    if (kind === 'p') value += (side === BLACK ? y : 9-y)*18 + ((side === BLACK ? y >= 5 : y <= 4) ? 40 : 0);
    if (kind === 'n' || kind === 'c') value += (4-Math.abs(i%9-4))*5;
    total += side === BLACK ? value : -value;
  }
  return total;
}

function ordered(board, side) {
  return legalMoves(board,side).sort((a,b) =>
    (VALUES[typeOf(board[b.to])] || 0) - (VALUES[typeOf(board[a.to])] || 0));
}

function search(board, side, depth, alpha, beta) {
  if (!board.includes('rk')) return 100000 + depth;
  if (!board.includes('bk')) return -100000 - depth;
  if (depth === 0) return score(board);
  const moves=ordered(board,side);
  if (!moves.length) return side === BLACK ? -100000-depth : 100000+depth;
  if (side === BLACK) {
    let best=-Infinity;
    for (const move of moves) {
      best=Math.max(best,search(applyMove(board,move),RED,depth-1,alpha,beta));
      alpha=Math.max(alpha,best); if (alpha>=beta) break;
    }
    return best;
  }
  let best=Infinity;
  for (const move of moves) {
    best=Math.min(best,search(applyMove(board,move),BLACK,depth-1,alpha,beta));
    beta=Math.min(beta,best); if (alpha>=beta) break;
  }
  return best;
}

export function chooseAIMove(board, depth = 2) {
  const moves=ordered(board,BLACK);
  if (!moves.length) return null;
  let best=-Infinity, choices=[];
  for (const move of moves) {
    const value=search(applyMove(board,move),RED,depth-1,-Infinity,Infinity);
    if (value > best + 0.01) { best=value; choices=[move]; }
    else if (Math.abs(value-best)<0.01) choices.push(move);
  }
  return choices[Math.floor(Math.random()*choices.length)];
}

export const GLYPHS = {
  rr:'俥', rn:'傌', rb:'相', ra:'仕', rk:'帥', rc:'炮', rp:'兵',
  br:'車', bn:'馬', bb:'象', ba:'士', bk:'將', bc:'砲', bp:'卒'
};
