let p5canvas = document.getElementById("desktop");

let player,
  ball,
  bricks,
  rows,
  cols,
  time,
  backgroundColor,
  x1,
  y1,
  xspeed,
  yspeed,
  c;
let bg, bg2, brickImage;

function preload() {
  bg = loadImage("./../img/white.jpg");
  bg2 = bg;
  brickImage = loadImage("./../img/brick.png");
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(p5canvas);
  angleMode(RADIANS);

  brickCount = 0;
  player = new Platform();
  bricks = [];
  rows = 5;
  cols = 15;
  gameState = 0;
  x1 = 50;
  y1 = 100;
  xspeed = 3;
  yspeed = 2;
  c = 0;

  for (let i = 0; i < rows; i++) {
    let row = [];
    for (let j = 0; j < cols; j++) {
      row.push(new Brick(j * 59 + 5, i * 52 + 3));
    }
    bricks.push(row);
  }
  ball = new Ball();
  time = 0;
  backgroundColor = color(44, 0, 98);
}

function draw() {
  if (gameState == 0) {
    animate();
    menu();
  } else if (gameState == 2) {
    background(backgroundColor);
    drawBackground();
    ball.move();
    player.move();
    player.checkCollision(ball);

    hitBrick = false;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        bricks[i][j].checkCollision(ball);
        if (hitBrick) {
          j = cols;
          i = rows;
        }
      }
    }

    //do all the showing
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        bricks[i][j].show();
      }
    }
    ball.show();
    player.show();
    handleTime();
    if (brickCount >= rows * cols) {
      gameState = 4;
    }
  } else if (gameState == 3) {
    gameOver();
  } else if (gameState == 4) {
    killScreen();
  }
}

function killScreen() {
  push();
  noStroke();
  textSize(30);
  fill(103, 6, 20, 0.5);
  rect(width / 2 - 170, height / 2 - 10, 340, 120, 20);
  fill(100);
  text("You Win", width / 2 - 65, height / 2 + 40);
  text("Press 'q' to top.", width / 2 - 155, height / 2 + 85);
  noLoop();
  pop();
}

function handleTime() {
  time += 1 / 60;
  push();
  strokeWeight(0);
  fill(0);
  textSize(40);
  drawingContext.shadowColor = color(255, 0, 0);
  drawingContext.shadowBlur = 40;
  strokeWeight(3);
  stroke(255, 0, 0);
  noFill();
  neon(`Score: ${brickCount}`, 50, height - 20);
  neon("Press 'q' to top", width - 350, height - 20);

  pop();
}

function neon(t, x, y) {
  // 文字
  drawingContext.shadowColor = color(255, 0, 0);
  drawingContext.shadowBlur = 20;
  strokeWeight(5);
  stroke(225, 0, 0);
  noFill();
  text(t, x, y);

  // 文字ハイライト
  strokeWeight(1);
  stroke(255, 255, 255, 240);
  drawingContext.shadowBlur = 0;
  text(t, x, y);
}

function animate() {
  background(backgroundColor);
  drawBackground();
}

function menu() {
  push();
  stroke(0);
  textSize(35);
  strokeWeight(1);
  fill("rgba(0,255,0, 0.25)");
  rect(width / 2 - 100, height / 2.5, 230, 100, 30);
  fill(360);
  strokeWeight(2);
  text("Start", width / 2 - 30, height / 2);
  neon("BrickBreaker with Smacon", width / 3, (1 / 4) * height);
  pop();
}

function gameOver() {
  push();
  noStroke();
  textSize(30);
  fill(103, 6, 20, 0.5);
  rect(width / 2 - 180, height / 2 - 10, 350, 120, 20);
  fill(100);
  text("Game Over", width / 2 - 85, height / 2 + 40);
  text("Press 'q' to top", width / 2 - 115, height / 2 + 85);
  noLoop();
  pop();
}

function mousePressed() {
  if (gameState == 3 || gameState == 4) {
    gameState = 0;
    loop();
  } else if (gameState == 0) {
    if (
      mouseX > width / 2 - 100 &&
      mouseX < width / 2 + 150 &&
      mouseY > height / 2 - 70 &&
      mouseY < height / 2 + 50
    ) {
      gameState = 2;
      start();
    }
  } else if (gameState == 1) {
    gameState = 0;
  }
}

function drawBackground() {
  push();
  image(bg, 0, 0, width, height);
  if (gameState == 0) {
    image(bg, 0, 0, width, height);
  } else if (gameState == 2) {
    image(bg2, 0, 0, width, height);
  }
  fill(0, 0, 0, 0);
  stroke(0, 90, 90);
  strokeWeight(3);
  rect(0, 0, width - 1, height - 1);
  pop();
}

function start() {
  player = new Platform();
  bricks = [];
  rows = 5;
  cols = window.innerWidth / 62.5;
  for (let i = 0; i < rows; i++) {
    let row = [];
    for (let j = 0; j < cols; j++) {
      row.push(new Brick(j * 59 + 5, i * 52 + 3));
    }
    bricks.push(row);
  }
  ball = new Ball();
  backgroundColor = color(44, 0, 98);
  brickCount = 0;
}

function keyPressed() {
  if (gameState > 1 && keyCode == 81) {
    gameState = 0;
    loop();
  }

  if (keyCode == 82) {
    gameState = 2;
    loop();
  }
}
