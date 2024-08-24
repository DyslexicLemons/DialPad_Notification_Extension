// Object to track notified consultants
const notifiedConsultants = {};

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed");
    // Clear any stored data if necessary
    chrome.storage.local.clear();
  });
  
  chrome.runtime.onStartup.addListener(() => {
    console.log("Extension Startup");
  });
  
  // Add listener to monitor outgoing requests
chrome.webRequest.onBeforeSendHeaders.addListener(
    handleRequest, // Use the handleRequest function
    { urls: ["*://*.dialpad.com/*"] }, // Adjust as necessary
    ["requestHeaders"]
  );

// Function to handle web requests
function handleRequest(details) {
  console.log('\n\nRequest initiated:');
  console.log('URL:', details.url);
  console.log('Method:', details.method);

  for (let header of details.requestHeaders) {
    console.log(header.name + ': ' + header.value);
    if (header.name.toLowerCase() === 'authorization' && header.value.startsWith('Bearer ')) {
      let token = header.value; // Capture the token
      chrome.storage.local.set({ jwtToken: token });
      console.log('JWT found in request headers!');

      // Notify content scripts that the token is available
      chrome.runtime.sendMessage({ action: "tokenAcquired", token });

      // Stop listening for further requests
      chrome.webRequest.onBeforeSendHeaders.removeListener(handleRequest);

      // Start periodic HTTP requests
      startPeriodicRequests();

      return; // Exit the function
    }
  }
}




// Periodic HTTP requests every 5 seconds
function startPeriodicRequests() {
    setInterval(async () => {
      const token = await getToken();
      if (token) {
        fetchConsultantsData();
      }
    }, 5 * 1000); // 5 seconds in milliseconds
  }

function getToken() {
return new Promise((resolve) => {
    chrome.storage.local.get('jwtToken', (result) => {
    resolve(result.jwtToken);
    });
});
}

// Utility function to convert timestamp to a readable duration
function getDuration(startTime) {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return { hours, minutes, seconds };
}

async function fetchConsultantsData() {
    // Check if there's an active Dialpad tab
    const tabs = await chrome.tabs.query({ url: "https://*.dialpad.com/app/*" });

    // Proceed only if a Dialpad tab is found
    if (tabs.length > 0) {
        const params = new URLSearchParams({
            limit: '100',
            group_type: 'call_center',
            supervisor_filter: '1',
            group_ids: '5033945194905600,4933647411527680,5315647708413952,5073800947908608,6330105389989888'
        });

        const token = await new Promise((resolve) => {
            chrome.storage.local.get(['jwtToken'], (result) => {
                resolve(result.jwtToken);
            });
        });

        const response = await fetch(`https://dialpad.com/api/admingroupoperators?${params.toString()}`, {
            headers: {
                'Authorization': token
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch consultant data');
            return;
        }

        const data = await response.json();
        processConsultantsData(data);
    } else {
        console.log('No active Dialpad tab found.');
    }
}

// Chat and Dispatcher booleans initialized outside the function to maintain status through re-runs of the processes
let hasChatStatus = false;
let hasDispatcherStatus = false;

let notifiedNoChatStatus = false;
let notifiedNoDispatcherStatus = false;

function processConsultantsData(data) {

    hasChatStatus = false;
    hasDispatcherStatus = false;

    data.forEach(consultant => {
        const { display_name, duty_status_reason, on_duty_status, duty_status_started } = consultant;
        const duration = getDuration(duty_status_started);

        let duty = duty_status_reason;
        if (duty_status_reason === null || duty_status_reason === undefined) {
            duty = on_duty_status;
        }

        console.log(`Name: ${display_name}`);
        console.log(`Position: ${duty}`);
        console.log(`Duration at position: ${duration.hours}h ${duration.minutes}m ${duration.seconds}s`);

        const consultantKey = `${display_name}-${duty}`;

        // Check and notify based on specific conditions
        if (duty === "occupied") {
            notifyOnOccupiedStatus(display_name, duration);
        } else if (duty === "At Break" && duration.minutes >= 15) {
            if (!notifiedConsultants[consultantKey]) {
                notifyLongDuration(display_name, duty, duration, "At Break for over 15 minutes", 'hammer.jpg');
                notifiedConsultants[consultantKey] = true;
            }
        } else if (duty === "At Lunch" && duration.hours >= 1) {
            if (!notifiedConsultants[consultantKey]) {
                notifyLongDuration(display_name, duty, duration, "At Lunch for over 1 hour", 'Lunch.jpg');
                notifiedConsultants[consultantKey] = true;
            }
        } else if (duty === "Be Right Back" && duration.minutes >= 7) {
            if (!notifiedConsultants[consultantKey]) {
                notifyLongDuration(display_name, duty, duration, "Be Right Back for over 7 minutes", 'hammer.jpg');
                notifiedConsultants[consultantKey] = true;
            }
        } else {
            // Reset notification status if not in a relevant state
            notifiedConsultants[consultantKey] = false;
        }

        if (duty === "Chat") hasChatStatus = true;
        if (duty === "Dispatcher") hasDispatcherStatus = true;
    });

    // Notify if NO ONE has "Chat" status
    if (!hasChatStatus && !notifiedNoChatStatus) {
        notifyNoStatus("Chat", "Chats.jpg");
        notifiedNoChatStatus = true;
    } else if (hasChatStatus) {
        notifiedNoChatStatus = false;
    }

    // Notify if NO ONE has "Dispatcher" status
    if (!hasDispatcherStatus && !notifiedNoDispatcherStatus) {
        notifyNoStatus("Dispatcher","AntiDispatch.jpg");
        notifiedNoDispatcherStatus = true;
    } else if (hasDispatcherStatus) {
        notifiedNoDispatcherStatus = false;
    }
}

// Function to send a notification for "occupied" status at specific intervals
function notifyOnOccupiedStatus(name, duration) {
    const minutes = duration.hours * 60 + duration.minutes;
    iconURL = 'testAlert.png'

    if (minutes >= 60 && !notifiedConsultants[`${name}-occupied-60`]) {
        notifyLongDuration(name, "occupied", duration, "occupied for over 1 hour", iconURL);
        notifiedConsultants[`${name}-occupied-60`] = true;
    } else if (minutes >= 30 && !notifiedConsultants[`${name}-occupied-30`]) {
        notifyLongDuration(name, "occupied", duration, "occupied for over 30 minutes", iconURL);
        notifiedConsultants[`${name}-occupied-30`] = true;
    } else if (minutes >= 20 && !notifiedConsultants[`${name}-occupied-20`]) {
        notifyLongDuration(name, "occupied", duration, "occupied for over 20 minutes", iconURL);
        notifiedConsultants[`${name}-occupied-20`] = true;
    }
}

// Function to send a notification for a long duration
function notifyLongDuration(name, position, duration, reason, iconURL=icon.png) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: `assets/${iconURL}`, // Create or download an icon.png for your extension
        title: `Consultant ${reason}`,
        message: `${name} has been ${position} for ${duration.hours} hours and ${duration.minutes} minutes.`
    });
}

// Function to send a notification if no one has a specific status
function notifyNoStatus(status,iconURL=icon.png) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: `assets/${iconURL}`, // Create or download an icon.png for your extension
        title: `No Consultant with ${status} Status`,
        message: `There are currently no consultants with the ${status} status.`
    });
}

