const modulename = 'Database';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { ExpChain } from 'lodash';
//@ts-ignore: I haven o idea why this errors, but I couldn't solve it
import lodash from 'lodash-es';
import { Low, Adapter } from 'lowdb';
import { TextFile } from 'lowdb/node';
import { txDevEnv, txEnv, txHostConfig } from '@core/globalData';
import {
    DatabaseActionType,
    DatabaseDataType,
    DatabasePlayerType,
    DatabaseWhitelistApprovalsType,
    DatabaseWhitelistRequestsType
} from './databaseTypes.js';
import migrations from './migrations.js';
import consoleFactory from '@lib/console.js';
import fatalError from '@lib/fatalError.js';
import { TimeCounter } from '@modules/Metrics/statsUtils.js';
const console = consoleFactory(modulename);

//Consts & helpers
export const DATABASE_VERSION = 5;
export const defaultDatabase = {
    version: DATABASE_VERSION,
    actions: [],
    players: [],
    whitelistApprovals: [],
    whitelistRequests: [],
};

export enum SavePriority {
    STANDBY,
    LOW,
    MEDIUM,
    HIGH,
}

const SAVE_CONFIG = {
    [SavePriority.STANDBY]: {
        name: 'standby',
        interval: 5 * 60 * 1000,
    },
    [SavePriority.LOW]: {
        name: 'low',
        interval: 60 * 1000,
    },
    [SavePriority.MEDIUM]: {
        name: 'medium',
        interval: 30 * 1000,
    },
    [SavePriority.HIGH]: {
        name: 'high',
        interval: 15 * 1000,
    },
} as Record<SavePriority, { interval: number; name: string }>;


//Reimplementing the adapter to minify json onm prod builds
class JSONFile<T> implements Adapter<T> {
    private readonly adapter: TextFile;
    private readonly serializer: Function;
    public fileSize: number = 0;

    constructor(filename: string) {
        this.adapter = new TextFile(filename);
        this.serializer = (txDevEnv.ENABLED)
            ? (obj: any) => JSON.stringify(obj, null, 4)
            : JSON.stringify;
    }

    async read(): Promise<T | null> {
        const data = await this.adapter.read();
        if (data === null) {
            return null;
        } else {
            return JSON.parse(data) as T;
        }
    }

    write(obj: T): Promise<void> {
        const serialized = this.serializer(obj);
        this.fileSize = serialized.length;
        return this.adapter.write(serialized);
    }
}


// Extend Low class with a new `chain` field
//NOTE: lodash-es doesn't have ExpChain exported, so we need it from the original lodash
class LowWithLodash<T> extends Low<T> {
    chain: ExpChain<this['data']> = lodash.chain(this).get('data')
}
export type DatabaseObjectType = LowWithLodash<DatabaseDataType>;


export function mergeDatabases(current: DatabaseDataType, incoming: DatabaseDataType): DatabaseDataType {
    // 1. Actions: keyed by id
    const actionsMap = new Map<string, DatabaseActionType>();
    for (const a of (current.actions || [])) actionsMap.set(a.id, a);
    for (const a of (incoming.actions || [])) {
        const existing = actionsMap.get(a.id);
        if (!existing) {
            actionsMap.set(a.id, a);
        } else {
            const isIncomingRevoked = Boolean(a.revocation?.timestamp);
            const revocation = (a.revocation?.timestamp && (!existing.revocation?.timestamp || a.revocation.timestamp > existing.revocation.timestamp))
                ? a.revocation
                : existing.revocation;
            const acked = Boolean(existing.acked || a.acked);
            actionsMap.set(a.id, {
                ...(isIncomingRevoked ? a : existing),
                revocation,
                acked,
            });
        }
    }

    // 2. Players: keyed by license
    const playersMap = new Map<string, DatabasePlayerType>();
    for (const p of (current.players || [])) playersMap.set(p.license, p);
    for (const p of (incoming.players || [])) {
        const existing = playersMap.get(p.license);
        if (!existing) {
            playersMap.set(p.license, p);
        } else {
            const newer = (p.tsLastConnection || 0) >= (existing.tsLastConnection || 0) ? p : existing;
            const older = newer === p ? existing : p;
            const ids = Array.from(new Set([...(newer.ids || []), ...(older.ids || [])]));
            const hwids = Array.from(new Set([...(newer.hwids || []), ...(older.hwids || [])]));
            const playTime = Math.max(newer.playTime || 0, older.playTime || 0);
            const notes = (p.notes?.tsLastEdit ?? 0) >= (existing.notes?.tsLastEdit ?? 0) ? p.notes : existing.notes;
            const tsWhitelisted = newer.tsWhitelisted || older.tsWhitelisted;
            playersMap.set(p.license, {
                ...newer,
                ids,
                hwids,
                playTime,
                notes,
                tsWhitelisted,
            });
        }
    }

    // 3. Whitelist Approvals: keyed by identifier
    const wlMap = new Map<string, DatabaseWhitelistApprovalsType>();
    for (const w of (current.whitelistApprovals || [])) wlMap.set(w.identifier, w);
    for (const w of (incoming.whitelistApprovals || [])) {
        const existing = wlMap.get(w.identifier);
        if (!existing || (w.tsApproved || 0) >= (existing.tsApproved || 0)) {
            wlMap.set(w.identifier, w);
        }
    }

    // 4. Whitelist Requests: keyed by id
    const reqMap = new Map<string, DatabaseWhitelistRequestsType>();
    for (const r of (current.whitelistRequests || [])) reqMap.set(r.id, r);
    for (const r of (incoming.whitelistRequests || [])) {
        const existing = reqMap.get(r.id);
        if (!existing || (r.tsLastAttempt || 0) >= (existing.tsLastAttempt || 0)) {
            reqMap.set(r.id, r);
        }
    }

    return {
        version: Math.max(current.version || DATABASE_VERSION, incoming.version || DATABASE_VERSION),
        actions: Array.from(actionsMap.values()),
        players: Array.from(playersMap.values()),
        whitelistApprovals: Array.from(wlMap.values()),
        whitelistRequests: Array.from(reqMap.values()),
    };
}


