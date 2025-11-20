import { db } from './storage.js';
import { showToast } from './ui.js';

export const startDownload = async (meta, url) => {
    showToast('Preparing download...', 'info');

    try {
        // Try making a request
        const response = await fetch(url, { 
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) {
            showToast('Server rejected download', 'error');
            return;
        }

        // Some servers DO NOT return Content-Length
        const total = Number(response.headers.get('Content-Length')) || 0;

        const reader = response.body?.getReader();
        if (!reader) {
            showToast('Streaming not supported for this file.', 'error');
            return;
        }

        let received = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            received += value.length;

            // Update progress if total size is known
            if (total > 0) {
                const percent = Math.round((received / total) * 100);
                console.log(`Download Progress: ${percent}%`);
            }
        }

        // Combine chunks into a Blob
        const blob = new Blob(chunks, { type: 'video/mp4' });

        // Save to IndexedDB
        await db.saveDownload(meta, blob);

        showToast(`${meta.title} downloaded!`, 'success');

    } catch (err) {
        console.error(err);
        showToast('Download failed.', 'error');
    }
};
