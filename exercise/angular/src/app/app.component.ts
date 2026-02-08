import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ZunoService } from "@iadev93/zuno-angular";

type Todo = {
	id: string;
	title: string;
	done: boolean;
	createdAt: number;
};

@Component({
	selector: "app-root",
	standalone: true,
	imports: [CommonModule, FormsModule],
	template: `
    <div class="container">
      <h1>Zuno Angular</h1>
      
      <div class="counter-section">
        <button (click)="dec()">-</button>
        <span class="count-display">{{ count() }}</span>
        <button (click)="inc()">+</button>
      </div>

      <div class="todo-form">
        <input 
          type="text" 
          [(ngModel)]="newTodoTitle" 
          (keyup.enter)="addTodo()"
          placeholder="What needs to be done?"
        >
        <button (click)="addTodo()">Add</button>
      </div>

      <ul>
        @for (todo of sortedTodos(); track todo.id) {
          <li class="todo-item" [class.done]="todo.done" (click)="toggle(todo.id)">
            <span class="todo-title">{{ todo.title }}</span>
            <button class="delete-btn" (click)="remove(todo.id, $event)">✕</button>
          </li>
        }
      </ul>
    </div>
  `,
})
export class AppComponent {
	zuno = inject(ZunoService);

	// --- Counter ---
	counterStore = this.zuno.store("counter", () => 0);
	count = this.counterStore.asSignal();

	inc() {
		this.counterStore.set((c) => c + 1);
	}
	dec() {
		this.counterStore.set((c) => c - 1);
	}

	// --- Todos ---
	todoStore = this.zuno.store<Todo[]>("todos", () => []);
	todos = this.todoStore.asSignal();

	newTodoTitle = "";

	// Computed signal for sorting
	get sortedTodos() {
		return () => [...this.todos()].sort((a, b) => b.createdAt - a.createdAt);
	}

	addTodo() {
		if (!this.newTodoTitle.trim()) return;

		const newTodo: Todo = {
			id: crypto.randomUUID(),
			title: this.newTodoTitle.trim(),
			done: false,
			createdAt: Date.now(),
		};

		this.todoStore.set((list) => [newTodo, ...list]);
		this.newTodoTitle = "";
	}

	toggle(id: string) {
		this.todoStore.set((list) =>
			list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
		);
	}

	remove(id: string, e: Event) {
		e.stopPropagation();
		this.todoStore.set((list) => list.filter((t) => t.id !== id));
	}
}
