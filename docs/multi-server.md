# Multi-Server & Shared Data Architecture

This fork of **txAdmin** allows multiple FiveM / RedM server instances (e.g. `Main / RP` and `CarDev / Test`) running on the same host or cluster to share the same administrative data, banlists, warnlists, and player database without conflicts or overwriting each other.

---

## Key Features

1. **Shared Player Database (`TXHOST_PLAYERS_DB_PATH`)**
   - Both servers point to a single global `playersDB.json`.
   - Automatic cross-process synchronization: bans, warnings, whitelist approvals, and player notes applied on Server 1 immediately propagate to Server 2 via real-time filesystem watchers.
   - Non-destructive conflict-free merging (`mergeDatabases`): if both servers write player updates simultaneously, records are intelligently merged using timestamps instead of overwriting.

2. **Shared Admin Accounts (`TXHOST_ADMINS_FILE_PATH`)**
   - Both servers share a single global `admins.json`.
   - Editing permissions or adding admins in either txAdmin panel instantly reloads the permissions across all running instances without wiping external modifications.

3. **Persistent LuaCom Token (`TXHOST_LUACOM_TOKEN`)**
   - Allows fixed intercom communication between FXServer and txAdmin, making it easy to route events across multiple instances.

4. **Independent Server Profiles & Ports**
   - Each server runs its own txAdmin web panel on separate ports (e.g. `40120` for Main, `40121` for CarDev).
   - Each server keeps its own dedicated `config.json`, logs, and performance metrics in isolated profile folders under `txData/<profile>`.

---

## Directory Structure Example

```
/home/betterlife/
├── _artifacts/                        <-- Shared FXServer artifacts (txAdmin monitor)
├── txData/                            <-- Shared txAdmin root folder
│   ├── admins.json                    <-- SHARED: admin permissions & credentials
│   ├── playersDB.json                 <-- SHARED: bans, warns, whitelist, player notes
│   ├── main/
│   │   └── config.json                <-- Isolated config for Main server (port 40120)
│   └── cardev/
│       └── config.json                <-- Isolated config for CarDev server (port 40121)
├── betterlife_server/                 <-- Main server resources & server.cfg (port 30120)
├── betterlife_server_cardev/          <-- CarDev resources & server.cfg (port 30122)
├── run.sh                             <-- Main server startup script
└── run_car.sh                         <-- CarDev server startup script
```

---

## Startup Script Examples

### 1. Main Server (`run.sh`)
```bash
#!/bin/bash
cd /home/betterlife/betterlife_server || exit 1

SCRIPTPATH="/home/betterlife/_artifacts"

# txAdmin Network & Profile configuration
export TXHOST_TXA_PORT=40120
export TXHOST_DATA_PATH="/home/betterlife/txData"
export TXHOST_PROFILE="main"

# Shared database & admin paths
export TXHOST_ADMINS_FILE_PATH="/home/betterlife/txData/admins.json"
export TXHOST_PLAYERS_DB_PATH="/home/betterlife/txData/playersDB.json"

exec $SCRIPTPATH/alpine/opt/cfx-server/ld-musl-x86_64.so.1 \
    --library-path "$SCRIPTPATH/alpine/usr/lib/v8/:$SCRIPTPATH/alpine/lib/:$SCRIPTPATH/alpine/usr/lib/" -- \
    $SCRIPTPATH/alpine/opt/cfx-server/FXServer +set citizen_dir $SCRIPTPATH/alpine/opt/cfx-server/citizen/ $*
```

### 2. Secondary / CarDev Server (`run_car.sh`)
```bash
#!/bin/bash
cd /home/betterlife/betterlife_server_cardev || exit 1

SCRIPTPATH="/home/betterlife/_artifacts"

# txAdmin Network & Profile configuration (different txAdmin port & profile)
export TXHOST_TXA_PORT=40121
export TXHOST_DATA_PATH="/home/betterlife/txData"
export TXHOST_PROFILE="cardev"

# Shared database & admin paths (points to the SAME files as Main)
export TXHOST_ADMINS_FILE_PATH="/home/betterlife/txData/admins.json"
export TXHOST_PLAYERS_DB_PATH="/home/betterlife/txData/playersDB.json"

exec $SCRIPTPATH/alpine/opt/cfx-server/ld-musl-x86_64.so.1 \
    --library-path "$SCRIPTPATH/alpine/usr/lib/v8/:$SCRIPTPATH/alpine/lib/:$SCRIPTPATH/alpine/usr/lib/" -- \
    $SCRIPTPATH/alpine/opt/cfx-server/FXServer +set citizen_dir $SCRIPTPATH/alpine/opt/cfx-server/citizen/ $*
```

---

## Environment Variables Reference

| Variable | Description | Default |
| :--- | :--- | :--- |
| `TXHOST_ADMINS_FILE_PATH` | Absolute path to the shared `admins.json` file. | `<txData>/admins.json` |
| `TXHOST_PLAYERS_DB_PATH` | Absolute path to the shared `playersDB.json` file. | `<txData>/<profile>/data/playersDB.json` |
| `TXHOST_LUACOM_TOKEN` | Optional fixed token (16-64 chars) for monitor intercom. | Random nanoid per boot |
| `TXHOST_DATA_PATH` | Base directory containing shared files and profile subfolders. | Standard txData |
| `TXHOST_PROFILE` | Profile subfolder name (e.g. `main`, `cardev`). | `default` |
| `TXHOST_TXA_PORT` | HTTP port for the txAdmin web panel. | `40120` |
