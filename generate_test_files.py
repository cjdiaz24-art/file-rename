#!/usr/bin/env python3
import os
import shutil
import random

# Target folder
TARGET = "test_sandbox"

# Lists of unsafe characters and random extensions to use
UNSAFE_CHARS = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "[", "]", "{", "}", ";", "'", ",", "`", "~"]
EXTENSIONS = [".txt", ".png", ".jpg", ".json", ".tar.gz", ".md", ".csv", ".zip", ".config", ".xml", ""]

def random_unsafe_name(base, with_spaces=True):
    parts = [base]
    if with_spaces:
        parts.append(" " * random.randint(1, 3))
    parts.append("".join(random.choices(UNSAFE_CHARS, k=random.randint(1, 4))))
    if with_spaces:
        parts.append(" " * random.randint(1, 3))
    random.shuffle(parts)
    return "".join(parts)

def main():
    if os.path.exists(TARGET):
        print(f"Removing existing test directory '{TARGET}'...")
        shutil.rmtree(TARGET)
    
    os.makedirs(TARGET, exist_ok=True)
    print(f"Created main test directory: {TARGET}")

    # Level 1 Directories
    l1_dirs = [
        "dir space",
        "dir!special",
        "clean_dir",
        "another space dir"
    ]

    # Level 2 Directories
    l2_dirs = {
        "dir space": ["nested space", "nested!special"],
        "dir!special": ["deep nested", "sub!folder"],
        "clean_dir": ["clean_sub_dir"],
        "another space dir": ["nested_three_levels"]
    }

    # Level 3 Directories
    l3_dirs = {
        "another space dir/nested_three_levels": ["deepest folder !"]
    }

    # 1. Create L1 directories and populate with files
    for d1 in l1_dirs:
        d1_path = os.path.join(TARGET, d1)
        os.makedirs(d1_path, exist_ok=True)
        print(f"  Created directory: {d1_path}")
        
        # Create files inside L1
        for i in range(3):
            ext = random.choice(EXTENSIONS)
            filename = f"file {i} space {random_unsafe_name('unsafe')}{ext}"
            filepath = os.path.join(d1_path, filename)
            with open(filepath, "w") as f:
                f.write("test content")
        
        # 2. Create L2 directories and populate
        if d1 in l2_dirs:
            for d2 in l2_dirs[d1]:
                d2_path = os.path.join(d1_path, d2)
                os.makedirs(d2_path, exist_ok=True)
                print(f"    Created nested directory: {d2_path}")
                
                # Create files inside L2
                for i in range(2):
                    ext = random.choice(EXTENSIONS)
                    filename = f"nested file {i} {random_unsafe_name('data')}{ext}"
                    filepath = os.path.join(d2_path, filename)
                    with open(filepath, "w") as f:
                        f.write("nested test content")
                
                # Check L3
                rel_l2_path = f"{d1}/{d2}"
                if rel_l2_path in l3_dirs:
                    for d3 in l3_dirs[rel_l2_path]:
                        d3_path = os.path.join(d2_path, d3)
                        os.makedirs(d3_path, exist_ok=True)
                        print(f"      Created deepest directory: {d3_path}")
                        
                        # Create files inside L3
                        ext = random.choice(EXTENSIONS)
                        filename = f"deepest file {random_unsafe_name('deep')}{ext}"
                        filepath = os.path.join(d3_path, filename)
                        with open(filepath, "w") as f:
                            f.write("deepest test content")

    # 3. Create root files with collision scenarios
    print("\nPopulating root level with specific test cases...")
    root_cases = [
        # Spaces
        ("root file space", ".txt"),
        ("root  file  multiple  spaces", ".png"),
        # Unsafe characters
        ("root!@#file", ".json"),
        ("another$%^file", ".tar.gz"),
        # Hidden files
        (".hidden file with spaces", ".config"),
        (".hidden!unsafe", ""),
        # Completely unsafe filenames
        ("!!!", ""),
        ("@@@", ".txt"),
        # Naming collisions (all sanitize to versions of collisionfile or collision_file)
        ("collision file", ".txt"),
        ("collision  file", ".txt"),
        ("collision!file", ".txt"),
        ("collision@file", ".txt")
    ]

    for name, ext in root_cases:
        filepath = os.path.join(TARGET, f"{name}{ext}")
        with open(filepath, "w") as f:
            f.write("root test content")

    print("\nGeneration complete!")
    print(f"You can now run any of your renamers on the '{TARGET}' folder.")

if __name__ == "__main__":
    main()
