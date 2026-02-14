// Mock data for environments

export interface EnvironmentVariable {
	key: string;
	value: string;
	enabled: boolean;
}

export interface Environment {
	id: string;
	name: string;
	variables: EnvironmentVariable[];
}

export const mockEnvironments: Environment[] = [
	{
		id: "env-1",
		name: "Development",
		variables: [
			{ key: "baseUrl", value: "https://api-dev.example.com", enabled: true },
			{ key: "apiKey", value: "dev_key_12345", enabled: true },
			{ key: "timeout", value: "5000", enabled: true },
		],
	},
	{
		id: "env-2",
		name: "Production",
		variables: [
			{ key: "baseUrl", value: "https://api.example.com", enabled: true },
			{ key: "apiKey", value: "prod_key_67890", enabled: true },
			{ key: "timeout", value: "10000", enabled: true },
		],
	},
];

export const activeEnvironmentId = "env-1"; // Development is active by default
