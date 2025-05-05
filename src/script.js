// Configuration
const totalFloors = 10;
const floorHeight = 50;
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
      isInService: false,
      currentFloor: 0,
      direction: 'idle',
      traveledDistance: 0,
      completedCalls: 0,
      totalWaitTime: 0
    });
    simulationMatrix()
  }

  // Reset all UI elements to initial state
  resetUIElements();

  // Add event listeners
  addEventListeners();

  // Add event listeners
  addEventListenersToElevator();

  // Reset stats
  stats = { totalCalls: 0, totalTravelTime: 0, completedCalls: 0 };
  updateGlobalStats();

  // Clear log
  const logContainer = document.getElementById('log');
  logContainer.innerHTML = '';
  log('System initialized');
}

function resetUIElements() {
  // Reset elevator positions
  for (let i = 1; i <= totalElevators; i++) {
    const elevator = document.getElementById(`elevator-${i}`);
    elevator.className = 'elevator idle';
    elevator.style.bottom = '5px'; // Position at ground floor
    
    // Reset status indicators
    const status = document.getElementById(`status-${i}`);
    status.className = 'elevator-status status-idle';
    
    document.getElementById(`status-text-${i}`).textContent = 'Idle';
    document.getElementById(`floor-${i}`).textContent = '0';
    document.getElementById(`direction-${i}`).innerHTML = '<span class="direction-indicator">⏺</span>';
    document.getElementById(`calls-${i}`).textContent = '0';
  }
  
  // Reset call buttons
  document.querySelectorAll('.call-btn').forEach(button => {
    button.textContent = 'Call';
    button.classList.remove('waiting', 'arrived');
  });
}

function addEventListeners() {
  document.querySelectorAll('.call-btn').forEach(button => {
    // Remove existing event listeners by cloning and replacing
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Add new event listener
    newButton.addEventListener('click', () => {
      const floor = parseInt(newButton.dataset.floor);
      if (!newButton.classList.contains('waiting')) {
        handleCall(newButton, floor);
      }
    });
  });
}

function addEventListenersToElevator() {
  console.log("elevator div click ....")
  document.querySelectorAll('.elevator').forEach(button => {
    button.addEventListener('click', () => {
      const elevator = elevators[parseInt(button.dataset.elevator) - 1]

      if(!elevator.isInService){
        button.children[1].innerHTML = 'S'+button.dataset.elevator;
        elevator.isInService = true
      }
      else{
        button.children[1].innerHTML = button.dataset.elevator;
        elevator.isInService = false
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
    if (!elevator.busy && !elevator.isInService) {
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
  
  // Animate elevator movement - using bottom property for natural floor ordering
  elevatorEl.style.transition = `bottom ${duration}ms ease-in-out`;
  elevatorEl.style.bottom = `${targetFloor * floorHeight + 5}px`; // +5px for alignment
  
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
      // todo: add elevator service check here to avoid assigning new task

      if (button && !button.classList.contains('waiting')) {
        handleCall(button, floor);
      } else {
        // Create a virtual button if the real one is busy
        const virtualButton = { 
          textContent: '', 
          nodeName: 'VIRTUAL',
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          }
        };
        handleCall(virtualButton, floor);
      }
    }, i * 3000);
  }
}


function resetSystem() {
  callQueue = [];
  log('System reset');
  initializeSystem();
}

function simulationMatrix(){
  console.log("matrix simulation....")
//  setInterval(()=>{
//   simulateRandomCalls(5)
//   // const floor = Math.floor(Math.random() * totalFloors);
//   // setTimeout(() => {
//   //   // Find button for this floor
//   //   const button = document.querySelector(`.call-btn[data-floor="${floor}"]`);
//   //   if (button && !button.classList.contains('waiting')) {
//   //     handleCall(button, floor);
//   //   } else {
//   //     // Create a virtual button if the real one is busy
//   //     const virtualButton = { 
//   //       textContent: '', 
//   //       nodeName: 'VIRTUAL',
//   //       classList: {
//   //         add: () => {},
//   //         remove: () => {},
//   //         contains: () => false
//   //       }
//   //     };
//   //     handleCall(virtualButton, floor);
//   //   }
//   // }, 3000);

//  }, 3000);
      
}

// Initialize the system when the page loads
window.addEventListener('DOMContentLoaded', initializeSystem);
// window.addEventListener('DOMContentLoaded', simulationMatrix);