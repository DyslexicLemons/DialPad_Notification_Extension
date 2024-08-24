export function checkForUpdates(data) {
    const oneHourInMillis = 60 * 60 * 1000;
    const currentTime = Date.now();

    data.forEach(consultant => {
        const name = consultant.display_name;
        const positions = consultant.group_details;
        const timeInDuty = currentTime - consultant.duty_status_started;

        console.log(`Consultant: ${name}`);
        
        positions.forEach(position => {
            const status = position.status;
            console.log(`Position: ${position.type}, Status: ${status}, Time in Position: ${timeInDuty / 1000} seconds`);

            if (timeInDuty > oneHourInMillis) {
                const message = `${name} has been ${status} for more than 1 hour.`;
                chrome.runtime.sendMessage({ action: 'notify', title: 'Consultant Alert', message });
            }
        });
    });
}
