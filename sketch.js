let state = "choose";
let voiceType = null;
let bgImg;

let mic, fft;
let isListening = false;
let isFrozen = false;

let waveScroll = 0;
let waveSpeed = 1;

let stopBtn, backBtn, addBtn, singBtn;
let overlayAlpha = 150;

let lineYPositions = [];
let allColors = ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"];
let vibgyorColors = [
  "#FF0000", "#FFA500", "#FFFF00",
  "#00FF00", "#0000FF", "#4B0082", "#8F00FF"
];

let wavelengthMap = [];
let activeLineIndex = null;

let recordedNotes = [];
let uniqueNotes = [];
let selectedNotes = [];
let noteButtons = [];

let currentOsc;
let noteFrequencies = [260, 292, 320, 349, 392, 440, 493]; // Sa to Ni

function preload() {
  bgImg = loadImage('https://www.shutterstock.com/image-vector/abstract-music-notes-wavy-background-600nw-2478080513.jpg');
}

function setup() {
  createCanvas(1000, 1000);
  textAlign(CENTER, CENTER);
  textFont('Georgia');
  noStroke();

  createChoiceButtons();

  mic = new p5.AudioIn();
  fft = new p5.FFT(0.1, 2048);

  let topMargin = 200;
  let bottomMargin = height - 150;
  for (let i = 0; i < allColors.length; i++) {
    let y = map(i, 0, allColors.length - 1, topMargin, bottomMargin);
    lineYPositions.push(y);
  }

  for (let i = 0; i < allColors.length; i++) {
    let wl = map(i, 0, allColors.length - 1, 300, 80);
    wavelengthMap.push(wl);
  }
}

function draw() {
  if (state === "choose") {
    drawChoiceScreen();
  } else if (state === "listen") {
    drawListeningScreen();
  } else if (state === "result") {
    drawResultScreen();
  }
}

function drawChoiceScreen() {
  if (bgImg) image(bgImg, 0, 0, width, height);
  else background(0);

  fill(0, 0, 0, overlayAlpha);
  rect(0, 0, width, height);

  fill(255);
  textSize(48);
  textStyle(BOLD);
  text("🎵 Choose Your Voice Type!", width / 2, 150);

  if (voiceType) {
    textSize(32);
    fill('#ffff66');
    text(`You chose: ${voiceType}`, width / 2, 700);
  }
}

function drawListeningScreen() {
  background(0, 40);
  drawBlackGrid();
  drawWhiteGuideLines();

  if (isListening && !isFrozen) {
    let freqData = fft.analyze();
    let maxIndex = freqData.indexOf(max(freqData));
    let nyquist = sampleRate() / 2;
    let currentFreq = maxIndex * nyquist / freqData.length;

    activeLineIndex = mapFrequencyToLine(currentFreq);

    if (activeLineIndex !== null) {
      drawSmoothWaveOnLine(activeLineIndex);
      recordedNotes.push(activeLineIndex);
    }
  }

  if (isFrozen) {
    for (let idx of uniqueNotes) {
      drawSmoothWaveOnLine(idx);
    }
    for (let idx of selectedNotes) {
      drawSmoothWaveOnLine(idx);
    }
  }
}

function drawResultScreen() {
  background(0, 40);
  drawBlackGrid();
  drawWhiteGuideLines();

  fill(255);
  textSize(34);
  text("🎶 Resultant Combined Wave 🎶", 600, 95);

  // Always remove old button and create new one each frame
  if (singBtn) singBtn.remove();
  singBtn = createButton("🎤 Sing");
  singBtn.position(720, 20);

  styleButton(singBtn, '#ff9800', '#ffc107');
  singBtn.mousePressed(playComputerSinging);

  // Show selected note waves
  for (let idx of selectedNotes) {
    drawSmoothWaveOnLine(idx);
  }

  // Show combined wave
  if (selectedNotes.length > 0) {
    drawCombinedResultantWave(selectedNotes);
  }

  // Highlight the currently playing note if any
  if (activeLineIndex !== null && activeLineIndex < lineYPositions.length) {
    drawSmoothWaveOnLine(activeLineIndex);
  }
}

