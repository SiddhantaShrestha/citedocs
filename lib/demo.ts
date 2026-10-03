export function isDemoReadonly() {
  const flag = process.env.DEMO_READONLY;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}
