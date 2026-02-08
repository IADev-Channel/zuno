import { getTestBed, TestBed } from "@angular/core/testing";
import {
	BrowserDynamicTestingModule,
	platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
import { firstValueFrom } from "rxjs";
import { beforeAll, describe, expect, it } from "vitest";
import { provideZuno, ZunoService } from "../index";
import "zone.js";
import "zone.js/testing";

describe("ZunoService", () => {
	beforeAll(() => {
		getTestBed().initTestEnvironment(
			BrowserDynamicTestingModule,
			platformBrowserDynamicTesting(),
		);
	});

	it("should be created via DI", () => {
		TestBed.configureTestingModule({
			providers: [provideZuno({})],
		});
		const service = TestBed.inject(ZunoService);
		expect(service).toBeTruthy();
	});

	it("should provide store state as observable", async () => {
		TestBed.configureTestingModule({
			providers: [provideZuno({})],
		});
		const service = TestBed.inject(ZunoService);
		const store = service.store("obs-test", () => 0);

		// const val1 = await firstValueFrom(store.asObservable());
		// expect(val1).toBe(0);

		// store.set(1);
		// Wait for next emission? or just check value?
		// Observable emits sync because Zuno is sync.
		// But firstValueFrom completes on first value. We need take(1) or just current value.
		// Actually store.asObservable() re-subscribes.

		// Let's modify:
		let lastVal: number | undefined;
		const sub = store.asObservable().subscribe((v) => {
			lastVal = v;
		});

		expect(lastVal).toBe(0);
		store.set(1);
		expect(lastVal).toBe(1);
		sub.unsubscribe();
	});

	it("should provide store state as signal", () => {
		TestBed.configureTestingModule({
			providers: [provideZuno({})],
		});

		TestBed.runInInjectionContext(() => {
			const service = TestBed.inject(ZunoService);
			const store = service.store("sig-test", () => 10);

			// asSignal must be called in injection context because it uses toSignal
			const sig = store.asSignal();

			expect(sig()).toBe(10);

			store.set(20);
			// Signals might need change detection or just work if they are based on observable?
			// toSignal updates when observable emits.
			// Zuno emits sync. Observable emits sync. toSignal updates sync?
			// Yes, with requireSync: false (default), or if initialValue provided.

			expect(sig()).toBe(20);
		});
	});

	it("should respect custom equality in observable", () => {
		TestBed.configureTestingModule({
			providers: [provideZuno({})],
		});
		const service = TestBed.inject(ZunoService);

		// Custom equality: only care about integer part
		const store = service.store(
			"eq-test",
			() => 1.1,
			undefined,
			(a: any, b: any) => Math.floor(a) === Math.floor(b),
		);

		let callCount = 0;
		const sub = store.asObservable().subscribe(() => callCount++);

		expect(callCount).toBe(1); // Initial

		store.set(1.9); // Should NOT trigger (1 === 1)
		expect(callCount).toBe(1);

		store.set(2.1); // Should trigger (2 !== 1)
		expect(callCount).toBe(2);

		sub.unsubscribe();
	});
});
