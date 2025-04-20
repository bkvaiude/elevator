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
      currentFloor: 0,
      direction: 'idle',
      traveledDistance: 0,
      completedCalls: 0,
      totalWaitTime: 0,
      internalCalls: [], // Array to track destinations selected from inside
      processingCall: false // Flag to track if elevator is currently handling a call
    });
  }

  // Reset all UI elements to initial state
  resetUIElements();

  // Add event listeners
  addEventListeners();

  // Setup modal and keypad functionality
  setupElevatorInterior();

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
    document.getElementById(`destinations-${i}`).textContent = 'None';
  }
  
  // Reset call buttons
  document.querySelectorAll('.call-btn').forEach(button => {
    button.textContent = 'Call';
    button.classList.remove('waiting', 'arrived');
  });
}

function addEventListeners() {
  // Add event listeners for call buttons
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

  // Add event listeners for elevators (to open the interior panel)
  document.querySelectorAll('.elevator').forEach(elevator => {
    // Remove existing event listeners by cloning and replacing
    const newElevator = elevator.cloneNode(true);
    elevator.parentNode.replaceChild(newElevator, elevator);
    
    // Add new event listener
    newElevator.addEventListener('click', () => {
      const elevatorId = parseInt(newElevator.dataset.elevatorId);
      openElevatorInterior(elevatorId);
    });
  });
}

function setupElevatorInterior() {
  // Set up the modal
  const modal = document.getElementById('elevator-modal');
  const closeBtn = document.querySelector('.close-modal');
  
  // Close modal when clicking the close button
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Close modal when clicking outside of it
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Generate keypad buttons dynamically
  const keypadGrid = document.querySelector('.keypad-grid');
  keypadGrid.innerHTML = ''; // Clear existing buttons
  
  // Create buttons for all floors (in reverse order)
  for (let floor = totalFloors - 1; floor >= 0; floor--) {
    // Skip when we've already created 9 buttons or reached floor 0
    if ((totalFloors - 1 - floor) >= 9 && floor > 0) continue;
    
    const button = document.createElement('button');
    button.className = 'keypad-btn';
    button.dataset.floor = floor;
    button.textContent = floor === 0 ? 'G' : floor;
    
    button.addEventListener('click', function() {
      const elevatorId = parseInt(document.getElementById('modal-elevator-id').textContent);
      const targetFloor = parseInt(this.dataset.floor);
      handleInternalRequest(elevatorId, targetFloor);
    });
    
    keypadGrid.appendChild(button);
  }
  
  // Add a dedicated ground floor button at the bottom if not already added
  if (totalFloors > 9) {
    const groundButton = document.createElement('button');
    groundButton.className = 'keypad-btn';
    groundButton.dataset.floor = 0;
    groundButton.textContent = 'G';
    
    groundButton.addEventListener('click', function() {
      const elevatorId = parseInt(document.getElementById('modal-elevator-id').textContent);
      handleInternalRequest(elevatorId, 0);
    });
    
    keypadGrid.appendChild(groundButton);
  }
}

function openElevatorInterior(elevatorId) {
  const elevator = elevators[elevatorId - 1];
  const modal = document.getElementById('elevator-modal');
  
  // Set elevator ID in modal
  document.getElementById('modal-elevator-id').textContent = elevatorId;
  
  // Set current floor
  document.getElementById('modal-current-floor').textContent = elevator.currentFloor;
  
  // Update destinations display
  updateModalDestinations(elevatorId);
  
  // Update keypad buttons to show current floor and destinations
  document.querySelectorAll('.keypad-btn').forEach(button => {
    const btnFloor = parseInt(button.dataset.floor);
    
    // Reset button state
    button.className = 'keypad-btn';
    
    // Mark current floor
    if (btnFloor === elevator.currentFloor) {
      button.classList.add('current');
    }
    
    // Mark selected destinations
    if (elevator.internalCalls.includes(btnFloor)) {
      button.classList.add('selected');
    }
  });
  
  // Show the modal
  modal.style.display = 'block';
}

