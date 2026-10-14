/** Decide whether a social account may post. Missing keys skip the queue; they do not fail the story. */

export type SocialPlatform = "x" | "facebook" | "bluesky";

export type SocialCreds = {
  handle?: string;
  app_password?: string;
  access_token?: string;
  username?: string;
  page_token?: string;
  page_id?: string;
};

export type SocialEnv = {
  blueskyHandle?: string;
  blueskyPass?: string;
  xClientId?: string;
  xClientSecret?: string;
  metaAppId?: string;
  metaAppSecret?: string;
};

export function socialEnv(env: NodeJS.ProcessEnv = process.env): SocialEnv {
  return {
    blueskyHandle: env.BLUESKY_HANDLE || undefined,
    blueskyPass: env.BLUESKY_APP_PASSWORD || undefined,
    xClientId: env.X_CLIENT_ID || undefined,
    xClientSecret: env.X_CLIENT_SECRET || undefined,
    metaAppId: env.META_APP_ID || undefined,
    metaAppSecret: env.META_APP_SECRET || undefined,
  };
}

/** null means the account may post. Any other string is a skip reason. */
export function socialSkipReason(platform: string, creds: SocialCreds | null, env: SocialEnv): string | null {
  if (platform === "bluesky") {
    if (!(creds?.handle || env.blueskyHandle) || !(creds?.app_password || env.blueskyPass)) return "bluesky_not_configured";
    return null;
  }
  if (platform === "x") {
    if (!env.xClientId || !env.xClientSecret) return "x_not_configured";
    if (!creds?.access_token) return "x_not_connected";
    return null;
  }
  if (platform === "facebook") {
    if (!env.metaAppId || !env.metaAppSecret) return "facebook_not_configured";
    if (!creds?.page_token || !creds?.page_id) return "facebook_not_connected";
    return null;
  }
  return "unknown_platform";
}

export function isConfigSkip(message: string): boolean {
  return /not_configured|not_connected|credentials_unreadable|unknown_platform/.test(message);
}
