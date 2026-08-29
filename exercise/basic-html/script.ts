import { createIndexedDBOfflineQueue, createZuno } from "@iadev93/zuno";

type Todo = {
	id: string;
	title: string;
	done: boolean;
	createdAt: number;
};

const initiate = () => {
	// Elements
	const counterEl = document.getElementById("count") as HTMLSpanElement;
	const incBtn = document.getElementById("increment") as HTMLButtonElement;
	const decBtn = document.getElementById("decrement") as HTMLButtonElement;

	const todoInput = document.getElementById("todo-input") as HTMLInputElement;
	const addBtn = document.getElementById("add-todo") as HTMLButtonElement;
	const todoList = document.getElementById("todo-list") as HTMLUListElement;

	// Initialize Zuno
	const zuno = createZuno({
		channelName: "zuno-todos",
		sseUrl: "http://localhost:3002/zuno/sse",
		syncUrl: "http://localhost:3002/zuno/sync",
		optimistic: true,
		batchSync: true,
		offlineQueue: createIndexedDBOfflineQueue({
			databaseName: "zuno-exercises",
			queueKey: "basic-html",
		}),
	});

	// --- Counter Logic ---

	const counter = zuno.store("counter", () => 0);

	counter.subscribe((val) => {
		counterEl.textContent = String(val);
	});
	// Initial render
	counterEl.textContent = String(counter.get());

	incBtn.addEventListener("click", () => counter.set((c) => c + 1));
	decBtn.addEventListener("click", () => counter.set((c) => c - 1));

	// --- Todo Logic ---

	const todos = zuno.store<Todo[]>("todos", () => []);

	// Render Todos
	const renderTodos = (items: Todo[]) => {
		todoList.innerHTML = items
			.sort((a, b) => b.createdAt - a.createdAt)
			.map(
				(todo) => `
        <li class="${todo.done ? "done" : ""}" data-id="${todo.id}">
          <span class="todo-title">${todo.title}</span>
          <button class="delete-btn">✕</button>
        </li>
      `,
			)
			.join("");

		// Re-attach listeners (simple delegation would be better but this works for simple demo)
		todoList.querySelectorAll("li").forEach((li) => {
			const id = li.dataset.id;
			if (!id) return;

			// Toggle
			li.querySelector(".todo-title")?.addEventListener("click", () => {
				todos.set((list) =>
					list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
				);
			});

			// Delete
			li.querySelector(".delete-btn")?.addEventListener("click", (e) => {
				e.stopPropagation();
				todos.set((list) => list.filter((t) => t.id !== id));
			});
		});
	};

	todos.subscribe(renderTodos);
	renderTodos(todos.get());

	// Add Todo
	const addTodo = () => {
		const title = todoInput.value.trim();
		if (!title) return;

		const newTodo: Todo = {
			id: crypto.randomUUID(),
			title,
			done: false,
			createdAt: Date.now(),
		};

		todos.set((list) => [newTodo, ...list]);
		todoInput.value = "";
	};

	addBtn.addEventListener("click", addTodo);
	todoInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter") addTodo();
	});
};

initiate();