export class DbInstance {
    readonly dbPath: string;
    readonly backupPath: string;
    obj: DatabaseObjectType | undefined = undefined;
    #writePending: SavePriority = SavePriority.STANDBY;
    lastWrite: number = 0;
    lastDiskMtime: number = 0;
    isReady: boolean = false;

    constructor() {
        this.dbPath = txHostConfig.playersDbPath ?? `${txEnv.profilePath}/data/playersDB.json`;
        this.backupPath = txHostConfig.playersDbPath
            ? `${txHostConfig.playersDbPath}.backup.json`
            : `${txEnv.profilePath}/data/playersDB.backup.json`;

        //Start database instance
        this.setupDatabase();

        //Cron functions
        setInterval(() => {
            this.checkWriteNeeded();
        }, SAVE_CONFIG[SavePriority.HIGH].interval);
        setInterval(() => {
            this.backupDatabase();
        }, SAVE_CONFIG[SavePriority.STANDBY].interval);
    }


    /**
     * Start lowdb instance and set defaults
     */
    async setupDatabase() {
        //Tries to load the database
        let dbo;
        try {
            const adapterAsync = new JSONFile<DatabaseDataType>(this.dbPath);
            dbo = new LowWithLodash(adapterAsync, defaultDatabase);
            await dbo.read();
        } catch (errorMain) {
            const errTitle = 'Your txAdmin player/actions database could not be loaded.';
            try {
                await fsp.copyFile(this.backupPath, this.dbPath);
                const adapterAsync = new JSONFile<DatabaseDataType>(this.dbPath);
                dbo = new LowWithLodash(adapterAsync, defaultDatabase);
                await dbo.read();
                console.warn(errTitle);
                console.warn('The database file was restored with the automatic backup file.');
                console.warn('A five minute rollback is expected.');
            } catch (errorBackup) {
                fatalError.Database(0, [
                    errTitle,
                    'It was also not possible to load the automatic backup file.',
                    ['Main error', (errorMain as Error).message],
                    ['Backup error', (errorBackup as Error).message],
                    ['Database path', this.dbPath],
                    'If there is a file in that location, you may try to delete or restore it manually.',
                ]);
            }
        }

        //Setting up loaded database
        try {
            //Need to write the database, in case it is new
            await dbo.write();

            //Need to chain after setting defaults
            dbo.chain = lodash.chain(dbo.data);

            //If old database
            if (dbo.data.version !== DATABASE_VERSION) {
                await this.backupDatabase(`${txEnv.profilePath}/data/playersDB.backup.v${dbo.data.version}.json`);
                this.obj = await migrations(dbo);
            } else {
                this.obj = dbo;
            }

            //Checking basic structure integrity
            if (
                !Array.isArray(this.obj!.data.actions)
                || !Array.isArray(this.obj!.data.players)
                || !Array.isArray(this.obj!.data.whitelistApprovals)
                || !Array.isArray(this.obj!.data.whitelistRequests)
            ) {
                fatalError.Database(2, [
                    'Your txAdmin player/actions database is corrupted!',
                    'It is missing one of the required arrays (players, actions, whitelistApprovals, whitelistRequests).',
                    'If you modified the database file manually, you may try to restore it from the automatic backup file.',
                    ['Database path', this.dbPath],
                ]);
            }

            this.lastWrite = Date.now();
            this.isReady = true;

            try {
                const stat = await fsp.stat(this.dbPath);
                this.lastDiskMtime = stat.mtimeMs;
            } catch (e) {}

            // Instant file watcher for cross-server syncing
            let watchDebounce: NodeJS.Timeout | null = null;
            try {
                const targetFilename = path.basename(this.dbPath);
                const watcher = fs.watch(path.dirname(this.dbPath), (eventType, filename) => {
                    if (filename && filename !== targetFilename) return;
                    if (watchDebounce) clearTimeout(watchDebounce);
                    watchDebounce = setTimeout(() => {
                        this.reloadAndMergeFromDisk().catch(() => {});
                    }, 800);
                });
                watcher.on('error', (err) => {
                    console.verbose.warn(`playersDB watcher error: ${err.message}`);
                });
            } catch (watchErr) {
                console.verbose.warn(`Could not set up fs.watch on playersDB directory: ${(watchErr as Error).message}`);
            }
        } catch (error) {
            fatalError.Database(1, 'Failed to setup database object.', error);
        }
    }


