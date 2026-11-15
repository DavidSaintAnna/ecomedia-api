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
export const unauthorized = (m = "Autenticação necessária") =>
  new AppError(401, m, "Unauthorized");
export const forbidden = (m = "Você não tem permissão para fazer isso") =>
  new AppError(403, m, "Forbidden");
export const notFound = (m = "Recurso não encontrado") =>
  new AppError(404, m, "NotFound");
export const conflict = (m: string) => new AppError(409, m, "Conflict");
