# Multi-Language Recursive File Renamer

A set of robust, recursive file renaming utilities implemented across four runtimes: **Bash**, **Python**, **Node.js**, and a **JavaScript Browser App**.

All implementations follow the same logical rules:
1. **Sanitization**: Replaces space characters with underscores (`_`) and strips all unsafe characters (preserving only `a-zA-Z0-9_.-`).
2. **Bottom-Up Traversal**: Deepest files are processed first, ensuring directory structure integrity when parent folders are renamed.
3. **Collision Prevention**: If a sanitized target path already exists, the utility automatically splits the extension and appends an incrementing counter (e.g., `filename_1.txt`).
4. **Safety First (Dry-Run)**: **All CLI and Web utilities default to a Dry-Run/Preview mode**, allowing you to preview how filenames will be modified before making changes on disk.

---

## 🚀 Usage & Dry-Run Guides

### 1. Bash Script (`rename_files.sh`)

* **Dry-Run Preview (Default)**:
  ```bash
  ./rename_files.sh /path/to/target/folder
  ```
* **Apply Changes (Force)**:
  ```bash
  ./rename_files.sh --force /path/to/target/folder
  ```

---

### 2. Python Script (`rename_files.py`)

* **Dry-Run Preview (Default)**:
  ```bash
  python3 rename_files.py /path/to/target/folder
  ```
* **Apply Changes (Force)**:
  ```bash
  python3 rename_files.py --force /path/to/target/folder
  ```

---

### 3. Node.js CLI Script (`rename_files.js`)

* **Dry-Run Preview (Default)**:
  ```bash
  node rename_files.js /path/to/target/folder
  ```
* **Apply Changes (Force)**:
  ```bash
  node rename_files.js --force /path/to/target/folder
  ```

---

### 4. JavaScript Web Application (`index.html`)

* **Preparation**: The browser's File System Access API requires a **Secure Context** (such as `localhost` or HTTPS). Serve the application locally:
  ```bash
  python3 -m http.server 8000
  ```
* **Accessing the App**: Open your Chromium-based browser (Chrome, Edge, Opera) and navigate to [http://localhost:8000](http://localhost:8000).
* **Dry-Run Preview (Default)**:
  1. Click **Select Target Folder** and grant read/write permissions.
  2. Keep the **Dry-Run Mode (Preview only)** switch toggled **ON**.
  3. Click **Apply Renaming**. The script will log a simulated preview of all operations in the interactive console.
* **Apply Changes**:
  1. Toggle the **Dry-Run Mode (Preview only)** switch **OFF**.
  2. Click **Apply Renaming**. The local folder's files and subfolders will be renamed in-place.
