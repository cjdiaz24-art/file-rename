// DOM Elements
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnRun = document.getElementById('btn-run');
const toggleDryRun = document.getElementById('toggle-dry-run');
const selectedFolderInfo = document.getElementById('selected-folder-info');
const folderNameSpan = document.getElementById('folder-name');
const secureContextBanner = document.getElementById('secure-context-banner');

const statRenameCount = document.getElementById('stat-rename-count');
const statCollisionCount = document.getElementById('stat-collision-count');
const statUnchangedCount = document.getElementById('stat-unchanged-count');

const progressWrapper = document.getElementById('progress-wrapper');
const progressStatus = document.getElementById('progress-status');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');

const previewTableBody = document.getElementById('preview-table-body');
const consoleOutput = document.getElementById('console-output');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Application State
let rootDirectoryHandle = null;
let scannedItems = []; // Array of { handle, parentHandle, name, isDir, relativePath, depth }
let plannedRenames = []; // Array of analyzed items

// Initial Setup & Checks
if (!window.showDirectoryPicker) {
    secureContextBanner.classList.remove('hidden');
    secureContextBanner.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    secureContextBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    const infoContent = secureContextBanner.querySelector('.info-content');
    infoContent.innerHTML = `
        <strong>Folder Access Blocked:</strong> Direct directory access is not supported in this browser session. This happens if:
        <ul style="margin-left: 1.5rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
            <li><strong>Browser Incompatibility:</strong> Firefox and Safari do not support direct file-system editing. <strong>Please use Chrome, Edge, or Opera.</strong></li>
            <li><strong>Insecure Context:</strong> The page is not loaded via <code>localhost</code> or HTTPS. If accessing over a network, ensure you open <code>http://localhost:8000</code> or <code>http://127.0.0.1:8000</code>.</li>
        </ul>
    `;
    btnSelectFolder.disabled = true;
    logToConsole("Error: Directory access is not supported in this browser or context.", "error");
} else {
    // Check if running in secure context (localhost or HTTPS)
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
        secureContextBanner.classList.remove('hidden');
    } else {
        secureContextBanner.classList.add('hidden');
    }
}

