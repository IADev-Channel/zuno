import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { ZunoStateEvent } from "../sync";
import {
	applyCompareAndSet,
	createEmptyPersistedServerState,
	type ZunoCompareAndSetResult,
	type ZunoPersistedServerState,
	type ZunoServerPersistence,
} from "./persistence";

export type FileZunoServerPersistenceOptions = {
	lockTimeoutMs?: number;
	staleLockMs?: number;
};

/** Durable JSON reference adapter with an atomic rename and cross-process lock. */
export class FileZunoServerPersistence implements ZunoServerPersistence {
	private readonly lockPath: string;
	private readonly lockTimeoutMs: number;
	private readonly staleLockMs: number;

	constructor(
		private readonly filePath: string,
		options: FileZunoServerPersistenceOptions = {},
	) {
		this.lockPath = `${filePath}.lock`;
		this.lockTimeoutMs = options.lockTimeoutMs ?? 5000;
		this.staleLockMs = options.staleLockMs ?? 30000;
		if (!Number.isInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 1) {
			throw new TypeError("lockTimeoutMs must be a positive integer");
		}
		if (!Number.isInteger(this.staleLockMs) || this.staleLockMs < 1) {
			throw new TypeError("staleLockMs must be a positive integer");
		}
		mkdirSync(dirname(filePath), { recursive: true });
	}

	private read(): ZunoPersistedServerState {
		try {
			return JSON.parse(readFileSync(this.filePath, "utf8"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return createEmptyPersistedServerState();
			}
			throw error;
		}
	}

	private write(state: ZunoPersistedServerState): void {
		const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
		try {
			writeFileSync(temporaryPath, JSON.stringify(state), "utf8");
			renameSync(temporaryPath, this.filePath);
		} finally {
			rmSync(temporaryPath, { force: true });
		}
	}

	private withLock<T>(operation: () => T): T {
		const startedAt = Date.now();
		while (true) {
			try {
				mkdirSync(this.lockPath);
				break;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				try {
					if (
						Date.now() - statSync(this.lockPath).mtimeMs >=
						this.staleLockMs
					) {
						rmSync(this.lockPath, { recursive: true, force: true });
						continue;
					}
				} catch (lockError) {
					if ((lockError as NodeJS.ErrnoException).code === "ENOENT") continue;
					throw lockError;
				}
				if (Date.now() - startedAt >= this.lockTimeoutMs) {
					throw new Error(`Timed out acquiring Zuno lock: ${this.lockPath}`);
				}
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
			}
		}
		try {
			return operation();
		} finally {
			rmSync(this.lockPath, { recursive: true, force: true });
		}
	}

	load(): ZunoPersistedServerState {
		return structuredClone(this.read());
	}

	save(state: ZunoPersistedServerState): void {
		this.withLock(() => this.write(structuredClone(state)));
	}

	compareAndSet(
		event: ZunoStateEvent,
		maxEvents: number,
	): ZunoCompareAndSetResult {
		return this.withLock(() => {
			const state = this.read();
			const result = applyCompareAndSet(state, event, maxEvents);
			if (result.ok) this.write(state);
			return result;
		});
	}
}

export const createFileZunoServerPersistence = (
	filePath: string,
	options?: FileZunoServerPersistenceOptions,
) => new FileZunoServerPersistence(filePath, options);
