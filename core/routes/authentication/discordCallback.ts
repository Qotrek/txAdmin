const modulename = 'WebServer:AuthDiscordCallback';
import consoleFactory from '@lib/console';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { AuthedAdmin, DiscordSessAuthType } from '@modules/WebServer/authLogic';
import { z } from 'zod';
import { ApiOauthCallbackErrorResp, ApiOauthCallbackResp } from '@shared/authApiTypes';
import { nanoid } from 'nanoid';
const console = consoleFactory(modulename);

const bodySchema = z.object({
    redirectUri: z.string(),
});

export default async function AuthDiscordCallback(ctx: InitializedCtx) {
    const schemaRes = bodySchema.safeParse(ctx.request.body);
    if (!schemaRes.success) {
        return ctx.send<ApiOauthCallbackResp>({
            errorTitle: 'Invalid request body',
            errorMessage: schemaRes.error.message,
        });
    }
    const { redirectUri } = schemaRes.data;

    const clientId = txConfig.discordBot?.oauthClientId;
    const clientSecret = txConfig.discordBot?.oauthClientSecret;
    if (!clientId || !clientSecret) {
        return ctx.send<ApiOauthCallbackErrorResp>({
            errorTitle: 'Discord OAuth Error',
            errorMessage: 'Discord OAuth credentials are not configured.',
        });
    }

    const inboundSession = ctx.sessTools.get();
    if (!inboundSession?.tmpOauthLoginStateKern || !inboundSession?.tmpOauthLoginCallbackUri) {
        return ctx.send<ApiOauthCallbackErrorResp>({
            errorCode: 'invalid_session',
        });
    }

    let tokenData;
    let userInfo;
    try {
        tokenData = await txCore.adminStore.providers.discord.processCallback(
            inboundSession.tmpOauthLoginCallbackUri,
            inboundSession.tmpOauthLoginStateKern,
            redirectUri,
            clientId,
            clientSecret,
        );
        userInfo = await txCore.adminStore.providers.discord.getUserInfo(tokenData.access_token);
    } catch (error) {
        console.warn(`Discord auth callback failed: ${(error as Error).message}`);
        return ctx.send<ApiOauthCallbackErrorResp>({
            errorTitle: 'Discord Login Failed',
            errorMessage: (error as Error).message,
        });
    }

    const discordIdentifier = `discord:${userInfo.id}`;

    // Look up admin by identifier or provider id
    const vaultAdmin = txCore.adminStore.getAdminByIdentifiers([discordIdentifier])
        || txCore.adminStore.getAdminByProviderUID(userInfo.id);

    if (!vaultAdmin) {
        ctx.sessTools.destroy();
        return ctx.send<ApiOauthCallbackResp>({
            errorCode: 'not_admin',
            errorContext: {
                identifier: discordIdentifier,
                name: userInfo.global_name || userInfo.username,
                profile: `https://discord.com/users/${userInfo.id}`,
            },
        });
    }

    try {
        const csrfToken = nanoid();
        const authedAdmin = new AuthedAdmin(vaultAdmin, csrfToken);

        // Cache avatar picture if available
        if (userInfo.avatar) {
            const avatarUrl = `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`;
            txCore.cacheStore.set(`admin:picture:${vaultAdmin.name}`, avatarUrl);
        }

        ctx.sessTools.set({
            auth: {
                type: 'discord',
                username: vaultAdmin.name,
                csrfToken,
                expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                identifier: discordIdentifier,
            } satisfies DiscordSessAuthType,
        });

        authedAdmin.logAction(`logged in from ${ctx.ip} via discord auth`);
        return ctx.send<ApiOauthCallbackResp>(authedAdmin.getAuthData());
    } catch (error) {
        console.error(`Failed to authenticate admin session: ${(error as Error).message}`);
        return ctx.send<ApiOauthCallbackResp>({
            errorTitle: 'Authentication failed',
            errorMessage: 'Failed to create session.',
        });
    }
}