function drawWhiteGuideLines() {
  stroke(255, 180);
  strokeWeight(2);
  for (let y of lineYPositions) {
    line(0, y, width, y);
  }
}

function drawSmoothWaveOnLine(index) {
  let yPos = lineYPositions[index];
  let col = vibgyorColors[index];
  let wavelength = wavelengthMap[index];
  let amplitude = 50;

  stroke(col);
  strokeWeight(4);
  noFill();

  beginShape();
  for (let x = 0; x < width; x += 5) {
    let angle = (x + waveScroll) / wavelength * TWO_PI;
    let y = yPos + sin(angle) * amplitude;
    curveVertex(x, y);
  }
  endShape();

  waveScroll += waveSpeed;

  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = col;
  drawingContext.shadowBlur = 0;
}

function drawCombinedResultantWave(indices) {
  if (indices.length === 0) return;

  let amplitude = 50;
  let combinedY = new Array(width).fill(0);

  for (let idx of indices) {
    let wavelength = wavelengthMap[idx];
    for (let x = 0; x < width; x += 5) {
      let angle = (x + waveScroll) / wavelength * TWO_PI;
      combinedY[x] += sin(angle) * amplitude;
    }
  }

  for (let x = 0; x < width; x += 5) {
    combinedY[x] /= indices.length;
  }

  let avgR = 0, avgG = 0, avgB = 0;
  for (let idx of indices) {
    let c = color(vibgyorColors[idx]);
    avgR += red(c);
    avgG += green(c);
    avgB += blue(c);
  }
  avgR /= indices.length;
  avgG /= indices.length;
  avgB /= indices.length;
  let mixedColor = color(avgR, avgG, avgB);

  stroke(mixedColor);
  strokeWeight(5);
  noFill();

  beginShape();
  for (let x = 0; x < width; x += 5) {
    let yAvg = height / 2 + combinedY[x];
    curveVertex(x, yAvg);
  }
  endShape();

  waveScroll += waveSpeed;

  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = mixedColor;
  drawingContext.shadowBlur = 0;
}

function mapFrequencyToLine(freq) {
  let minFreq = 100;
  let maxFreq = 520;
  if (freq < minFreq || freq > maxFreq) return null;

  let bandWidth = (maxFreq - minFreq) / allColors.length;
  for (let i = 0; i < allColors.length; i++) {
    let bandStart = minFreq + i * bandWidth;
    let bandEnd = bandStart + bandWidth;
    if (freq >= bandStart && freq < bandEnd) {
      return i;
    }
  }
  return null;
}

function createChoiceButtons() {
  let yBase = 300;
  let spacing = 90;

  let kidBtn = createButton("👶 Kid");
  kidBtn.position(width / 2 - 75, yBase);
  styleButton(kidBtn, '#4caf50', '#81c784');
  kidBtn.mousePressed(() => selectVoice("Child"));

  let gentBtn = createButton("👨 Gent");
  gentBtn.position(width / 2 - 75, yBase + spacing + 10);
  styleButton(gentBtn, '#2196f3', '#64b5f6');
  gentBtn.mousePressed(() => selectVoice("Male"));

  let ladyBtn = createButton("👩 Lady");
  ladyBtn.position(width / 2 - 75, yBase + 2 * spacing + 12);
  styleButton(ladyBtn, '#e91e63', '#f06292');
  ladyBtn.mousePressed(() => selectVoice("Female"));
}

function selectVoice(type) {
  voiceType = type;
  removeElements();

  recordedNotes = [];
  uniqueNotes = [];
  selectedNotes = [];

  state = "listen";

  userStartAudio();
  mic.start(() => {
    fft.setInput(mic);
    isListening = true;
    isFrozen = false;
    recordedNotes = [];
    uniqueNotes = [];
    selectedNotes = [];
    removeNoteButtons();
  });

  stopBtn = createButton("⏸ Freeze");
  stopBtn.position(370, 20);
  styleButton(stopBtn, '#f44336', '#e57373');
  stopBtn.mousePressed(stopMic);

  backBtn = createButton("🔙 Back");
  backBtn.position(540, 20);
  styleButton(backBtn, '#9e9e9e', '#cfcfcf');
  backBtn.mousePressed(goBack);
}

