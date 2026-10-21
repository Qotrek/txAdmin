<p align="center">
    <p align="center">
        <img src="docs/banner.png">
    </p>
    <p align="center">
        In 2019 <b>txAdmin</b> was created, with the objective of making FiveM server management accessible to everyone – no matter their skill level! <br/>
        Today, <b>txAdmin</b> is <i>the</i> <b>full featured</b> web panel & in-game menu to Manage & Monitor your FiveM/RedM Server, in use by over <strong>29.000</strong> servers worldwide at any given time!
    </p>
    <p align="center">
        Join our Discord Server: &nbsp; <a href="https://discord.gg/AFAAXzq"><img src="https://discordapp.com/api/guilds/577993482761928734/widget.png?style=shield"></img></a>
    </p>
    <p align="center">
        <a href="https://zap-hosting.com/txadmin4" target="_blank" rel="noopener">
            <img src="docs/zaphosting.png" alt="zap-hosting"></img>
        </a>
    </p>
</p>

## 🚀 Fork Features: Multi-Server, Discord OAuth2 & Enterprise Enhancements

This fork enhances **txAdmin** with seamless multi-server support, modern Discord OAuth2 authentication, reverse proxy real-IP resolution, and stability improvements for production FiveM / RedM clusters.

### 🌟 What's New in This Fork:

1. **Multi-Server Shared Data Architecture:**
   - **Shared Player Database (`TXHOST_PLAYERS_DB_PATH`)**: Multiple txAdmin instances (e.g. `Main RP` and `CarDev / Testing`) target a unified `playersDB.json`. Bans, warnings, whitelist approvals, and player notes propagate across servers in real-time via live filesystem watchers and intelligent timestamp-based data merging (`mergeDatabases`).
   - **Shared Admin Store (`TXHOST_ADMINS_FILE_PATH`)**: Point multiple servers to a single shared `admins.json`. Adding or updating admins on one panel syncs immediately across all instances without wiping manual or external edits.
   - **Custom Profile Isolation (`TXHOST_PROFILE`)**: Independent configs, ports, and logs under isolated profile folders (`txData/main`, `txData/cardev`).
   - **Persistent LuaCom Token (`TXHOST_LUACOM_TOKEN`)**: Support for fixed intercom tokens across server restarts.

2. **Discord OAuth2 Admin Login:**
   - **One-Click Staff Login**: Dedicated "Login with Discord" button on the web panel.
   - **Automatic Account Mapping**: Matches the administrator's Discord ID stored in `admins.json` (`discord:<ID>` or provider UID).
   - **Web UI Configuration**: Configure `OAuth2 Client ID` and `OAuth2 Client Secret` directly in `txAdmin > Settings > Discord`.
   - **Secure & Robust**: State-based CSRF protection, session expiration, and automatic admin Discord avatar caching.

3. **Reverse Proxy & Cloudflare Real-IP Fix:**
   - Automatic client real IP resolution via `CF-Connecting-IP`, `X-Real-IP`, or `X-Forwarded-For` with full IPv4 & IPv6 support (`net.isIP`).
   - Fixes upstream bug where failed login attempts through Nginx / Cloudflare resulted in banning `127.0.0.1`, locking all users out of the panel.

4. **Reliability & Linux Fixes:**
   - **Neutralized Prerelease Timebomb**: Removed the upstream hardcoded expiration cutoff in `core/boot/checkPreRelease.ts`.
   - **Linux Case-Sensitivity Fixes**: Fixed import case sensitivity issues (`@modules/FxRunner`) preventing builds and runs on Linux servers.
   - **Static Assets Fault-Tolerance**: Prevents fatal `ENOENT` webserver crashes when static asset directories are customized.

📖 **Documentation:**
- **[Multi-Server Architecture & Setup Guide](docs/multi-server.md)**
- **[Discord OAuth2 Configuration Guide](docs/discord-oauth.md)**
- **[Environment Variables Reference](docs/env-config.md)**

