import { createIndexedDBOfflineQueue } from "@iadev93/zuno";
import { createZunoReact } from "@iadev93/zuno-react";
import { useState, useSyncExternalStore } from "react";
import { ZUNO_SERVER_URL } from "../config";
import { loggerMiddleware } from "./logger";
import "./App.css";

// --- Types ---
type Todo = {
	id: string;
	title: string;
	done: boolean;
	createdAt: number;
};

// --- Zuno Setup ---
const z = createZunoReact({
	channelName: "zuno-demo",
	sseUrl: `${ZUNO_SERVER_URL}/zuno/sse`,
	syncUrl: `${ZUNO_SERVER_URL}/zuno/sync`,
	optimistic: true,
	batchSync: true,
	offlineQueue: createIndexedDBOfflineQueue({
		databaseName: "zuno-exercises",
		queueKey: "react",
	}),
	middleware: [loggerMiddleware],
	resolveConflict: (_local, server) => server, // Server Wins
});

// --- Stores ---
const counter = z.store("counter", () => 0);
const todos = z.store<Todo[]>("todos", () => []);

const ConnectionStatus = () => {
	const status = useSyncExternalStore(
		z.status.subscribe,
		z.status.get,
		z.status.get,
	);
	return (
		<div className={`connection-status ${status.connection}`}>
			<span>{status.connection}</span>
			<span>Queue: {status.queuedMutations}</span>
			<span>Retries: {status.retryAttempt}</span>
			<span>Conflicts: {status.conflictCount}</span>
		</div>
	);
};

// --- Components ---

const Counter = () => {
	const count = counter.use();
	return (
		<div className="counter-section">
			<button type="button" onClick={() => counter.set((c) => c - 1)}>
				-
			</button>
			<span className="count-display">{count}</span>
			<button type="button" onClick={() => counter.set((c) => c + 1)}>
				+
			</button>
		</div>
	);
};

const AddTodo = () => {
	const [text, setText] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!text.trim()) return;

		const newTodo: Todo = {
			id: crypto.randomUUID(),
			title: text.trim(),
			done: false,
			createdAt: Date.now(),
		};

		todos.set((list) => [newTodo, ...list]);
		setText("");
	};

	return (
		<form className="todo-form" onSubmit={handleSubmit}>
			<input
				type="text"
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="What needs to be done?"
			/>
			<button type="submit">Add</button>
		</form>
	);
};

const TodoList = () => {
	const list = todos.use();

	// Sort by date descending
	const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);

	const toggle = (id: string) => {
		todos.set((prev) =>
			prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
		);
	};

	const remove = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		todos.set((prev) => prev.filter((t) => t.id !== id));
	};

	return (
		<ul>
			{sorted.map((todo) => (
				<li key={todo.id} className={`todo-item ${todo.done ? "done" : ""}`}>
					<button
						type="button"
						className="todo-title-btn"
						onClick={() => toggle(todo.id)}
					>
						{todo.title}
					</button>
					<button
						type="button"
						className="delete-btn"
						onClick={(e) => remove(todo.id, e)}
					>
						✕
					</button>
				</li>
			))}
		</ul>
	);
};

const App = () => {
	return (
		<div className="container">
			<h1>Zuno React</h1>
			<ConnectionStatus />
			<Counter />
			<div className="todo-section">
				<AddTodo />
				<TodoList />
			</div>
		</div>
	);
};

export default App;