function stopMic() {
  isListening = false;
  isFrozen = true;
  mic.stop();

  uniqueNotes = [...new Set(recordedNotes)].sort((a, b) => a - b);
  showNoteButtons();
}

function showNoteButtons() {
  let noteNames = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];
  let xPos = 50;
  noteButtons = [];
  for (let i = 0; i < 7; i++) {
    let btn = createButton(noteNames[i]);
    btn.position(xPos, lineYPositions[i] - 45);
    styleButton(btn, vibgyorColors[i], vibgyorColors[i]);

    if (uniqueNotes.includes(i)) {
      btn.mousePressed(() => toggleNote(i, btn));
      btn.style('opacity', '1');
    } else {
      btn.attribute('disabled', '');
      btn.style('opacity', '0.3');
    }
    noteButtons.push(btn);
  }

  addBtn = createButton("📝 Result");
  addBtn.position(710, 20);
  styleButton(addBtn, '#00bcd4', '#4dd0e1');
  addBtn.mousePressed(() => {
    removeNoteButtons();
    state = "result";
  });
}

function toggleNote(idx, btn) {
  if (selectedNotes.includes(idx)) {
    selectedNotes = selectedNotes.filter(i => i !== idx);
    btn.style('opacity', '0.5');
  } else {
    selectedNotes.push(idx);
    btn.style('opacity', '1');
  }
}

function removeNoteButtons() {
  for (let b of noteButtons) {
    b.remove();
  }
  noteButtons = [];
  if (addBtn) addBtn.remove();
  if (singBtn) singBtn.remove();
}

function goBack() {
  isListening = false;
  isFrozen = false;
  mic.stop();
  removeElements();
  removeNoteButtons();
  recordedNotes = [];
  selectedNotes = [];
  uniqueNotes = [];
  activeLineIndex = null;
  state = "choose";
  createChoiceButtons();
}

function drawBlackGrid() {
  stroke('#00cccc');
  strokeWeight(0.5);
  for (let x = 0; x < width; x += 50) line(x, 0, x, height);
  for (let y = 0; y < height; y += 50) line(0, y, width, y);
}

function styleButton(btn, color1, color2) {
  btn.style('width', '120px');
  btn.style('height', '40px');
  btn.style('font-size', '20px');
  btn.style('border', 'none');
  btn.style('border-radius', '10px');
  btn.style('color', 'white');
  btn.style('cursor', 'pointer');
  btn.style('background', `linear-gradient(45deg, ${color1}, ${color2})`);
  btn.style('box-shadow', `0 4px 10px 0 ${color2}`);
  btn.mouseOver(() => btn.style('filter', 'brightness(1.2)'));
  btn.mouseOut(() => btn.style('filter', 'brightness(1)'));
}

function playComputerSinging() {
  if (currentOsc) currentOsc.stop();
  if (selectedNotes.length === 0) return;

  let sequence = selectedNotes.map(idx => noteFrequencies[idx]);
  let avgFreq = sequence.reduce((a, b) => a + b, 0) / sequence.length;
  sequence.push(avgFreq);
  playSequence(sequence, 0);
}

function playSequence(freqList, i) {
  if (i >= freqList.length) {
    activeLineIndex = null;
    return;
  }

  let freq = freqList[i];
  if (i < selectedNotes.length) {
    activeLineIndex = selectedNotes[i];
  } else {
    activeLineIndex = null;
  }

  currentOsc = new p5.Oscillator('sine');
  currentOsc.freq(freq);
  currentOsc.amp(0.3);
  currentOsc.start();

  setTimeout(() => {
    currentOsc.stop();
    activeLineIndex = null;
    playSequence(freqList, i + 1);
  }, 1000);
}
