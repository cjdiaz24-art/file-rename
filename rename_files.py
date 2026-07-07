#!/usr/bin/env python3
import os
import sys
import re
import argparse

def split_base_ext(name):
    if name.startswith('.'):
        temp = name[1:]
        if '.' in temp:
            parts = temp.rsplit('.', 1)
            ext = '.' + parts[1]
            base = '.' + parts[0]
        else:
            ext = ''
            base = name
    else:
        if '.' in name:
            parts = name.rsplit('.', 1)
            ext = '.' + parts[1]
            base = parts[0]
        else:
            ext = ''
            base = name
    return base, ext

def clean_filename(name, is_dir):
    # 1. Replace spaces/whitespace with underscores
    cleaned = re.sub(r'\s', '_', name)
    # 2. Keep only safe characters: a-zA-Z0-9_.-
    cleaned = re.sub(r'[^a-zA-Z0-9_.-]', '', cleaned)
    # 3. Fallback if empty
    if not cleaned:
        cleaned = "renamed_dir" if is_dir else "renamed_file"
    return cleaned

def main():
    parser = argparse.ArgumentParser(
        description="Recursively renames files and directories in the target directory."
    )
    parser.add_argument(
        '-f', '--force', action='store_true',
        help="Actually rename the files (default is dry-run)."
    )
    parser.add_argument(
        '-d', '--dry-run', action='store_true', default=True,
        help="Preview changes without applying them (default)."
    )
    parser.add_argument(
        'directory', nargs='?', default='.',
        help="Target directory to scan (default: current directory)."
    )

    args = parser.parse_args()

    # If --force is specified, override dry-run to False
    dry_run = not args.force

    target_dir = args.directory
    if not os.path.isdir(target_dir):
        print(f"Error: Target directory '{target_dir}' does not exist or is not a directory.", file=sys.stderr)
        sys.exit(1)

    target_dir_abs = os.path.abspath(target_dir)

    print(f"Target Directory: {target_dir_abs}")
    if dry_run:
        print("Running in DRY-RUN mode. No files will be modified.")
        print("To apply changes, run with --force or -f.")
    else:
        print("Running in FORCE mode. Files will be renamed.")
    print("--------------------------------------------------")

    planned_destinations = set()
    rename_count = 0
    collision_count = 0
    skip_count = 0

    # Walk the directory structure bottom-up (equivalent to find -depth)
    for root, dirs, files in os.walk(target_dir_abs, topdown=False):
        # Process files first, then directories at each level
        items = [(False, f) for f in files] + [(True, d) for d in dirs]

        for is_dir, name in items:
            item_path = os.path.join(root, name)
            
            # Skip the target directory itself
            if item_path == target_dir_abs:
                continue

            clean_name = clean_filename(name, is_dir)
            dest_path = os.path.join(root, clean_name)

            # Collision resolution
            if dest_path != item_path:
                if os.path.exists(dest_path) or os.path.islink(dest_path) or dest_path in planned_destinations:
                    base, ext = split_base_ext(clean_name)
                    counter = 1
                    candidate_dest = os.path.join(root, f"{base}_{counter}{ext}")
                    while os.path.exists(candidate_dest) or os.path.islink(candidate_dest) or candidate_dest in planned_destinations:
                        counter += 1
                        candidate_dest = os.path.join(root, f"{base}_{counter}{ext}")
                    dest_path = candidate_dest
                    clean_name = f"{base}_{counter}{ext}"
                    collision_count += 1

            # Check if rename is needed
            if dest_path != item_path:
                planned_destinations.add(dest_path)
                relative_old = os.path.relpath(item_path, target_dir_abs)
                relative_new = os.path.relpath(dest_path, target_dir_abs)

                if dry_run:
                    print(f"[DRY-RUN] Rename: '{relative_old}' -> '{relative_new}'")
                else:
                    try:
                        os.rename(item_path, dest_path)
                        print(f"[RENAMED] '{relative_old}' -> '{relative_new}'")
                    except Exception as e:
                        print(f"[ERROR] Failed to rename '{relative_old}' -> '{relative_new}': {e}", file=sys.stderr)
                rename_count += 1
            else:
                skip_count += 1

    print("--------------------------------------------------")
    if dry_run:
        print(f"Dry-run summary: would rename {rename_count} items (resolved {collision_count} collisions, skipped {skip_count} unchanged items).")
    else:
        print(f"Execution summary: successfully renamed {rename_count} items (resolved {collision_count} collisions, skipped {skip_count} unchanged items).")

if __name__ == "__main__":
    main()
