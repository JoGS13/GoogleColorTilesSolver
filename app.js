// =========================
// GLOBAL VARIABLES
// =========================
let gridSize = 5;
let grid = [];
let currentColor = 'red';
let COLORS = ["red","blue","green","yellow","purple","orange","teal","grey","pink"];
let EMPTY = null;
let GRASS = "GRASS";
const DIRECTIONS = { "Up":[-1,0], "Down":[1,0], "Left":[0,-1], "Right":[0,1] };
const OPPOSITE = {"Up":"Down","Down":"Up","Left":"Right","Right":"Left"};

let canvas, ctx, flowers = [];
let flowersInGrid = [];

// =========================
// BACKGROUND FLOWERS
// =========================
function initBackground() {
    canvas = document.getElementById("background-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");
    flowers = [];
    for(let i=0;i<40;i++){
        flowers.push({x: Math.random()*canvas.width,y: Math.random()*canvas.height,radius:Math.random()*3+2,speed:Math.random()*0.3+0.1});
    }
    requestAnimationFrame(animateBackground);
}

function animateBackground() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#a8dba8"; // light grass-green background
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle="white";
    flowers.forEach(f=>{
        ctx.beginPath();
        ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);
        ctx.fill();
        f.y -= f.speed;
        if(f.y<0) f.y=canvas.height;
    });
    requestAnimationFrame(animateBackground);
}

window.addEventListener("resize",()=>{
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
});

// =========================
// BOARD STATE CLASS
// =========================
class BoardState {
    constructor(grid, moveHistory=[]){
        this.grid = grid.map(r=>r.slice());
        this.moveHistory = moveHistory.slice();
        this.rows = grid.length;
        this.cols = grid[0].length;
    }
    copy(){ return new BoardState(this.grid,this.moveHistory); }
    isSolved(){ return this.grid.flat().every(cell=>cell===EMPTY||cell===GRASS); }
    hashable(){ return this.grid.flat().join("|"); }
}

// =========================
// INIT GRID FUNCTIONS
// =========================
function initGridFromPage(){
    const input=document.getElementById("grid-size-input");
    let size=parseInt(input.value);
    if(isNaN(size)||size<3||size>9) size=5;
    gridSize=size;
    initGrid();
    document.getElementById("solution-display").innerHTML="";
}

function initGrid(){
    const container=document.getElementById("grid-container");
    container.innerHTML="";
    container.style.gridTemplateColumns=`repeat(${gridSize},50px)`;
    grid=[];
    for(let r=0;r<gridSize;r++){
        let row=[];
        for(let c=0;c<gridSize;c++){
            const tile=document.createElement("div");
            tile.className="tile";
            tile.dataset.row=r;
            tile.dataset.col=c;
            tile.addEventListener("click",()=>placeTile(r,c));
            container.appendChild(tile);
            row.push(EMPTY);
        }
        grid.push(row);
    }
    updateGridUI();
    generateFlowers();
}

// =========================
// FLOWERS IN GRID
// =========================
function generateFlowers(){
    const container=document.getElementById("grid-container");
    flowersInGrid.forEach(f=>container.removeChild(f));
    flowersInGrid=[];
    const numFlowers=Math.floor(gridSize*gridSize*0.2);
    for(let i=0;i<numFlowers;i++){
        const flower=document.createElement("div");
        flower.className="flower";
        const r=Math.floor(Math.random()*gridSize);
        const c=Math.floor(Math.random()*gridSize);
        const tile=container.children[r*gridSize+c];
        const offsetX=Math.random()*30+5;
        const offsetY=Math.random()*30+5;
        flower.style.left=(tile.offsetLeft+offsetX)+"px";
        flower.style.top=(tile.offsetTop+offsetY)+"px";
        container.appendChild(flower);
        flowersInGrid.push(flower);
    }
}

// =========================
// COLOR TILE FUNCTIONS
// =========================
function setColor(color){ currentColor=color; }
function placeTile(r,c){ grid[r][c]=currentColor; updateGridUI(); }

