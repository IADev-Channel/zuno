/** Change exercise server selection and ports in this file only. */
export const EXERCISE_SERVER_PORTS = {
	http: 3000,
	elysia: 3002,
	express: 3003,
} as const;

/** Browser exercises connect to this server. */
export const ACTIVE_EXERCISE_SERVER: keyof typeof EXERCISE_SERVER_PORTS =
	"express";

export const ZUNO_SERVER_PORT = EXERCISE_SERVER_PORTS[ACTIVE_EXERCISE_SERVER];
export const ZUNO_SERVER_URL = `http://localhost:${ZUNO_SERVER_PORT}`;
