// Mock data for a response

export interface ResponseData {
	status: number;
	statusText: string;
	time: number; // in milliseconds
	size: string; // formatted size string
	headers: Array<{ key: string; value: string }>;
	cookies: Array<{
		name: string;
		value: string;
		domain: string;
		path: string;
		expires: string;
		httpOnly: boolean;
		secure: boolean;
	}>;
	body: string; // JSON string or other format
	testResults?: Array<{
		name: string;
		passed: boolean;
		duration: number; // in ms
		error?: string;
	}>;
}

export const mockResponse: ResponseData = {
	status: 200,
	statusText: "OK",
	time: 245,
	size: "1.2 KB",
	headers: [
		{ key: "Content-Type", value: "application/json; charset=utf-8" },
		{ key: "Date", value: "Fri, 14 Feb 2026 10:30:00 GMT" },
		{ key: "Server", value: "nginx/1.21.0" },
		{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
		{ key: "X-Powered-By", value: "Express" },
		{ key: "Content-Length", value: "1234" },
	],
	cookies: [
		{
			name: "sessionId",
			value: "abc123xyz789",
			domain: "api.example.com",
			path: "/",
			expires: "2026-02-15 10:30:00",
			httpOnly: true,
			secure: true,
		},
		{
			name: "preferences",
			value: "darkMode=true",
			domain: "api.example.com",
			path: "/",
			expires: "2027-02-14 10:30:00",
			httpOnly: false,
			secure: false,
		},
	],
	body: JSON.stringify(
		{
			users: [
				{
					id: 1,
					name: "John Doe",
					email: "john@example.com",
					role: "admin",
					active: true,
				},
				{
					id: 2,
					name: "Jane Smith",
					email: "jane@example.com",
					role: "user",
					active: true,
				},
				{
					id: 3,
					name: "Bob Johnson",
					email: "bob@example.com",
					role: "user",
					active: false,
				},
			],
			total: 3,
			page: 1,
			limit: 10,
		},
		null,
		2
	),
	testResults: [
		{
			name: "Status code is 200",
			passed: true,
			duration: 5,
		},
		{
			name: "Response time is less than 500ms",
			passed: true,
			duration: 3,
		},
		{
			name: "Response has users array",
			passed: true,
			duration: 2,
		},
		{
			name: "All users have email field",
			passed: false,
			duration: 4,
			error: "Expected user 3 to have email field",
		},
	],
};
