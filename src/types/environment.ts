export interface EnvironmentVariable {
  id: string;           // crypto.randomUUID()
  key: string;          // variable name (e.g., "baseUrl")
  value: string;        // variable value (e.g., "https://api.dev.example.com")
  enabled: boolean;     // can be individually toggled
}

export interface Environment {
  id: string;           // crypto.randomUUID()
  name: string;         // display name (e.g., "Development")
  variables: EnvironmentVariable[];
  createdAt: number;    // Date.now()
}