function updateGridUI(){
    const tiles=document.getElementsByClassName("tile");
    for(let r=0;r<gridSize;r++){
        for(let c=0;c<gridSize;c++){
            const idx=r*gridSize+c;
            const div=tiles[idx];
            const color=grid[r][c];
            if(color===GRASS){ div.textContent="🌿"; div.style.backgroundColor="transparent";}
            else if(color===EMPTY){ div.textContent=""; div.style.backgroundColor="#fff";}
            else{ div.style.backgroundColor=color; div.textContent="";}
        }
    }
}

// =========================
// SLIDE ONE STEP
// =========================
function slideOneStep(state, direction){
    let newState=state.copy();
    let movedPositions=new Set();
    let movedAny=false;
    let [dr,dc]=DIRECTIONS[direction];
    let rangeR=[...Array(state.rows).keys()];
    let rangeC=[...Array(state.cols).keys()];
    if(direction==="Down") rangeR.reverse();
    if(direction==="Right") rangeC.reverse();

    for(let r of rangeR){
        for(let c of rangeC){
            let current=newState.grid[r][c];
            if(current===EMPTY||current===GRASS) continue;
            let nr=r+dr, nc=c+dc;
            if(nr>=0 && nr<state.rows && nc>=0 && nc<state.cols){
                if(newState.grid[nr][nc]===EMPTY){
                    newState.grid[nr][nc]=current;
                    newState.grid[r][c]=EMPTY;
                    movedPositions.add(nr+","+nc);
                    movedAny=true;
                } else movedPositions.add(r+","+c);
            }
        }
    }
    let cleared=clearGroups(newState,movedPositions);
    if(!movedAny && !cleared) return null;
    newState.moveHistory.push(direction);
    return newState;
}

// =========================
// CLEAR GROUPS
// =========================
function clearGroups(state,movedPositions){
    let visited=Array(state.rows).fill().map(()=>Array(state.cols).fill(false));
    let toClear=[];
    for(let r=0;r<state.rows;r++){
        for(let c=0;c<state.cols;c++){
            if(visited[r][c]) continue;
            let color=state.grid[r][c];
            if(color===EMPTY||color===GRASS) continue;
            let queue=[[r,c]];
            let component=[[r,c]];
            visited[r][c]=true;
            while(queue.length>0){
                let [cr,cc]=queue.shift();
                for(let [dr,dc] of Object.values(DIRECTIONS)){
                    let nr=cr+dr, nc=cc+dc;
                    if(nr>=0 && nr<state.rows && nc>=0 && nc<state.cols && !visited[nr][nc] && state.grid[nr][nc]===color){
                        visited[nr][nc]=true;
                        queue.push([nr,nc]);
                        component.push([nr,nc]);
                    }
                }
            }
            if(component.length===4) toClear.push(...component);
        }
    }
    for(let [r,c] of toClear) state.grid[r][c]=EMPTY;
    return toClear.length>0;
}

// =========================
// SOLVER (BFS)
function solvePuzzle(initialState){
    let visited=new Set();
    let queue=[initialState];
    visited.add(initialState.hashable());
    while(queue.length>0){
        let current=queue.shift();
        if(current.isSolved()) return current.moveHistory;
        for(let direction of Object.keys(DIRECTIONS)){
            if(current.moveHistory.length>0 && OPPOSITE[direction]===current.moveHistory[current.moveHistory.length-1]) continue;
            let nextState=slideOneStep(current,direction);
            if(!nextState) continue;
            let h=nextState.hashable();
            if(!visited.has(h)){ visited.add(h); queue.push(nextState);}
        }
    }
    return null;
}

// =========================
// SOLVE BUTTON
function solve(){
    let initial=new BoardState(grid);
    let solution=solvePuzzle(initial);
    const display=document.getElementById("solution-display");
    display.innerHTML="";
    if(solution){
        const arrowMap={ "Up":"⬆️","Down":"⬇️","Left":"⬅️","Right":"➡️"};
        solution.forEach(move=>{ const span=document.createElement("span"); span.textContent=arrowMap[move]; display.appendChild(span); });
    } else display.textContent="No solution found!";
}

// =========================
// CLEAR GRID
function clearGrid(){
    grid=grid.map(r=>r.map(_=>EMPTY));
    updateGridUI();
}

// =========================
// INIT ON PAGE LOAD
window.onload=()=>{
    initBackground();
    initGrid();
};
