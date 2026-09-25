// Color Tiles Solver: game-faithful presentation + original BFS solver.
let gridSize = 5;
let grid = [];
let currentColor = 'red';
const COLORS = ['red','yellow','orange','grey','purple','teal','blue','pink','white','black','cyan','brown'];
const EMPTY = null;
const GRASS = 'GRASS';
const DIRECTIONS = { Up:[-1,0], Down:[1,0], Left:[0,-1], Right:[0,1] };
const OPPOSITE = { Up:'Down', Down:'Up', Left:'Right', Right:'Left' };
let undoStack = [];
let isSolving = false;
const SOLVER_TIMEOUT_MS = 30000;
const SOLVER_YIELD_EVERY = 750;

const COLOR_INFO = {
  red:['Red','#e65a4c'], yellow:['Yellow','#f2c33f'], orange:['Orange','#e88a30'], grey:['Gray','#8b8f91'],
  purple:['Purple','#9d5bc9'], teal:['Teal','#42aeb0'], blue:['Blue','#4e8ed0'], pink:['Pink','#df6b92'],
  white:['White','#f7f7f2'], black:['Black','#313534'], cyan:['Cyan','#35c5d0'], brown:['Brown','#9a6543']
};

class BoardState {
  constructor(board, history=[]) { this.grid=board.map(r=>r.slice()); this.moveHistory=history.slice(); this.rows=board.length; this.cols=board[0].length; }
  copy(){ return new BoardState(this.grid,this.moveHistory); }
  isSolved(){ return this.grid.flat().every(cell=>cell===EMPTY || cell===GRASS); }
  hashable(){ return this.grid.flat().map(v=>v===null?'_':v).join('|'); }
}

function tileColor(c){ return COLOR_INFO[c]?.[1] || '#f4d77c'; }
function symbolClass(c){ return c && COLOR_INFO[c] ? c : ''; }

function initGrid(){
  const container=document.getElementById('grid-container');
  container.innerHTML='';
  container.style.gridTemplateColumns=`repeat(${gridSize}, 1fr)`;
  grid=[];
  for(let r=0;r<gridSize;r++){
    const row=[];
    for(let c=0;c<gridSize;c++){
      const tile=document.createElement('button');
      tile.type='button'; tile.className='tile empty'; tile.dataset.row=r; tile.dataset.col=c;
      tile.addEventListener('click',()=>placeTile(r,c));
      container.appendChild(tile); row.push(EMPTY);
    }
    grid.push(row);
  }
  undoStack=[];
  renderGrid(); updateMeta(); resetSolution();
}

function pushUndo(){ undoStack.push(grid.map(r=>r.slice())); if(undoStack.length>30) undoStack.shift(); }
function undo(){ if(!undoStack.length) return; grid=undoStack.pop(); renderGrid(); updateMeta(); resetSolution(false); }

function setColor(color){ currentColor=color; updatePalette(); }
function getColorCounts(){
  const counts=Object.fromEntries(COLORS.map(color=>[color,0]));
  for(const row of grid){
    for(const value of row){
      if(COLORS.includes(value)) counts[value]++;
    }
  }
  return counts;
}

function countColor(color){
  return getColorCounts()[color] || 0;
}

function placeTile(r,c){
  const previous=grid[r][c];
  const next=currentColor;
  if(previous===next) return;

  // A color can appear at most four times in the entered puzzle.
  if(COLORS.includes(next) && countColor(next)>=4){
    window.alert(`${COLOR_INFO[next][0]} already has 4 blocks. A puzzle can only contain 4 blocks of the same color.`);
    return;
  }

  pushUndo();
  grid[r][c]=next;
  renderGrid(); updateMeta(); resetSolution(false);
}

