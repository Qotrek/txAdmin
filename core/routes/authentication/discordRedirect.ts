const modulename = 'WebServer:AuthDiscordRedirect';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { ApiOauthRedirectResp } from '@shared/authApiTypes';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
const console = consoleFactory(modulename);

const querySchema = z.object({
    origin: z.string(),
});

/**
 * Generates Discord OAuth URL and returns it to the frontend
 */
export default async function AuthDiscordRedirect(ctx: InitializedCtx) {
    const schemaRes = querySchema.safeParse(ctx.request.query);
    if (!schemaRes.success) {
        return ctx.send<ApiOauthRedirectResp>({
            error: `Invalid request query: ${schemaRes.error.message}`,
        });
    }
    const { origin } = schemaRes.data;

    // Check if Discord OAuth is configured
    const clientId = txConfig.discordBot?.oauthClientId;
    const clientSecret = txConfig.discordBot?.oauthClientSecret;
    if (!clientId || !clientSecret) {
        return ctx.send<ApiOauthRedirectResp>({
            error: 'Discord OAuth is not configured in txAdmin settings (Settings -> Discord).',
        });
    }

    if (!txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiOauthRedirectResp>({
            error: 'no_admins_setup',
        });
    }

    const callbackUrl = origin + '/login/discord/callback';
    const stateKern = randomUUID();
    ctx.sessTools.set({
        tmpOauthLoginStateKern: stateKern,
        tmpOauthLoginCallbackUri: callbackUrl,
    });

    try {
        const authUrl = txCore.adminStore.providers.discord.getAuthURL(
            callbackUrl,
            stateKern,
            clientId,
        );
        return ctx.send<ApiOauthRedirectResp>({ authUrl });
    } catch (error) {
        return ctx.send<ApiOauthRedirectResp>({
            error: (error as Error).message,
        });
    }
}

