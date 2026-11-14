export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "Error",
  ) {
    super(message);
  }
}
export const badRequest = (m: string) => new AppError(400, m, "BadRequest");
export const unauthorized = (m = "Authentication required") =>
  new AppError(401, m, "Unauthorized");
export const forbidden = (m = "You do not have permission to do this") =>
  new AppError(403, m, "Forbidden");
export const notFound = (m = "Resource not found") =>
  new AppError(404, m, "NotFound");
export const conflict = (m: string) => new AppError(409, m, "Conflict");
