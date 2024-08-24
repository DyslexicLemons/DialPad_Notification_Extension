import { checkForUpdates } from './content.js';

export async function makeHttpRequest(token) {
    const params = new URLSearchParams({
        limit: '100',
        group_type: 'call_center',
        supervisor_filter: '1',
        group_ids: '5033945194905600,4933647411527680,5315647708413952,5073800947908608,6330105389989888'
    });

    const url = `https://dialpad.com/api/admingroupoperators?${params.toString()}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': token, // Use the captured token
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('HTTP Request Success:', data);

        // Check for specific conditions and log if necessary
        if (data) {
            console.log('Here is JSON:', JSON.stringify(data));
            checkForUpdates(data);
        }
    } catch (error) {
        console.error('HTTP Request Failed:', error);
    }
}
