// A user row as it may leave the server: everything except the password hash.
// Every response that sends a stored user goes through this.
export function toPublicUser<T extends { password?: unknown }>(user: T | undefined): Omit<T, "password"> | undefined {
  if (!user) return user;
  const { password: _password, ...rest } = user;
  return rest;
}
