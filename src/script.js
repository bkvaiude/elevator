// Configuration
const totalFloors = 10;
const floorHeight = 50; // Match this with CSS
const totalElevators = 5;
const elevatorSpeed = 1000; // ms per floor

// State variables
let elevators = [];
let callQueue = [];
let stats = { 
  totalCalls: 0, 
  totalTravelTime: 0,
  completedCalls: 0
};

// Initialize the system
function initializeSystem() {
  // Initialize elevators
  elevators = [];
  for (let i = 1; i <= totalElevators; i++) {
    elevators.push({
      id: i,
      busy: false,
      currentFloor: 0,
      direction: 'idle',
      traveledDistance: 0,
      completedCalls: 0,
      totalWaitTime: 0
    });
  }

  // Create floors - ensure proper order (Ground Floor at bottom)
  const floorsContainer = document.querySelector('.floors');
  floorsContainer.innerHTML = '';
  for (let i = totalFloors - 1; i >= 0; i--) {
    const floorEl = document.createElement('div');
    floorEl.className = 'floor';
    floorEl.dataset.floor = i;
    floorEl.innerHTML = `
      <span>${i === 0 ? 'Ground Floor' : `Floor ${i}`}</span>
      <button class="call-btn" data-floor="${i}">Call</button>
    `;
    floorsContainer.prepend(floorEl);
  }

  // Create elevator shafts with grid lines
  const shaftsContainer = document.querySelector('.elevator-shafts');
  shaftsContainer.innerHTML = '';
  
  for (let i = 1; i <= totalElevators; i++) {
    const shaft = document.createElement('div');
    shaft.className = 'elevator-shaft';
    shaft.id = `shaft-${i}`;
    
    // Add grid markers for floors in each shaft
    for (let j = 0; j < totalFloors; j++) {
      const marker = document.createElement('div');
      marker.className = 'shaft-floor-marker';
      marker.dataset.floor = totalFloors - j - 1;
      shaft.appendChild(marker);
    }
    
    // Add elevator
    const elevator = document.createElement('div');
    elevator.className = 'elevator idle';
    elevator.id = `elevator-${i}`;
    elevator.textContent = i;
    elevator.style.top = `${(totalFloors - 1) * floorHeight - 5}px`; // Position at ground floor, adjusted for alignment
    
    shaft.appendChild(elevator);
    shaftsContainer.appendChild(shaft);
  }

  // Create elevator status indicators
  const statusContainer = document.getElementById('elevator-status');
  statusContainer.innerHTML = '';
  for (let i = 1; i <= totalElevators; i++) {
    const status = document.createElement('div');
    status.className = 'elevator-status status-idle';
    status.id = `status-${i}`;
    status.innerHTML = `
      <h3>Elevator ${i}</h3>
      <div>Status: <span id="status-text-${i}">Idle</span></div>
      <div>Floor: <span id="floor-${i}" class="floor-indicator">0</span></div>
      <div>Direction: <span id="direction-${i}">
        <span class="direction-indicator">⏺</span>
      </span></div>
      <div>Calls: <span id="calls-${i}">0</span></div>
    `;
    statusContainer.appendChild(status);
  }

  // Reset stats
  stats = { totalCalls: 0, totalTravelTime: 0, completedCalls: 0 };
  updateGlobalStats();

  // Clear log
  const logContainer = document.getElementById('log');
  logContainer.innerHTML = '';
  log('System initialized');

  // Add event listeners
  addEventListeners();
}

function addEventListeners() {
  document.querySelectorAll('.call-btn').forEach(button => {
    button.addEventListener('click', () => {
      const floor = parseInt(button.dataset.floor);
      if (!button.classList.contains('waiting')) {
        handleCall(button, floor);
      }
    });
  });
}

function handleCall(button, floor) {
  log(`Call requested at floor ${floor}`);
  if (button && button.nodeName === 'BUTTON') {
    button.textContent = 'Waiting';
    button.classList.add('waiting');
  }
  callQueue.push({ button, floor, timestamp: Date.now() });
  stats.totalCalls++;
  updateGlobalStats();
  processQueue();
}

function processQueue() {
  if (callQueue.length === 0) return;
  
  // Check each call in the queue
  for (let i = 0; i < callQueue.length; i++) {
    const call = callQueue[i];
    const elevator = findNearestAvailableElevator(call.floor);
    
    if (elevator) {
      // Remove this call from the queue
      callQueue.splice(i, 1);
      
      // Assign the call to the elevator
      moveElevator(elevator, call.floor, call.button, call.timestamp);
      
      // Process the next call in the next tick
      setTimeout(processQueue, 0);
      break;
    }
  }
}

function findNearestAvailableElevator(targetFloor) {
  let closest = null;
  let minDistance = Infinity;
  
  for (let elevator of elevators) {
    if (!elevator.busy) {
      const distance = Math.abs(elevator.currentFloor - targetFloor);
      if (distance < minDistance) {
        minDistance = distance;
        closest = elevator;
      }
    }
  }
  
  return closest;
}