function updateModalDestinations(elevatorId) {
  const elevator = elevators[elevatorId - 1];
  const destinationsElement = document.getElementById('modal-destinations');
  
  if (elevator.internalCalls.length === 0) {
    destinationsElement.textContent = 'None';
  } else {
    destinationsElement.textContent = elevator.internalCalls
      .sort((a, b) => {
        // Sort based on direction of travel and current floor
        if (elevator.direction === 'up') {
          // Put floors above current floor first in ascending order
          if (a >= elevator.currentFloor && b >= elevator.currentFloor) return a - b;
          if (a >= elevator.currentFloor) return -1;
          if (b >= elevator.currentFloor) return 1;
          // Then floors below in descending order
          return b - a;
        } else if (elevator.direction === 'down') {
          // Put floors below current floor first in descending order
          if (a <= elevator.currentFloor && b <= elevator.currentFloor) return b - a;
          if (a <= elevator.currentFloor) return -1;
          if (b <= elevator.currentFloor) return 1;
          // Then floors above in ascending order
          return a - b;
        } else {
          // If idle, sort by proximity to current floor
          return Math.abs(a - elevator.currentFloor) - Math.abs(b - elevator.currentFloor);
        }
      })
      .map(floor => floor === 0 ? 'G' : floor)
      .join(', ');
  }
  
  // Also update the main UI destinations display
  document.getElementById(`destinations-${elevatorId}`).textContent = 
    elevator.internalCalls.length > 0 ? elevator.internalCalls.join(', ') : 'None';
}

function DhandleInternalRequest(elevatorId, targetFloor) {
  const elevator = elevators[elevatorId - 1];
  
  // If already at target floor, do nothing
  if (elevator.currentFloor === targetFloor) {
    log(`Elevator ${elevatorId} is already at floor ${targetFloor}`);
    return;
  }
  
  // If this floor is already in the internal calls, don't add it again
  if (elevator.internalCalls.includes(targetFloor)) {
    log(`Floor ${targetFloor} already in destination list for elevator ${elevatorId}`);
    return;
  }
  
  // Add to internal calls
  elevator.internalCalls.push(targetFloor);
  log(`Internal request: Elevator ${elevatorId} to floor ${targetFloor}`);
  
  // Update the modal and main UI
  updateModalDestinations(elevatorId);
  
  // If elevator is idle, process the internal call immediately
  if (!elevator.busy) {
    processInternalCalls(elevator);
  }
  
  // Update keypad button styles
  const button = document.querySelector(`.keypad-btn[data-floor="${targetFloor}"]`);
  if (button) {
    button.classList.add('selected');
  }
}

function DprocessInternalCalls(elevator) {
  if (elevator.internalCalls.length === 0) return;
  
  // Determine which call to process next based on current direction
  let nextFloor;
  
  if (elevator.direction === 'up' || elevator.direction === 'idle') {
    // Find the nearest floor above current position
    const floorsAbove = elevator.internalCalls.filter(f => f > elevator.currentFloor);
    if (floorsAbove.length > 0) {
      nextFloor = Math.min(...floorsAbove);
      elevator.direction = 'up';
    } else {
      // No floors above, go to the highest floor below
      const floorsBelow = elevator.internalCalls.filter(f => f < elevator.currentFloor);
      if (floorsBelow.length > 0) {
        nextFloor = Math.max(...floorsBelow);
        elevator.direction = 'down';
      }
    }
  } else if (elevator.direction === 'down') {
    // Find the nearest floor below current position
    const floorsBelow = elevator.internalCalls.filter(f => f < elevator.currentFloor);
    if (floorsBelow.length > 0) {
      nextFloor = Math.max(...floorsBelow);
    } else {
      // No floors below, go to the lowest floor above
      const floorsAbove = elevator.internalCalls.filter(f => f > elevator.currentFloor);
      if (floorsAbove.length > 0) {
        nextFloor = Math.min(...floorsAbove);
        elevator.direction = 'up';
      }
    }
  }
  
  if (nextFloor !== undefined) {
    moveElevatorInternal(elevator, nextFloor);
  }
}

