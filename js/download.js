import { db } from './storage.js';
import { showToast } from './ui.js';

export const startDownload = async (meta, url) => {
    showToast('Download started...', 'info');
    
    try {
        const response = await fetch(url);
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        let receivedLength = 0;
        let chunks = [];

        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            
            // Basic progress log (can update UI element here)
            // console.log(`Received ${receivedLength} of ${contentLength}`);
        }

        const blob = new Blob(chunks);
        await db.saveDownload(meta, blob);
        showToast(`${meta.title} Downloaded!`, 'success');
    } catch (e) {
        showToast('Download Failed', 'error');
        console.error(e);
    }
};