// Tab Switching Logic
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Helper Functions
function logToConsole(message, type = "info") {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    msgDiv.className = `${type}-msg`;
    consoleOutput.appendChild(msgDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function splitBaseExt(name) {
    if (name.startsWith('.')) {
        const temp = name.slice(1);
        if (temp.includes('.')) {
            const idx = temp.lastIndexOf('.');
            const base = '.' + temp.slice(0, idx);
            const ext = temp.slice(idx);
            return [base, ext];
        } else {
            return [name, ''];
        }
    } else {
        if (name.includes('.')) {
            const idx = name.lastIndexOf('.');
            const base = name.slice(0, idx);
            const ext = name.slice(idx);
            return [base, ext];
        } else {
            return [name, ''];
        }
    }
}

function cleanFilename(name, isDir) {
    // 1. Replace spaces/whitespace with underscores
    let cleaned = name.replace(/\s/g, '_');
    // 2. Keep only safe characters: a-zA-Z0-9_.-
    cleaned = cleaned.replace(/[^a-zA-Z0-9_.-]/g, '');
    // 3. Fallback if empty
    if (!cleaned) {
        cleaned = isDir ? "renamed_dir" : "renamed_file";
    }
    return cleaned;
}

// Recursive Directory Scanning
async function scanDirectory(dirHandle, parentPath = "", parentHandle = null, depth = 0) {
    let items = [];
    for await (const entry of dirHandle.values()) {
        const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        const isDir = entry.kind === 'directory';
        
        items.push({
            handle: entry,
            parentHandle: dirHandle,
            name: entry.name,
            isDir: isDir,
            relativePath: relativePath,
            depth: depth
        });

        if (isDir) {
            const subItems = await scanDirectory(entry, relativePath, dirHandle, depth + 1);
            items.push(...subItems);
        }
    }
    return items;
}

// Analyze Rename Plans & Find Collisions
async function analyzeDirectory() {
    logToConsole("Analyzing files and directory structure...");
    plannedRenames = [];
    const plannedDestinations = new Set();
    
    let toRenameCount = 0;
    let collisionCount = 0;
    let unchangedCount = 0;

    // Sort items by depth in descending order (bottom-up traversal)
    // Children must be processed and renamed before their parent directories.
    scannedItems.sort((a, b) => b.depth - a.depth);

    previewTableBody.innerHTML = '';

    for (const item of scannedItems) {
        const cleanName = cleanFilename(item.name, item.isDir);
        let destRelativePath = item.relativePath.substring(0, item.relativePath.lastIndexOf('/') + 1) + cleanName;
        let finalName = cleanName;
        let isCollision = false;

        if (finalName !== item.name) {
            let hasCollision = true;
            let counter = 1;
            const [base, ext] = splitBaseExt(cleanName);
            const parentPath = item.relativePath.includes('/') ? item.relativePath.substring(0, item.relativePath.lastIndexOf('/')) : "";

            while (hasCollision) {
                // Check if it's already planned
                if (plannedDestinations.has(destRelativePath)) {
                    isCollision = true;
                    finalName = `${base}_${counter}${ext}`;
                    destRelativePath = parentPath ? `${parentPath}/${finalName}` : finalName;
                    counter++;
                    continue;
                }

                // Check if it exists on disk (and is not itself)
                let diskExists = false;
                try {
                    await item.parentHandle.getFileHandle(finalName);
                    diskExists = true;
                } catch {
                    try {
                        await item.parentHandle.getDirectoryHandle(finalName);
                        diskExists = true;
                    } catch {
                        diskExists = false;
                    }
                }

                if (diskExists) {
                    isCollision = true;
                    finalName = `${base}_${counter}${ext}`;
                    destRelativePath = parentPath ? `${parentPath}/${finalName}` : finalName;
                    counter++;
                } else {
                    hasCollision = false;
                }
            }
        }

        const needsRename = finalName !== item.name;
        const finalRelativePath = item.relativePath.includes('/') 
            ? item.relativePath.substring(0, item.relativePath.lastIndexOf('/') + 1) + finalName
            : finalName;

        if (needsRename) {
            toRenameCount++;
            if (isCollision) collisionCount++;
            plannedDestinations.add(destRelativePath);
        } else {
            unchangedCount++;
        }

        const status = needsRename 
            ? (isCollision ? 'collision' : 'pending')
            : 'unchanged';

        plannedRenames.push({
            ...item,
            finalName: finalName,
            finalRelativePath: finalRelativePath,
            status: status
        });

        // Add to Preview Table
        const tr = document.createElement('tr');
        tr.id = `row-${item.relativePath.replace(/[^a-zA-Z0-9-]/g, '_')}`;
        
        const tdOld = document.createElement('td');
        tdOld.textContent = item.relativePath;
        
        const tdNew = document.createElement('td');
        tdNew.textContent = needsRename ? finalRelativePath : '-';
        if (needsRename) tdNew.style.color = '#38bdf8';
        
        const tdStatus = document.createElement('td');
        let badgeClass = 'badge-pending';
        let badgeText = 'Pending';
        if (!needsRename) {
            badgeClass = 'badge-unchanged';
            badgeText = 'Unchanged';
        } else if (isCollision) {
            badgeClass = 'badge-collision';
            badgeText = 'Collision Resolved';
        }
        
        tdStatus.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
        
        tr.appendChild(tdOld);
        tr.appendChild(tdNew);
        tr.appendChild(tdStatus);
        previewTableBody.appendChild(tr);
    }

    // Update Stats
    statRenameCount.textContent = toRenameCount;
    statCollisionCount.textContent = collisionCount;
    statUnchangedCount.textContent = unchangedCount;

    if (plannedRenames.length === 0) {
        previewTableBody.innerHTML = `<tr><td colspan="3" class="empty-table">The folder is empty.</td></tr>`;
        btnRun.disabled = true;
    } else {
        btnRun.disabled = false;
    }

    logToConsole(`Analysis complete. Found ${toRenameCount} items to rename, resolved ${collisionCount} collisions.`);
}

// Folder Selection Handler
btnSelectFolder.addEventListener('click', async () => {
    try {
        rootDirectoryHandle = await window.showDirectoryPicker();
        folderNameSpan.textContent = rootDirectoryHandle.name;
        selectedFolderInfo.classList.remove('hidden');
        
        logToConsole(`Opened folder: ${rootDirectoryHandle.name}`);
        
        // Scan folder recursively
        scannedItems = await scanDirectory(rootDirectoryHandle);
        logToConsole(`Scanned folder recursively. Found ${scannedItems.length} total entries.`);
        
        await analyzeDirectory();
    } catch (err) {
        if (err.name !== 'AbortError') {
            logToConsole(`Error selecting folder: ${err.message}`, "error");
            console.error(err);
        } else {
            logToConsole("Folder selection cancelled by user.", "system");
        }
    }
});

// Run Renaming Process
btnRun.addEventListener('click', async () => {
    if (!rootDirectoryHandle || plannedRenames.length === 0) return;

    const dryRun = toggleDryRun.checked;
    
    // Disable inputs during processing
    btnSelectFolder.disabled = true;
    btnRun.disabled = true;
    toggleDryRun.disabled = true;
    
    progressWrapper.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressStatus.textContent = dryRun ? 'Simulating...' : 'Renaming...';

    logToConsole(dryRun ? "Starting Dry-Run Renaming Simulation..." : "Starting Live Renaming Process...", dryRun ? "dry" : "info");

    const renamesToProcess = plannedRenames.filter(item => item.status === 'pending' || item.status === 'collision');
    const totalRenames = renamesToProcess.length;
    let successCount = 0;
    let errorCount = 0;

    if (totalRenames === 0) {
        logToConsole("No renames are needed. Folder is already clean.");
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressStatus.textContent = 'Done';
        
        btnSelectFolder.disabled = false;
        btnRun.disabled = false;
        toggleDryRun.disabled = false;
        return;
    }

    for (let i = 0; i < totalRenames; i++) {
        const item = renamesToProcess[i];
        const rowId = `row-${item.relativePath.replace(/[^a-zA-Z0-9-]/g, '_')}`;
        const row = document.getElementById(rowId);
        
        if (dryRun) {
            logToConsole(`[DRY-RUN] Rename: '${item.relativePath}' -> '${item.finalRelativePath}'`, "dry");
            if (row) {
                const statusTd = row.cells[2];
                statusTd.innerHTML = `<span class="badge badge-pending">Simulation OK</span>`;
            }
            successCount++;
        } else {
            try {
                // Perform the rename/move operation using FileSystemHandle.move
                // Note: Directory handle move is supported in Chrome 111+
                await item.handle.move(item.finalName);
                logToConsole(`[RENAMED] '${item.relativePath}' -> '${item.finalRelativePath}'`, "success");
                
                if (row) {
                    const statusTd = row.cells[2];
                    statusTd.innerHTML = `<span class="badge badge-success">Success</span>`;
                }
                successCount++;
            } catch (err) {
                logToConsole(`[ERROR] Failed to rename '${item.relativePath}' to '${item.finalName}': ${err.message}`, "error");
                console.error(err);
                
                if (row) {
                    const statusTd = row.cells[2];
                    statusTd.innerHTML = `<span class="badge badge-error">Failed</span>`;
                }
                errorCount++;
            }
        }

        // Update progress
        const pct = Math.round(((i + 1) / totalRenames) * 100);
        progressFill.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
    }

    logToConsole("--------------------------------------------------");
    if (dryRun) {
        logToConsole(`Dry-run simulation finished. Successfully simulated ${successCount} renames.`, "success");
    } else {
        logToConsole(`Live renaming process finished. Renamed: ${successCount}, Errors: ${errorCount}.`, successCount > 0 ? "success" : "warn");
        
        // Re-scan folder after renaming to refresh the state and tables
        logToConsole("Re-scanning directory to refresh state...", "system");
        try {
            scannedItems = await scanDirectory(rootDirectoryHandle);
            await analyzeDirectory();
        } catch (err) {
            logToConsole(`Error re-scanning folder: ${err.message}`, "error");
        }
    }

    progressStatus.textContent = 'Complete';
    
    // Enable inputs again
    btnSelectFolder.disabled = false;
    btnRun.disabled = false;
    toggleDryRun.disabled = false;
});
