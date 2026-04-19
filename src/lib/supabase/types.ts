export type SupabaseCookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
};

export type SupabaseCookie = {
  name: string;
  value: string;
  options: SupabaseCookieOptions;
};

