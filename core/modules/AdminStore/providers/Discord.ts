const modulename = 'AdminStore:DiscordProvider';
import crypto from 'node:crypto';
import consoleFactory from '@lib/console';
import { z } from 'zod';
const console = consoleFactory(modulename);

const discordUserSchema = z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    discriminator: z.string().optional(),
    global_name: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
});
export type DiscordUserInfoType = z.infer<typeof discordUserSchema>;

export const getDiscordOauthState = (stateKern: string) => {
    const stateSeed = `tx:discord:${stateKern}`;
    return crypto.createHash('SHA1').update(stateSeed).digest('hex');
};

export default class DiscordProvider {
    /**
     * Returns the Provider Auth URL
     */
    getAuthURL(redirectUri: string, stateKern: string, clientId: string) {
        if (!clientId) throw new Error('Discord OAuth Client ID is not configured.');
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'identify',
            state: getDiscordOauthState(stateKern),
            prompt: 'consent',
        });
        return `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Exchanges callback code for access token
     */
    async processCallback(sessionCallbackUri: string, sessionStateKern: string, callbackUri: string, clientId: string, clientSecret: string) {
        if (!clientId || !clientSecret) throw new Error('Discord OAuth credentials not configured');

        const parsedUri = new URL(callbackUri);
        const callbackCode = parsedUri.searchParams.get('code');
        const callbackState = parsedUri.searchParams.get('state');
        if (!callbackCode) throw new Error('code not present');
        if (!callbackState) throw new Error('state not present');

        const expectedState = getDiscordOauthState(sessionStateKern);
        if (callbackState !== expectedState) {
            throw new Error('OAuth state mismatch');
        }

        const bodyParams = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: callbackCode,
            redirect_uri: sessionCallbackUri,
        });

        const resp = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams.toString(),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Discord token exchange failed (${resp.status}): ${errText}`);
        }

        const tokenData = await resp.json() as any;
        if (!tokenData || !tokenData.access_token) {
            throw new Error('access_token not present in Discord response');
        }
        return tokenData;
    }

    /**
     * Gets user info via access token
     */
    async getUserInfo(accessToken: string): Promise<DiscordUserInfoType> {
        const resp = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Discord userinfo fetch failed (${resp.status}): ${errText}`);
        }

        const data = await resp.json();
        return discordUserSchema.parse(data);
    }
}

