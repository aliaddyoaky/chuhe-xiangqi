import test from 'node:test';
import assert from 'node:assert/strict';
import { RED, BLACK, index, initialBoard, pseudoMoves, legalMoves, applyMove, inCheck, chooseAIMove, gameOutcome } from './engine.mjs';

test('initial position allows both sides to move and keeps kings safe', () => {
  const board=initialBoard();
  assert.equal(board.filter(Boolean).length,32);
  assert.ok(legalMoves(board,RED).length>30);
  assert.ok(legalMoves(board,BLACK).length>30);
  assert.equal(inCheck(board,RED),false);
  assert.equal(inCheck(board,BLACK),false);
});

test('horse leg, elephant eye, and river limits are enforced', () => {
  const board=Array(90).fill(null);
  board[index(4,9)]='rk'; board[index(4,0)]='bk'; board[index(4,5)]='rp';
  board[index(1,7)]='rn'; board[index(1,6)]='rp';
  assert.equal(pseudoMoves(board,index(1,7)).some(m=>m.to===index(0,5)),false);
  board[index(2,9)]='rb'; board[index(3,8)]='rp';
  assert.equal(pseudoMoves(board,index(2,9)).some(m=>m.to===index(4,7)),false);
  board[index(2,9)]=null; board[index(3,8)]=null; board[index(4,5)]='rb';
  assert.equal(pseudoMoves(board,index(4,5)).some(m=>Math.floor(m.to/9)<5),false);
});

test('cannon needs exactly one screen to capture', () => {
  const board=Array(90).fill(null);
  board[index(4,9)]='rk'; board[index(4,0)]='bk';
  board[index(1,7)]='rc'; board[index(1,5)]='rp'; board[index(1,3)]='bp';
  const moves=pseudoMoves(board,index(1,7));
  assert.ok(moves.some(m=>m.to===index(1,3)));
  assert.equal(moves.some(m=>m.to===index(1,4)),false);
  board[index(1,5)]=null;
  assert.equal(pseudoMoves(board,index(1,7)).some(m=>m.to===index(1,3)),false);
});

test('cannot expose two kings to each other or leave own king in check', () => {
  const board=Array(90).fill(null);
  board[index(4,9)]='rk'; board[index(4,0)]='bk'; board[index(4,5)]='rr';
  assert.equal(legalMoves(board,RED,index(4,5)).some(m=>m.to===index(5,5)),false);
  const next=applyMove(board,{from:index(4,5),to:index(4,0)});
  assert.equal(gameOutcome(next,BLACK).winner,RED);
});

test('computer chooses a legal move from the opening', () => {
  const board=initialBoard();
  const choice=chooseAIMove(board,2);
  assert.ok(legalMoves(board,BLACK).some(m=>m.from===choice.from&&m.to===choice.to));
});

test('finishes a game on checkmate and stalemate', () => {
  const board=Array(90).fill(null);
  board[index(4,0)]='bk'; board[index(4,9)]='rk';
  board[index(3,1)]='rr'; board[index(5,1)]='rr'; board[index(4,2)]='rr';
  assert.deepEqual(gameOutcome(board,BLACK),{winner:RED,reason:'将死'});
  board[index(4,2)]='rp';
  assert.deepEqual(gameOutcome(board,BLACK),{winner:RED,reason:'困毙'});
});
