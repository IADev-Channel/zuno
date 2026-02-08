import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ZunoService } from "@iadev93/zuno-angular";

@Component({
	selector: "app-root",
	standalone: true,
	imports: [CommonModule],
	template: `
    <div style="max-width: 600px; margin: 0 auto;">
        <h1>Zuno Angular Adapter</h1>
        
        <div style="border: 1px solid #ccc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <h2>Counter Demo</h2>
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <button (click)="dec()">-</button>
                <span style="font-size: 1.5rem; font-weight: bold;">{{ count() }}</span>
                <button (click)="inc()">+</button>
            </div>
            
            <p><strong>Signal Value:</strong> {{ count() }}</p>
            <p><strong>Observable Value:</strong> {{ count$ | async }}</p>
        </div>

        <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px;">
            <h3>Diagnostics</h3>
            <pre>Connection: {{ connected ? 'Online' : 'Offline' }}</pre>
            <button (click)="snapshot()">Log Snapshot</button>
        </div>
    </div>
  `,
})
export class AppComponent {
	zuno = inject(ZunoService);
	// Initialize store 'counter' with 0 (must be a factory function)
	store = this.zuno.store("counter", () => 0);

	// Use as Signal
	count = this.store.asSignal();
	// Use as Observable
	count$ = this.store.asObservable();

	connected = true; // Placeholder

	inc() {
		this.store.set((c) => c + 1);
	}

	dec() {
		this.store.set((c) => c - 1);
	}

	snapshot() {
		console.log("Snapshot:", this.zuno.snapshot());
	}
}