function DmoveElevatorInternal(elevator, targetFloor) {
  // Set elevator as busy
  elevator.busy = true;
  elevator.processingCall = true;
  
  const previousFloor = elevator.currentFloor;
  const distance = Math.abs(previousFloor - targetFloor);
  const direction = targetFloor > previousFloor ? 'up' : 'down';
  elevator.direction = direction;
  elevator.traveledDistance += distance;
  
  // Update UI
  updateElevatorStatus(elevator.id, 'moving', direction, previousFloor);
  
  // Get DOM elements
  const elevatorEl = document.getElementById(`elevator-${elevator.id}`);
  
  // Remove previous classes and add new ones
  elevatorEl.classList.remove('idle', 'moving-up', 'moving-down', 'arrived');
  elevatorEl.classList.add(direction === 'up' ? 'moving-up' : 'moving-down');
  
  // Calculate animation duration
  const duration = distance * elevatorSpeed;
  
  // Animate elevator movement
  elevatorEl.style.transition = `bottom ${duration}ms ease-in-out`;
  elevatorEl.style.bottom = `${targetFloor * floorHeight + 5}px`; // +5px for alignment
  
  log(`Elevator ${elevator.id} moving ${direction} from floor ${previousFloor} to floor ${targetFloor} (internal)`);
  
  // Handle arrival
  setTimeout(() => {
    elevator.completedCalls++;
    
    updateGlobalStats();
    updateElevatorStats(elevator);
    
    // Remove this floor from internal calls
    const index = elevator.internalCalls.indexOf(targetFloor);
    if (index !== -1) {
      elevator.internalCalls.splice(index, 1);
    }
    
    // Update UI for arrival
    elevatorEl.classList.remove('moving-up', 'moving-down');
    elevatorEl.classList.add('arrived');
    
    updateElevatorStatus(elevator.id, 'arrived', 'idle', targetFloor);
    updateModalDestinations(elevator.id);
    
    log(`Elevator ${elevator.id} arrived at floor ${targetFloor} (internal)`);
    playSound();
    
    // Update current floor in elevator data
    elevator.currentFloor = targetFloor;
    
    // Return to idle state after a delay if no more calls
    setTimeout(() => {
      elevatorEl.classList.remove('arrived');
      
      // Check if there are more internal calls to process
      if (elevator.internalCalls.length > 0) {
        elevatorEl.classList.add(elevator.direction === 'up' ? 'moving-up' : 'moving-down');
        processInternalCalls(elevator);
      } else {
        elevatorEl.classList.add('idle');
        elevator.direction = 'idle';
        elevator.busy = false;
        elevator.processingCall = false;
        
        updateElevatorStatus(elevator.id, 'idle', 'idle', targetFloor);
        log(`Elevator ${elevator.id} now idle at floor ${targetFloor}`);
        
        // Process any pending external calls
        processQueue();
      }
      
      // Update the modal if it's open
      if (document.getElementById('elevator-modal').style.display === 'block') {
        document.getElementById('modal-current-floor').textContent = targetFloor;
        
        // Update keypad buttons
        document.querySelectorAll('.keypad-btn').forEach(button => {
          const btnFloor = parseInt(button.dataset.floor);
          
          // Reset button state
          button.className = 'keypad-btn';
          
          // Mark current floor
          if (btnFloor === targetFloor) {
            button.classList.add('current');
          }
          
          // Mark selected destinations
          if (elevator.internalCalls.includes(btnFloor)) {
            button.classList.add('selected');
          }
        });
      }
    }, 2000);
  }, duration);
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
  
  // For each call, try to find a suitable elevator
  for (let i = 0; i < callQueue.length; i++) {
    const call = callQueue[i];
    
    // Try to find an elevator that can efficiently service this call
    const elevator = findEfficientElevator(call.floor);
    
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

function DfindEfficientElevator(targetFloor) {
  // First priority: Idle elevators
  const idleElevators = elevators.filter(e => !e.busy);
  if (idleElevators.length > 0) {
    // Find the nearest idle elevator
    let nearest = idleElevators[0];
    let minDistance = Math.abs(nearest.currentFloor - targetFloor);
    
    for (let i = 1; i < idleElevators.length; i++) {
      const distance = Math.abs(idleElevators[i].currentFloor - targetFloor);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = idleElevators[i];
      }
    }
    
    return nearest;
  }
  
  // Second priority: Elevators already moving that can efficiently service this floor
  const movingElevators = elevators.filter(e => !e.processingCall && e.busy);
  for (let elevator of movingElevators) {
    // If moving up and target is above current floor
    if (elevator.direction === 'up' && targetFloor > elevator.currentFloor) {
      return elevator;
    }
    
    // If moving down and target is below current floor
    if (elevator.direction === 'down' && targetFloor < elevator.currentFloor) {
      return elevator;
    }
  }
  
  // No suitable elevator found
  return null;
}

function moveElevator(elevator, targetFloor, button, requestTime) {
  // Update elevator status
  elevator.busy = true;
  elevator.processingCall = true;
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
    
    // Update the elevator's current floor
    elevator.currentFloor = targetFloor;
    
    // Return to idle state after a delay
    setTimeout(() => {
      elevatorEl.classList.remove('arrived');
      
      // Check if there are internal calls to process
      if (elevator.internalCalls.length > 0) {
        elevator.processingCall = false; // External call is complete
        processInternalCalls(elevator);
      } else {
        elevatorEl.classList.add('idle');
        elevator.busy = false;
        elevator.processingCall = false;
        elevator.direction = 'idle';
        
        if (button && button.nodeName === 'BUTTON') {
          button.textContent = 'Call';
          button.classList.remove('arrived');
        }
        
        updateElevatorStatus(elevator.id, 'idle', 'idle', targetFloor);
        log(`Elevator ${elevator.id} now idle at floor ${targetFloor}`);
        
        // Process the next call in the queue
        processQueue();
      }
      
      // Update the modal if it's open for this elevator
      if (document.getElementById('elevator-modal').style.display === 'block' && 
          parseInt(document.getElementById('modal-elevator-id').textContent) === elevator.id) {
        document.getElementById('modal-current-floor').textContent = targetFloor;
        
        // Update keypad buttons
        document.querySelectorAll('.keypad-btn').forEach(button => {
          const btnFloor = parseInt(button.dataset.floor);
          
          // Reset button state
          button.className = 'keypad-btn';
          
          // Mark current floor
          if (btnFloor === targetFloor) {
            button.classList.add('current');
          }
          
          // Mark selected destinations
          if (elevator.internalCalls.includes(btnFloor)) {
            button.classList.add('selected');
          }
        });
      }
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
    }, i * 500);
  }
}

