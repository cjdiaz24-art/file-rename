#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -euo pipefail

# Print usage instructions
print_usage() {
    cat << EOF
Usage: $(basename "$0") [options] [directory]

Recursively renames files and directories in the target directory.
Replaces spaces with underscores, removes unsafe characters (keeps a-zA-Z0-9_.-),
and handles name collisions gracefully.

Options:
  -f, --force      Actually rename the files (default is dry-run).
  -d, --dry-run    Preview changes without applying them (default).
  -h, --help       Show this help message.

If no directory is specified, the current directory is used.
EOF
}

# Default settings
DRY_RUN=true
TARGET_DIR="."

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--force)
            DRY_RUN=false
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        -*)
            echo "Error: Unknown option $1" >&2
            print_usage >&2
            exit 1
            ;;
        *)
            TARGET_DIR="$1"
            shift
            ;;
    esac
done

# Resolve absolute path of target directory
if [[ ! -d "$TARGET_DIR" ]]; then
    echo "Error: Target directory '$TARGET_DIR' does not exist or is not a directory." >&2
    exit 1
fi

TARGET_DIR_ABS=$(cd "$TARGET_DIR" && pwd)

echo "Target Directory: $TARGET_DIR_ABS"
if $DRY_RUN; then
    echo "Running in DRY-RUN mode. No files will be modified."
    echo "To apply changes, run with --force or -f."
else
    echo "Running in FORCE mode. Files will be renamed."
fi
echo "--------------------------------------------------"

# Associative array to keep track of destinations to prevent collisions
declare -A planned_destinations

# Count of renamed/skipped items
rename_count=0
collision_count=0
skip_count=0

# Use 'find -depth' to traverse bottom-up so child files are renamed before their parent directories
while IFS= read -r -d '' item; do
    # Skip the target directory itself
    if [[ "$item" == "$TARGET_DIR_ABS" ]]; then
        continue
    fi

    # Get parent directory and current name
    parent=$(dirname "$item")
    original_name=$(basename "$item")

    # Clean the name:
    # 1. Replace spaces/whitespace with underscores
    # 2. Remove characters that are not in the safe set: a-zA-Z0-9_.-
    clean_name=$(printf "%s" "$original_name" | sed -e 's/[[:space:]]/_/g' -e 's/[^a-zA-Z0-9_.-]//g')

    # If the clean name becomes empty (e.g. filename was "!!!"), use a fallback
    if [[ -z "$clean_name" ]]; then
        if [[ -d "$item" ]]; then
            clean_name="renamed_dir"
        else
            clean_name="renamed_file"
        fi
    fi

    dest_path="$parent/$clean_name"

    # Collision resolution
    if [[ "$dest_path" != "$item" ]]; then
        # Check if the destination exists on disk OR has been planned by another rename
        if [[ -e "$dest_path" || -h "$dest_path" || -n "${planned_destinations["$dest_path"]:-}" ]]; then
            # Split clean_name into base and ext for nicer suffixing (e.g. file_1.txt)
            base=""
            ext=""
            if [[ "$clean_name" == .* ]]; then
                # Hidden file
                temp="${clean_name#.}"
                if [[ "$temp" == *.* ]]; then
                    ext=".${temp##*.}"
                    base=".${temp%.*}"
                else
                    ext=""
                    base="$clean_name"
                fi
            else
                if [[ "$clean_name" == *.* ]]; then
                    ext=".${clean_name##*.}"
                    base="${clean_name%.*}"
                else
                    ext=""
                    base="$clean_name"
                fi
            fi

            counter=1
            candidate_dest="$parent/${base}_${counter}${ext}"
            while [[ -e "$candidate_dest" || -h "$candidate_dest" || -n "${planned_destinations["$candidate_dest"]:-}" ]]; do
                ((counter++))
                candidate_dest="$parent/${base}_${counter}${ext}"
            done
            dest_path="$candidate_dest"
            clean_name="${base}_${counter}${ext}"
            collision_count=$((collision_count + 1))
        fi
    fi

    # Check if a rename is actually needed
    if [[ "$dest_path" != "$item" ]]; then
        # Record this destination path to prevent future files from colliding with it
        planned_destinations["$dest_path"]=1

        # Show the rename
        relative_old="${item#$TARGET_DIR_ABS/}"
        relative_new="${dest_path#$TARGET_DIR_ABS/}"
        
        if $DRY_RUN; then
            echo "[DRY-RUN] Rename: '$relative_old' -> '$relative_new'"
        else
            if mv "$item" "$dest_path"; then
                echo "[RENAMED] '$relative_old' -> '$relative_new'"
            else
                echo "[ERROR] Failed to rename '$relative_old' -> '$relative_new'" >&2
            fi
        fi
        rename_count=$((rename_count + 1))
    else
        skip_count=$((skip_count + 1))
    fi

done < <(find "$TARGET_DIR_ABS" -depth -print0)

echo "--------------------------------------------------"
if $DRY_RUN; then
    echo "Dry-run summary: would rename $rename_count items (resolved $collision_count collisions, skipped $skip_count unchanged items)."
else
    echo "Execution summary: successfully renamed $rename_count items (resolved $collision_count collisions, skipped $skip_count unchanged items)."
fi
