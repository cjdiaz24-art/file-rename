#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

function printUsage() {
    console.log(`Usage: node rename_files.js [options] [directory]

Recursively renames files and directories in the target directory.
Replaces spaces with underscores, removes unsafe characters (keeps a-zA-Z0-9_.-),
and handles name collisions gracefully.

Options:
  -f, --force      Actually rename the files (default is dry-run).
  -d, --dry-run    Preview changes without applying them (default).
  -h, --help       Show this help message.

If no directory is specified, the current directory is used.`);
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

async function scanDirectory(dirPath, depth = 0) {
    let items = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const itemPath = path.join(dirPath, entry.name);
        const isDir = entry.isDirectory();
        
        items.push({
            path: itemPath,
            name: entry.name,
            isDir: isDir,
            depth: depth
        });
        
        if (isDir) {
            const subItems = await scanDirectory(itemPath, depth + 1);
            items.push(...subItems);
        }
    }
    return items;
}

async function checkExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    let dryRun = true;
    let targetDir = '.';

    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-f' || arg === '--force') {
            dryRun = false;
        } else if (arg === '-d' || arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '-h' || arg === '--help') {
            printUsage();
            process.exit(0);
        } else if (arg.startsWith('-')) {
            console.error(`Error: Unknown option ${arg}\n`);
            printUsage();
            process.exit(1);
        } else {
            targetDir = arg;
        }
    }

    let targetDirAbs;
    try {
        const stat = await fs.stat(targetDir);
        if (!stat.isDirectory()) {
            console.error(`Error: Target path '${targetDir}' is not a directory.`);
            process.exit(1);
        }
        targetDirAbs = path.resolve(targetDir);
    } catch (err) {
        console.error(`Error: Target directory '${targetDir}' does not exist or is not accessible.`);
        process.exit(1);
    }

    console.log(`Target Directory: ${targetDirAbs}`);
    if (dryRun) {
        console.log("Running in DRY-RUN mode. No files will be modified.");
        console.log("To apply changes, run with --force or -f.");
    } else {
        console.log("Running in FORCE mode. Files will be renamed.");
    }
    console.log("--------------------------------------------------");

    const plannedDestinations = new Set();
    let renameCount = 0;
    let collisionCount = 0;
    let skipCount = 0;

    let scannedItems = [];
    try {
        scannedItems = await scanDirectory(targetDirAbs);
    } catch (err) {
        console.error(`Error scanning directory: ${err.message}`);
        process.exit(1);
    }

    // Sort items by depth in descending order (bottom-up traversal)
    scannedItems.sort((a, b) => b.depth - a.depth);

    for (const item of scannedItems) {
        const parent = path.dirname(item.path);
        const cleanName = cleanFilename(item.name, item.isDir);
        let destPath = path.join(parent, cleanName);

        // Collision resolution
        if (destPath !== item.path) {
            const existsOnDisk = await checkExists(destPath);
            if (existsOnDisk || plannedDestinations.has(destPath)) {
                const [base, ext] = splitBaseExt(cleanName);
                let counter = 1;
                let candidateDest = path.join(parent, `${base}_${counter}${ext}`);
                while (await checkExists(candidateDest) || plannedDestinations.has(candidateDest)) {
                    counter++;
                    candidateDest = path.join(parent, `${base}_${counter}${ext}`);
                }
                destPath = candidateDest;
                collisionCount++;
            }
        }

        // Check if rename is needed
        if (destPath !== item.path) {
            plannedDestinations.add(destPath);
            const relativeOld = path.relative(targetDirAbs, item.path);
            const relativeNew = path.relative(targetDirAbs, destPath);

            if (dryRun) {
                console.log(`[DRY-RUN] Rename: '${relativeOld}' -> '${relativeNew}'`);
            } else {
                try {
                    await fs.rename(item.path, destPath);
                    console.log(`[RENAMED] '${relativeOld}' -> '${relativeNew}'`);
                } catch (err) {
                    console.error(`[ERROR] Failed to rename '${relativeOld}' -> '${relativeNew}': ${err.message}`);
                }
            }
            renameCount++;
        } else {
            skipCount++;
        }
    }

    console.log("--------------------------------------------------");
    if (dryRun) {
        console.log(`Dry-run summary: would rename ${renameCount} items (resolved ${collisionCount} collisions, skipped ${skipCount} unchanged items).`);
    } else {
        console.log(`Execution summary: successfully renamed ${renameCount} items (resolved ${collisionCount} collisions, skipped ${skipCount} unchanged items).`);
    }
}

main().catch(err => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
});