    /**
     * Reloads database from disk and merges with current in-memory state
     */
    public async reloadAndMergeFromDisk() {
        if (!this.obj) return;
        try {
            const stat = await fsp.stat(this.dbPath);
            if (stat.mtimeMs === this.lastDiskMtime) return;

            const adapterAsync = new JSONFile<DatabaseDataType>(this.dbPath);
            const diskDbo = new LowWithLodash(adapterAsync, defaultDatabase);
            await diskDbo.read();
            if (!diskDbo.data || !Array.isArray(diskDbo.data.players)) return;

            const merged = mergeDatabases(this.obj.data, diskDbo.data);
            this.obj.data = merged;
            this.obj.chain = lodash.chain(this.obj.data);
            this.lastDiskMtime = stat.mtimeMs;
            console.verbose.debug('Reloaded and merged playersDB from disk.');
        } catch (error) {
            console.verbose.warn(`Could not reload playersDB from disk: ${(error as Error).message}`);
        }
    }


    /**
     * Writes the database to the disk if pending.
     */
    public handleShutdown() {
        if (this.#writePending !== SavePriority.STANDBY) {
            this.writeDatabase();
        }
    }


    /**
     * Creates a copy of the database file
     */
    async backupDatabase(targetPath?: string) {
        try {
            await fsp.copyFile(this.dbPath, targetPath ?? this.backupPath);
            // console.verbose.debug('Database file backed up.');
        } catch (error) {
            console.error(`Failed to backup database file '${this.dbPath}'`);
            console.verbose.dir(error);
        }
    }


    /**
     * Set write pending flag
     */
    writeFlag(flag = SavePriority.MEDIUM) {
        if (flag < SavePriority.LOW || flag > SavePriority.HIGH) {
            throw new Error('unknown priority flag!');
        }
        if (flag > this.#writePending) {
            const flagName = SAVE_CONFIG[flag].name;
            console.verbose.debug(`writeFlag > ${flagName}`);
            this.#writePending = flag;
        }
    }


    /**
     * Checks if it's time to write the database to disk, taking in consideration the priority flag
     */
    private async checkWriteNeeded() {
        //Check if the database is ready
        if (!this.obj) return;

        const timeStart = Date.now();
        const sinceLastWrite = timeStart - this.lastWrite;

        if (this.#writePending === SavePriority.HIGH || sinceLastWrite > SAVE_CONFIG[this.#writePending].interval) {
            const writeTime = new TimeCounter();
            await this.writeDatabase();
            const timeElapsed = writeTime.stop();
            this.#writePending = SavePriority.STANDBY;
            this.lastWrite = timeStart;
            // console.verbose.debug(`DB file saved, took ${timeElapsed.milliseconds}ms.`);
            txCore.metrics.txRuntime.databaseSaveTime.count(timeElapsed.milliseconds);
        }
    }


    /**
     * Writes the database to the disk NOW  
     * NOTE: separate function so it can also be called by the shutdown handler
     */
    private async writeDatabase() {
        try {
            // Check if disk file was modified externally before writing
            if (this.lastDiskMtime > 0) {
                try {
                    const stat = await fsp.stat(this.dbPath);
                    if (stat.mtimeMs !== this.lastDiskMtime) {
                        console.verbose.debug('Disk file modified externally, merging before write.');
                        await this.reloadAndMergeFromDisk();
                    }
                } catch (e) {}
            }
            await this.obj?.write();
            try {
                const stat = await fsp.stat(this.dbPath);
                this.lastDiskMtime = stat.mtimeMs;
            } catch (e) {}
        } catch (error) {
            console.error(`Failed to save players database with error: ${(error as Error).message}`);
            console.verbose.dir(error);
        }
    }
}
