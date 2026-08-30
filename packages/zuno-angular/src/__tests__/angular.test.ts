import { getTestBed, TestBed } from "@angular/core/testing";
import {
	BrowserTestingModule,
	platformBrowserTesting,
} from "@angular/platform-browser/testing";
import { beforeAll, describe, expect, it } from "vitest";
import { provideZuno, ZunoService } from "../index";
import "zone.js";
import "zone.js/testing";

describe("ZunoService", () => {
	beforeAll(() => {
		getTestBed().initTestEnvironment(
			BrowserTestingModule,
			platformBrowserTesting(),
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

			const sig = store.asSignal();

			expect(sig()).toBe(10);

			store.set(20);
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
			(a: unknown, b: unknown) =>
				Math.floor(a as number) === Math.floor(b as number),
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
