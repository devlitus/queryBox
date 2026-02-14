// Mock data for collections, folders, and requests

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface Request {
	id: string;
	name: string;
	method: HttpMethod;
	url: string;
}

export interface Folder {
	id: string;
	name: string;
	requests: Request[];
}

export interface Collection {
	id: string;
	name: string;
	folders: Folder[];
	requests: Request[];
}

export const mockCollections: Collection[] = [
	{
		id: "col-1",
		name: "API Testing",
		folders: [
			{
				id: "folder-1",
				name: "User Management",
				requests: [
					{
						id: "req-1",
						name: "Get Users",
						method: "GET",
						url: "https://api.example.com/users",
					},
					{
						id: "req-2",
						name: "Create User",
						method: "POST",
						url: "https://api.example.com/users",
					},
					{
						id: "req-3",
						name: "Update User",
						method: "PUT",
						url: "https://api.example.com/users/:id",
					},
					{
						id: "req-4",
						name: "Delete User",
						method: "DELETE",
						url: "https://api.example.com/users/:id",
					},
				],
			},
			{
				id: "folder-2",
				name: "Authentication",
				requests: [
					{
						id: "req-5",
						name: "Login",
						method: "POST",
						url: "https://api.example.com/auth/login",
					},
					{
						id: "req-6",
						name: "Logout",
						method: "POST",
						url: "https://api.example.com/auth/logout",
					},
				],
			},
		],
		requests: [
			{
				id: "req-7",
				name: "Health Check",
				method: "GET",
				url: "https://api.example.com/health",
			},
		],
	},
	{
		id: "col-2",
		name: "E-commerce API",
		folders: [
			{
				id: "folder-3",
				name: "Products",
				requests: [
					{
						id: "req-8",
						name: "Get Products",
						method: "GET",
						url: "https://api.shop.com/products",
					},
					{
						id: "req-9",
						name: "Get Product by ID",
						method: "GET",
						url: "https://api.shop.com/products/:id",
					},
				],
			},
		],
		requests: [],
	},
	{
		id: "col-3",
		name: "Weather API",
		folders: [],
		requests: [
			{
				id: "req-10",
				name: "Get Current Weather",
				method: "GET",
				url: "https://api.weather.com/current",
			},
			{
				id: "req-11",
				name: "Get Forecast",
				method: "GET",
				url: "https://api.weather.com/forecast",
			},
		],
	},
];