## Main Features
- Recipe-based Server Deployer: create a server in under 60 seconds! ([docs/recipe.md](docs/recipe.md))
- Start/Stop/Restart your server instance or resources
- Full-featured in-game admin menu:
    - Player Mode: NoClip, God, SuperJump
    - Teleport:  waypoint, coords and back
    - Vehicle: Spawn, Fix, Delete, Boost
    - Heal: yourself, everyone
    - Send Announcements
    - Reset World Area
    - Show player IDs
    - Player search/sort by distance, ID, name
    - Player interactions: Go To, Bring, Spectate, Freeze
    - Player troll: make drunk, set fire, wild attack
    - Player ban/warn/dm
- Access control:
    - Login via Cfx.re or password
    - Admin permission system ([docs/permissions.md](docs/permissions.md))
    - Action logging
- Discord Integration:
    - Server configurable, persistent, auto-updated status embed
    - Command to whitelist players
    - Command to display player infos
- Monitoring:
    - Auto Restart FXServer on crash or hang
    - Server’s CPU/RAM consumption
    - Live Console (with log file, command history and search)
    - Server threads performance chart with player count
    - Server Activity Log (connections/disconnections, kills, chat, explosions and [custom commands](docs/custom-server-log.md))
- Player Manager:
    - [Warning system](https://www.youtube.com/watch?v=DeE0-5vtZ4E) & Ban system
    - Whitelist system (Discord member, Discord Role, Approved License, Admin-only)
    - Take notes about players
    - Keep track of player's play and session time
    - Self-contained player database (no MySQL required!)
    - Clean/Optimize the database by removing old players, or bans/warns/whitelists
- Real-time playerlist
- Scheduled restarts with warning announcements and custom events ([docs/events.md](docs/events.md))
- Translated into over 30 languages ([docs/translation.md](docs/translation.md))
- FiveM's Server CFG editor & validator
- Responsive web interface with Dark Mode 😎
- And much more...

Also, check our [Feature Graveyard](docs/feature-graveyard.md) for the features that are no longer among us (😔 RIP).

## Running txAdmin
- Since early 2020, **txAdmin is a component of FXServer, so there is no need to downloading or installing anything**.
- To start txAdmin, simply run FXServer **without** any `+exec server.cfg` launch argument, and FXServer will automatically start txAdmin.
- On first boot, a `txData` directory will be created to store txAdmin files, and you will need to open the URL provided in the console to configure your account and server.

  
## Configuration & Integrations
- Most configuration can be done inside the txAdmin settings page, but some configs (such as TCP interface & port) are only available through  Environment Variables, please see [docs/env-config.md](docs/env-config.md).
- You can listen to server events broadcasted by txAdmin to allow for custom behavior in your resources, please see [docs/events.md](docs/events.md).


## Contributing & Development
- All PRs should be based on the develop branch, including translation PRs.
- Before putting effort for any significant PR, make sure to join our discord and talk to us, since the change you want to do might not have been done for a reason or there might be some required context.
- If you want to build it or run from source, please check [docs/development.md](docs/development.md).


## License, Credits and Thanks
- This project is licensed under the [MIT License](https://github.com/tabarra/txAdmin/blob/master/LICENSE);
- ["Kick" button icons](https://www.flaticon.com/free-icon/users-avatar_8188385) made by __SeyfDesigner__ from [www.flaticon.com](https://www.flaticon.com);
- Warning Sounds ([1](https://freesound.org/people/Ultranova105/sounds/136756/)/[2](https://freesound.org/people/Ultranova105/sounds/136754/)) made by __Ultranova105__ are licensed under [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/);
- [Announcement Sound](https://freesound.org/people/IENBA/sounds/545495/) made by __IENBA__ is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
- [Message Sound](https://freesound.org/people/Divinux/sounds/198414/) made by __Divinux__ is licensed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/);
- Especial thanks to everyone that contributed to this project, especially the very fine Discord folks that provide support for others;
