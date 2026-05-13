export function requireServerEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is not configured`);
  }

  return value;
}
