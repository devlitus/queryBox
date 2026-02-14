// Mock data for a complete request configuration

import type { HttpMethod } from "./mock-collections";

export interface KeyValuePair {
	key: string;
	value: string;
	description?: string;
	enabled: boolean;
}

export interface RequestConfig {
	method: HttpMethod;
	url: string;
	params: KeyValuePair[];
	headers: KeyValuePair[];
	body: {
		mode: "none" | "form-data" | "x-www-form-urlencoded" | "raw" | "binary" | "graphql";
		raw?: string;
		formData?: KeyValuePair[];
	};
	auth: {
		type: "none" | "api-key" | "bearer" | "basic" | "oauth2";
		bearerToken?: string;
		apiKey?: { key: string; value: string; addTo: "header" | "query" };
		basicAuth?: { username: string; password: string };
	};
	preRequestScript?: string;
	tests?: string;
	settings: {
		followRedirects: boolean;
		enableSSL: boolean;
		timeout: number;
	};
}

export const mockRequest: RequestConfig = {
	method: "GET",
	url: "https://api.example.com/users",
	params: [
		{ key: "page", value: "1", description: "Page number", enabled: true },
		{ key: "limit", value: "10", description: "Items per page", enabled: true },
		{ key: "sort", value: "name", description: "Sort field", enabled: false },
	],
	headers: [
		{ key: "Content-Type", value: "application/json", enabled: true },
		{ key: "Accept", value: "application/json", enabled: true },
		{ key: "User-Agent", value: "queryBox/1.0", enabled: true },
	],
	body: {
		mode: "raw",
		raw: JSON.stringify(
			{
				name: "John Doe",
				email: "john@example.com",
				age: 30,
			},
			null,
			2
		),
	},
	auth: {
		type: "bearer",
		bearerToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	},
	preRequestScript: `// Pre-request script example
pm.environment.set("timestamp", Date.now());
console.log("Request will be sent at:", new Date());`,
	tests: `// Tests example
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response time is less than 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});`,
	settings: {
		followRedirects: true,
		enableSSL: true,
		timeout: 10000,
	},
};
