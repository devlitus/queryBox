// Mock data for request history

import type { HttpMethod } from "./mock-collections";

export interface HistoryEntry {
	id: string;
	method: HttpMethod;
	url: string;
	timestamp: Date;
	status: number;
	statusText: string;
}

export const mockHistory: HistoryEntry[] = [
	{
		id: "hist-1",
		method: "GET",
		url: "https://api.example.com/users",
		timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-2",
		method: "POST",
		url: "https://api.example.com/users",
		timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
		status: 201,
		statusText: "Created",
	},
	{
		id: "hist-3",
		method: "GET",
		url: "https://api.example.com/users/123",
		timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-4",
		method: "DELETE",
		url: "https://api.example.com/users/456",
		timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
		status: 204,
		statusText: "No Content",
	},
	{
		id: "hist-5",
		method: "GET",
		url: "https://api.example.com/products",
		timestamp: new Date(Date.now() - 1000 * 60 * 90), // 1.5 hours ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-6",
		method: "PUT",
		url: "https://api.example.com/users/789",
		timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-7",
		method: "GET",
		url: "https://api.weather.com/current",
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-8",
		method: "POST",
		url: "https://api.example.com/auth/login",
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
		status: 200,
		statusText: "OK",
	},
	{
		id: "hist-9",
		method: "GET",
		url: "https://api.example.com/users",
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
		status: 404,
		statusText: "Not Found",
	},
	{
		id: "hist-10",
		method: "PATCH",
		url: "https://api.example.com/users/111",
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
		status: 200,
		statusText: "OK",
	},
];