function simulateInternalRequests(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      // Pick a random elevator and floor
      const elevatorId = Math.floor(Math.random() * totalElevators) + 1;
      const elevator = elevators[elevatorId - 1];
      
      // Don't select current floor
      let targetFloor;
      do {
        targetFloor = Math.floor(Math.random() * totalFloors);
      } while (targetFloor === elevator.currentFloor);
      
      handleInternalRequest(elevatorId, targetFloor);
    }, i * 500);
  }
}

function simulateComplexScenario() {
  // First simulate some external calls
  simulateRandomCalls(5);
  
  // Then after a delay, simulate internal requests
  setTimeout(() => {
    simulateInternalRequests(5);
  }, 3000);
  
  // Then after another delay, simulate more external calls
  setTimeout(() => {
    simulateRandomCalls(3);
  }, 6000);
}

function resetSystem() {
  callQueue = [];
  log('System reset');
  initializeSystem();
}


// Modified processInternalCalls function to efficiently sort destinations
function processInternalCalls(elevator) {
    if (elevator.internalCalls.length === 0) return;
    
    // Sort destinations based on direction of travel for efficiency
    let sortedCalls = [...elevator.internalCalls].sort((a, b) => {
      if (elevator.direction === 'up') {
        // When going up, first handle all destinations above current floor in ascending order
        if (a >= elevator.currentFloor && b >= elevator.currentFloor) return a - b;
        if (a >= elevator.currentFloor) return -1;
        if (b >= elevator.currentFloor) return 1;
        // Then handle destinations below in descending order
        return b - a;
      } else if (elevator.direction === 'down') {
        // When going down, first handle all destinations below current floor in descending order
        if (a <= elevator.currentFloor && b <= elevator.currentFloor) return b - a;
        if (a <= elevator.currentFloor) return -1;
        if (b <= elevator.currentFloor) return 1;
        // Then handle destinations above in ascending order
        return a - b;
      } else {
        // If idle, sort by proximity to current floor
        return Math.abs(a - elevator.currentFloor) - Math.abs(b - elevator.currentFloor);
      }
    });
    
    // Select next floor
    let nextFloor = sortedCalls[0];
    
    // Set direction based on next floor
    if (nextFloor > elevator.currentFloor) {
      elevator.direction = 'up';
    } else if (nextFloor < elevator.currentFloor) {
      elevator.direction = 'down';
    }
    
    // Move to next floor
    moveElevatorInternal(elevator, nextFloor);
  }
  
  // Modified moveElevatorInternal to check for stops along the way
  function moveElevatorInternal(elevator, targetFloor) {
    // Set elevator as busy
    elevator.busy = true;
    elevator.processingCall = true;
    
    const previousFloor = elevator.currentFloor;
    const distance = Math.abs(previousFloor - targetFloor);
    const direction = targetFloor > previousFloor ? 'up' : 'down';
    elevator.direction = direction;
    elevator.traveledDistance += distance;
    
    // Update UI
    updateElevatorStatus(elevator.id, 'moving', direction, previousFloor);
    
    // Get DOM elements
    const elevatorEl = document.getElementById(`elevator-${elevator.id}`);
    
    // Remove previous classes and add new ones
    elevatorEl.classList.remove('idle', 'moving-up', 'moving-down', 'arrived');
    elevatorEl.classList.add(direction === 'up' ? 'moving-up' : 'moving-down');
    
    // Calculate animation duration
    const duration = distance * elevatorSpeed;
    
    // Animate elevator movement
    elevatorEl.style.transition = `bottom ${duration}ms ease-in-out`;
    elevatorEl.style.bottom = `${targetFloor * floorHeight + 5}px`; // +5px for alignment
    
    log(`Elevator ${elevator.id} moving ${direction} from floor ${previousFloor} to floor ${targetFloor} (internal)`);
    
    // Handle arrival
    setTimeout(() => {
      elevator.completedCalls++;
      
      updateGlobalStats();
      updateElevatorStats(elevator);
      
      // Remove this floor from internal calls
      const index = elevator.internalCalls.indexOf(targetFloor);
      if (index !== -1) {
        elevator.internalCalls.splice(index, 1);
      }
      
      // Update UI for arrival
      elevatorEl.classList.remove('moving-up', 'moving-down');
      elevatorEl.classList.add('arrived');
      
      updateElevatorStatus(elevator.id, 'arrived', 'idle', targetFloor);
      updateModalDestinations(elevator.id);
      
      log(`Elevator ${elevator.id} arrived at floor ${targetFloor} (internal)`);
      playSound();
      
      // Update current floor in elevator data
      elevator.currentFloor = targetFloor;
      
      // Return to idle state after a delay if no more calls
      setTimeout(() => {
        elevatorEl.classList.remove('arrived');
        
        // Check if there are more internal calls to process
        if (elevator.internalCalls.length > 0) {
          elevatorEl.classList.add(elevator.direction === 'up' ? 'moving-up' : 'moving-down');
          processInternalCalls(elevator);
        } else {
          elevatorEl.classList.add('idle');
          elevator.direction = 'idle';
          elevator.busy = false;
          elevator.processingCall = false;
          
          updateElevatorStatus(elevator.id, 'idle', 'idle', targetFloor);
          log(`Elevator ${elevator.id} now idle at floor ${targetFloor}`);
          
          // Process any pending external calls
          processQueue();
        }
        
        // Update the modal if it's open
        if (document.getElementById('elevator-modal').style.display === 'block') {
          document.getElementById('modal-current-floor').textContent = targetFloor;
          
          // Update keypad buttons
          document.querySelectorAll('.keypad-btn').forEach(button => {
            const btnFloor = parseInt(button.dataset.floor);
            
            // Reset button state
            button.className = 'keypad-btn';
            
            // Mark current floor
            if (btnFloor === targetFloor) {
              button.classList.add('current');
            }
            
            // Mark selected destinations
            if (elevator.internalCalls.includes(btnFloor)) {
              button.classList.add('selected');
            }
          });
        }
      }, 2000);
    }, duration);
  }
  
  // Enhanced handleInternalRequest to support intermediate stops
  function handleInternalRequest(elevatorId, targetFloor) {
    const elevator = elevators[elevatorId - 1];
    
    // If already at target floor, do nothing
    if (elevator.currentFloor === targetFloor) {
      log(`Elevator ${elevatorId} is already at floor ${targetFloor}`);
      return;
    }
    
    // If this floor is already in the internal calls, don't add it again
    if (elevator.internalCalls.includes(targetFloor)) {
      log(`Floor ${targetFloor} already in destination list for elevator ${elevatorId}`);
      return;
    }
    
    // Add to internal calls
    elevator.internalCalls.push(targetFloor);
    log(`Internal request: Elevator ${elevatorId} to floor ${targetFloor}`);
    
    // Update the modal and main UI
    updateModalDestinations(elevatorId);
    
    // If elevator is idle, process the internal call immediately
    if (!elevator.busy) {
      processInternalCalls(elevator);
    } else {
      // If elevator is moving, we might need to recalculate its path
      // This is where advanced logic for stopping along the way would go
      // However, we'll handle this with sorted calls in processInternalCalls
    }
    
    // Update keypad button styles
    const button = document.querySelector(`.keypad-btn[data-floor="${targetFloor}"]`);
    if (button) {
      button.classList.add('selected');
    }
  }
  
  // Updated findEfficientElevator to better handle external calls
  function findEfficientElevator(targetFloor) {
    // First check: Is there an elevator currently at this floor?
    const elevatorsAtFloor = elevators.filter(e => e.currentFloor === targetFloor);
    if (elevatorsAtFloor.length > 0) {
      // Prefer idle elevators at the floor
      const idleAtFloor = elevatorsAtFloor.find(e => !e.busy);
      if (idleAtFloor) return idleAtFloor;
      
      // Otherwise take any elevator at the floor
      return elevatorsAtFloor[0];
    }
    
    // Second check: Is any elevator moving toward this floor already?
    const movingElevators = elevators.filter(e => e.busy);
    for (let elevator of movingElevators) {
      if (elevator.direction === 'up' && targetFloor > elevator.currentFloor && 
          targetFloor <= elevator.internalCalls.find(f => f > elevator.currentFloor)) {
        return elevator;
      }
      if (elevator.direction === 'down' && targetFloor < elevator.currentFloor && 
          targetFloor >= elevator.internalCalls.find(f => f < elevator.currentFloor)) {
        return elevator;
      }
    }
    
    // Third check: Find an idle elevator
    const idleElevators = elevators.filter(e => !e.busy);
    if (idleElevators.length > 0) {
      // Find the nearest idle elevator
      let nearest = idleElevators[0];
      let minDistance = Math.abs(nearest.currentFloor - targetFloor);
      
      for (let i = 1; i < idleElevators.length; i++) {
        const distance = Math.abs(idleElevators[i].currentFloor - targetFloor);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = idleElevators[i];
        }
      }
      
      return nearest;
    }
    
    // Fourth check: Find any elevator that can service this call efficiently
    for (let elevator of movingElevators) {
      if (elevator.direction === 'up' && targetFloor > elevator.currentFloor) {
        return elevator;
      }
      if (elevator.direction === 'down' && targetFloor < elevator.currentFloor) {
        return elevator;
      }
    }
    
    // No suitable elevator found
    return null;
  }
  
  // Add support for intermediate stops during elevator movement
  // This would require restructuring moveElevator to check for intermediate stops
  // The basic concept would be to break a long journey into segments and check
  // for new stop requests after each segment completes

// Initialize the system when the page loads
window.addEventListener('DOMContentLoaded', initializeSystem);