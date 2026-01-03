import { createZunoReact } from "@iadev93/zuno-react"

/**
 * Zuno React adapter, you can also create separate files for store
 * and export it to use it in other components or utils functions.
 */
const z = createZunoReact({
    /** Channel name 
     * Used for broadcast channel for multiple tabs sync
     * */
    channelName: "zuno-demo",
    /** SSE URL 
     * Used for server-sent events for server sync
     * */
    sseUrl: "http://localhost:3000/zuno/sse",
    /** Sync URL 
     * Used for real-time updates for client sync
     * */
    syncUrl: "http://localhost:3000/zuno/sync",
    /** Optimistic 
     * Used for optimistic updates - local updates before server confirmation
     * */
    optimistic: true
})

const counter = z.store<number>("counter", () => 0);


/** App component */
const App = () => {
    /** Counter store 
     * Used for counter state
     * */
    const count = counter.use(); // ✅

    /** Handle counter */
    const handleCounter = (n: number) => {
        /** Set counter 
         * Used for setting counter state
         * */
        counter.set((prev: number) => prev + n)
    }

    /** Return JSX */
    return (
        <div>
            <h1>React Counter</h1>
            <p>Count: {count}</p>
            <button onClick={() => handleCounter(1)}>Increment</button>
            <button onClick={() => handleCounter(-1)}>Decrement</button>
        </div>
    )
}

export default App