function moveElevator(elevator, targetFloor, button, requestTime) {
  // Update elevator status
  elevator.busy = true;
  const previousFloor = elevator.currentFloor;
  const distance = Math.abs(previousFloor - targetFloor);
  const direction = targetFloor > previousFloor ? 'up' : (targetFloor < previousFloor ? 'down' : 'idle');
  elevator.direction = direction;
  elevator.traveledDistance += distance;
  
  // Update UI
  updateElevatorStatus(elevator.id, 'moving', direction, previousFloor);
  
  // Get DOM elements
  const elevatorEl = document.getElementById(`elevator-${elevator.id}`);
  
  // Remove previous classes and add new ones
  elevatorEl.classList.remove('idle', 'moving-up', 'moving-down', 'arrived');
  elevatorEl.classList.add(direction === 'up' ? 'moving-up' : (direction === 'down' ? 'moving-down' : 'idle'));

  // Calculate animation duration
  const duration = distance * elevatorSpeed;
  
  // Animate elevator movement - adjusted to align precisely with floor grid
  elevatorEl.style.transition = `top ${duration}ms ease-in-out`;
  elevatorEl.style.top = `${(totalFloors - 1 - targetFloor) * floorHeight - 5}px`; // -5px for alignment
  
  log(`Elevator ${elevator.id} moving ${direction} from floor ${previousFloor} to floor ${targetFloor}`);
  
  // Handle arrival
  setTimeout(() => {
    const travelTime = Date.now() - requestTime;
    stats.totalTravelTime += travelTime;
    stats.completedCalls++;
    elevator.completedCalls++;
    elevator.totalWaitTime += travelTime;
    
    updateGlobalStats();
    updateElevatorStats(elevator);
    
    // Update UI for arrival
    elevatorEl.classList.remove('moving-up', 'moving-down');
    elevatorEl.classList.add('arrived');
    
    updateElevatorStatus(elevator.id, 'arrived', 'idle', targetFloor);
    
    if (button && button.nodeName === 'BUTTON') {
      button.textContent = 'Arrived';
      button.classList.remove('waiting');
      button.classList.add('arrived');
    }
    
    log(`Elevator ${elevator.id} arrived at floor ${targetFloor}`);
    playSound();
    
    // Return to idle state after a delay
    setTimeout(() => {
      elevatorEl.classList.remove('arrived');
      elevatorEl.classList.add('idle');
      
      if (button && button.nodeName === 'BUTTON') {
        button.textContent = 'Call';
        button.classList.remove('arrived');
      }
      
      elevator.busy = false;
      elevator.currentFloor = targetFloor;
      elevator.direction = 'idle';
      
      updateElevatorStatus(elevator.id, 'idle', 'idle', targetFloor);
      log(`Elevator ${elevator.id} now idle at floor ${targetFloor}`);
      
      // Process the next call in the queue
      processQueue();
    }, 2000);
  }, duration);
}

function updateElevatorStatus(id, status, direction, floor) {
  // Update status box
  const statusBox = document.getElementById(`status-${id}`);
  const statusText = document.getElementById(`status-text-${id}`);
  const floorText = document.getElementById(`floor-${id}`);
  const directionText = document.getElementById(`direction-${id}`);
  const callsText = document.getElementById(`calls-${id}`);
  
  // Update status class
  statusBox.className = 'elevator-status';
  
  // Apply the correct status color
  if (status === 'idle') statusBox.classList.add('status-idle');
  else if (status === 'moving' && direction === 'up') statusBox.classList.add('status-up');
  else if (status === 'moving' && direction === 'down') statusBox.classList.add('status-down');
  else if (status === 'arrived') statusBox.classList.add('status-arrived');
  
  // Update text content
  statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  floorText.textContent = floor;
  
  // Update direction indicator with the correct Unicode character
  let directionSymbol = '⏺'; // idle (Unicode U+23FB)
  if (direction === 'up') directionSymbol = '⏶'; // up (Unicode U+23F6)
  if (direction === 'down') directionSymbol = '⏷'; // down (Unicode U+23F7)
  
  directionText.innerHTML = `<span class="direction-indicator">${directionSymbol}</span>`;
  
  // Update calls count
  const elevator = elevators.find(e => e.id === parseInt(id));
  if (elevator) {
    callsText.textContent = elevator.completedCalls;
  }
}

function updateElevatorStats(elevator) {
  // Update individual elevator statistics
  const callsText = document.getElementById(`calls-${elevator.id}`);
  callsText.textContent = elevator.completedCalls;
}

function updateGlobalStats() {
  const statsContainer = document.getElementById('global-stats');
  const avgWaitTime = stats.completedCalls > 0 ? (stats.totalTravelTime / stats.completedCalls).toFixed(2) : 0;
  
  statsContainer.innerHTML = `
    <p>Total Calls: ${stats.totalCalls} | Completed: ${stats.completedCalls} | Average Wait Time: ${avgWaitTime} ms</p>
    <p>Queue Length: ${callQueue.length}</p>
  `;
}

function log(message) {
  const logger = document.getElementById('log');
  if (logger) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logger.appendChild(p);
    logger.scrollTop = logger.scrollHeight;
  }
}

function playSound() {
  // Create a simple beep using the Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  } catch (e) {
    console.log('Audio not supported');
  }
}

function simulateRandomCalls(count) {
  for (let i = 0; i < count; i++) {
    const floor = Math.floor(Math.random() * totalFloors);
    setTimeout(() => {
      // Find button for this floor
      const button = document.querySelector(`.call-btn[data-floor="${floor}"]`);
      if (button && !button.classList.contains('waiting')) {
        handleCall(button, floor);
      } else {
        // Create a virtual button if the real one is busy
        const virtualButton = { 
          textContent: '', 
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          }
        };
        handleCall(virtualButton, floor);
      }
    }, i * 500);
  }
}

function resetSystem() {
  callQueue = [];
  log('System reset');
  initializeSystem();
}

// Initialize the system when the page loads
window.addEventListener('DOMContentLoaded', initializeSystem);