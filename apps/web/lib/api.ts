export function publicApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function serverApiUrl() {
  return process.env.API_URL ?? publicApiUrl();
}