function renderGrid(){
  const cells=document.querySelectorAll('#grid-container .tile');
  cells.forEach((cell,i)=>{
    const r=Math.floor(i/gridSize), c=i%gridSize, value=grid[r][c];
    cell.className='tile'; cell.style.background=''; cell.innerHTML='';
    cell.setAttribute('aria-label',`Row ${r+1}, column ${c+1}`);
    if(value===EMPTY){ cell.classList.add('empty'); cell.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, empty`); return; }
    if(value===GRASS){ cell.classList.add('grass-tile'); cell.innerHTML='<span class="tile-symbol" aria-hidden="true"></span>'; cell.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, obstacle`); return; }
    cell.classList.add('filled',symbolClass(value)); cell.style.backgroundColor=tileColor(value);
    cell.innerHTML='<span class="tile-symbol" aria-hidden="true"></span>';
    cell.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, ${COLOR_INFO[value]?.[0]||value}`);
  });
  updatePalette();
}

function updatePalette(){
  document.querySelectorAll('.color-btn,.utility-btn').forEach(b=>b.classList.toggle('active',b.dataset.color===(currentColor===EMPTY?'empty':currentColor)));
  const dot=document.getElementById('selected-color'), name=document.getElementById('selected-name');
  if(currentColor===EMPTY){ dot.style.background='#f4d77c'; name.textContent='Erase'; }
  else if(currentColor===GRASS){ dot.style.background='#5f8d3a'; name.textContent='Obstacle'; }
  else { dot.style.background=tileColor(currentColor); name.textContent=COLOR_INFO[currentColor][0]; }
}

function updateMeta(){
  document.getElementById('grid-size-label').textContent=`${gridSize} × ${gridSize}`;
  const count=grid.flat().filter(v=>v!==EMPTY && v!==GRASS).length;
  const obstacles=grid.flat().filter(v=>v===GRASS).length;
  document.getElementById('tile-count').textContent=String(count);
  document.getElementById('board-status').textContent=count===0 && obstacles===0?'No tiles entered':`${count} tile${count===1?'':'s'} · ${obstacles} obstacle${obstacles===1?'':'s'}`;
  document.getElementById('move-count').textContent=count;
  document.getElementById('moves-label').textContent=count===1?' tile':' tiles';
  document.getElementById('level-indicator').textContent=`${Math.max(1,Math.min(20,gridSize-2))} / 20`;
  document.getElementById('date-pill').textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'}).replaceAll('/','.');
}

function slideOneStep(state,direction){
  const next=state.copy(); let moved=false; const [dr,dc]=DIRECTIONS[direction];
  const rs=[...Array(state.rows).keys()], cs=[...Array(state.cols).keys()];
  if(direction==='Down') rs.reverse(); if(direction==='Right') cs.reverse();
  for(const r of rs) for(const c of cs){
    const value=next.grid[r][c]; if(value===EMPTY||value===GRASS) continue;
    const nr=r+dr,nc=c+dc;
    if(nr<0||nr>=state.rows||nc<0||nc>=state.cols) continue;
    if(next.grid[nr][nc]===EMPTY){ next.grid[nr][nc]=value; next.grid[r][c]=EMPTY; moved=true; }
  }
  const cleared=clearGroups(next);
  if(!moved&&!cleared) return null;
  next.moveHistory.push(direction); return next;
}

function clearGroups(state){
  const visited=Array.from({length:state.rows},()=>Array(state.cols).fill(false)); let cleared=false;
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    const color=state.grid[r][c]; if(visited[r][c]||color===EMPTY||color===GRASS) continue;
    const q=[[r,c]], component=[]; visited[r][c]=true;
    while(q.length){
      const [cr,cc]=q.shift(); component.push([cr,cc]);
      for(const [dr,dc] of Object.values(DIRECTIONS)){
        const nr=cr+dr,nc=cc+dc;
        if(nr>=0&&nr<state.rows&&nc>=0&&nc<state.cols&&!visited[nr][nc]&&state.grid[nr][nc]===color){visited[nr][nc]=true;q.push([nr,nc]);}
      }
    }
    if(component.length===4){ cleared=true; component.forEach(([rr,cc])=>state.grid[rr][cc]=EMPTY); }
  }
  return cleared;
}

async function solvePuzzle(initial, timeoutMs=SOLVER_TIMEOUT_MS){
  const startedAt=performance.now();
  const queue=[initial];
  const visited=new Set([initial.hashable()]);
  let head=0;
  let processed=0;

  while(head<queue.length){
    if(performance.now()-startedAt>=timeoutMs){
      return {status:'timeout', elapsed:performance.now()-startedAt, visited:visited.size};
    }

    const current=queue[head++];
    processed++;
    if(current.isSolved()) return {status:'solved', moves:current.moveHistory, elapsed:performance.now()-startedAt, visited:visited.size};

    for(const direction of Object.keys(DIRECTIONS)){
      if(current.moveHistory.length && OPPOSITE[direction]===current.moveHistory[current.moveHistory.length-1]) continue;
      const next=slideOneStep(current,direction);
      if(!next) continue;
      const h=next.hashable();
      if(!visited.has(h)){
        visited.add(h);
        queue.push(next);
      }
    }

    // Keep the page responsive so a bad board cannot freeze the browser.
    if(processed % SOLVER_YIELD_EVERY===0){
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }

  return {status:'unsolved', elapsed:performance.now()-startedAt, visited:visited.size};
}

function resetSolution(show=true){
  document.getElementById('solution-title').textContent=show?'Waiting for your board':'Board updated';
  document.getElementById('solution-badge').textContent='—';
  document.getElementById('solution-display').innerHTML='<span class="solution-muted">Enter the puzzle, then find the shortest move sequence.</span>';
}

function renderSolution(result){
  const display=document.getElementById('solution-display');
  display.innerHTML='';

  if(result.status==='timeout' || result.status==='unsolved'){
    document.getElementById('solution-title').textContent='No solution found';
    document.getElementById('solution-badge').textContent='—';
    display.innerHTML='<span class="solution-muted">Check that every colored tile is in the correct position and that the board has not been entered incorrectly.</span>';
    return;
  }

  const solution=result.moves;
  document.getElementById('solution-title').textContent='Solution found';
  document.getElementById('solution-badge').textContent=`${solution.length} move${solution.length===1?'':'s'}`;
  const arrows={Up:'↑',Down:'↓',Left:'←',Right:'→'};
  const list=document.createElement('div'); list.className='move-list';
  solution.forEach((move,i)=>{
    const step=document.createElement('div'); step.className='move-step'; step.title=`Move ${i+1}: ${move}`;
    const num=document.createElement('span'); num.className='move-number'; num.textContent=i+1;
    const arrow=document.createElement('span'); arrow.className='move-arrow'; arrow.textContent=arrows[move];
    step.append(num,arrow); list.appendChild(step);
    if(i<solution.length-1){const sep=document.createElement('span');sep.className='move-separator';sep.textContent='›';list.appendChild(sep);}
  });
  display.appendChild(list);
}

function validateBoard(){
  const counts=getColorCounts();
  const usedColors=COLORS.filter(color=>counts[color]>0);
  const totalTiles=usedColors.reduce((sum,color)=>sum+counts[color],0);

  if(totalTiles===0){
    window.alert('Add the colored blocks to the board before finding a solution.');
    return false;
  }

  const incomplete=usedColors.filter(color=>counts[color]<4);
  if(incomplete.length){
    const names=incomplete.map(color=>`${COLOR_INFO[color][0]} (${counts[color]}/4)`).join(', ');
    window.alert(`Each color used in the puzzle must have exactly 4 blocks. Add the missing blocks: ${names}.`);
    return false;
  }

  const overfilled=usedColors.filter(color=>counts[color]>4);
  if(overfilled.length){
    const names=overfilled.map(color=>`${COLOR_INFO[color][0]} (${counts[color]})`).join(', ');
    window.alert(`A color cannot have more than 4 blocks. Please fix: ${names}.`);
    return false;
  }

  // A completely packed board cannot make a slide because there is no empty space.
  const emptyCells=grid.flat().filter(value=>value===EMPTY).length;
  if(emptyCells===0){
    window.alert('The board is completely full. Leave at least one empty space so the blocks can move.');
    return false;
  }

  return true;
}

async function solve(){
  if(isSolving) return;
  if(!validateBoard()) return;

  const button=document.getElementById('solve-button');
  const title=document.getElementById('solution-title');
  const badge=document.getElementById('solution-badge');
  const display=document.getElementById('solution-display');

  isSolving=true;
  button.disabled=true;
  button.classList.add('is-searching');
  button.querySelector('span').textContent='Finding solution…';
  title.textContent='Searching…'; badge.textContent='…';
  display.innerHTML='<span class="solution-muted">Exploring the board state space locally. This can take a few seconds.</span>';

  try{
    const result=await solvePuzzle(new BoardState(grid));
    renderSolution(result);

    if(result.status==='timeout'){
      window.alert('No solution found within 30 seconds. Check that the blocks are in the correct positions, that each color has exactly 4 blocks, and that the obstacles are entered correctly.');
    }else if(result.status==='unsolved'){
      window.alert('No solution found. Check that the blocks are in the correct positions and that the obstacles were entered correctly.');
    }
  }finally{
    isSolving=false;
    button.disabled=false;
    button.classList.remove('is-searching');
    button.querySelector('span').textContent='Find solution';
  }
}

function clearGrid(){ if(isSolving) return; pushUndo(); grid=grid.map(row=>row.map(()=>EMPTY)); renderGrid(); updateMeta(); resetSolution(); }
function changeSize(delta){
  if(isSolving) return;
  const hasEntries=grid.flat().some(value=>value!==EMPTY);
  if(hasEntries){
    const confirmed=window.confirm('Changing the board size will clear the current puzzle. Continue?');
    if(!confirmed) return;
  }
  gridSize=Math.max(3,Math.min(9,gridSize+delta));
  initGrid();
}

function setup(){
  document.querySelectorAll('.color-btn,.utility-btn').forEach(btn=>btn.addEventListener('click',()=>setColor(btn.dataset.color==='empty'?EMPTY:btn.dataset.color)));
  document.getElementById('solve-button').addEventListener('click',solve);
  document.getElementById('clear-button').addEventListener('click',clearGrid);
  document.getElementById('undo-button').addEventListener('click',undo);
  document.getElementById('size-down').addEventListener('click',()=>changeSize(-1));
  document.getElementById('size-up').addEventListener('click',()=>changeSize(1));
  const modal=document.getElementById('help-modal');
  const open=()=>modal.hidden=false, close=()=>modal.hidden=true;
  document.getElementById('help-button').addEventListener('click',open); document.getElementById('game-help').addEventListener('click',open); document.getElementById('close-help').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      // Keyboard arrows are intentionally not bound to the editor; the solver is a companion, not an autoplay script.
    }
  });
}

function paintScene(){
  const canvas=document.getElementById('scene-canvas'), ctx=canvas.getContext('2d');
  const resize=()=>{ const d=Math.min(window.devicePixelRatio||1,2); canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);draw(); };
  function draw(){
    const w=innerWidth,h=innerHeight; ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0c4b31');g.addColorStop(.18,'#4f8e35');g.addColorStop(.48,'#d6d363');g.addColorStop(.78,'#4c8738');g.addColorStop(1,'#0b442d');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let i=0;i<34;i++){
      const x=(i*137.7%w), y=(i*83.2%h), r=35+(i%7)*18;
      const rg=ctx.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,i%2?'rgba(210,228,74,.28)':'rgba(23,95,45,.28)');rg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    for(let i=0;i<45;i++){
      const x=(i*193.4+31)%w,y=(i*107.9+45)%h; drawFlower(ctx,x,y,2+(i%3),i%3===0);
    }
  }
  function drawFlower(c,x,y,r,yellow){c.save();c.translate(x,y);c.globalAlpha=.65; c.fillStyle=yellow?'#fff4a5':'#f8f5d1'; for(let p=0;p<5;p++){c.beginPath();c.ellipse(Math.cos(p*1.256)*r*1.25,Math.sin(p*1.256)*r*1.25,r*.75,r*1.2,p*1.256,0,Math.PI*2);c.fill();} c.fillStyle=yellow?'#d9c53c':'#e4c45c';c.beginPath();c.arc(0,0,r*.65,0,Math.PI*2);c.fill();c.restore();}
  addEventListener('resize',resize); resize();
}

window.addEventListener('DOMContentLoaded',()=>{setup();paintScene();initGrid();updatePalette();});
