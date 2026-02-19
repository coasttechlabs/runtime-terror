import { getAuth } from "firebase/auth";

async function sendScoreToDjango(score) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
        // 1. Get the fresh token (forceRefresh = true ensures it's valid)
        const token = await user.getIdToken(true);

        // 2. Send it to your Django Server
        const response = await fetch('https://your-django-server.com/api/update-score/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 3. This is the key part:
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ score: score })
        });

        const data = await response.json();
        console.log("Server response:", data);
    } else {
        console.log("User not logged in!");
    }
}
