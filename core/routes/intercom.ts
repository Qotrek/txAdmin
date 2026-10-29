const modulename = 'WebServer:Intercom';
import { cloneDeep }  from 'lodash-es';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);


/**
 * Intercommunications endpoint
 */
export default async function Intercom(ctx: InitializedCtx) {
    //Sanity check
    if ((typeof (ctx as any).params.scope !== 'string') || (ctx as any).request.body === undefined) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    const scope = (ctx as any).params.scope as string;

    const postData = cloneDeep(ctx.request.body);
    postData.txAdminToken = true;

    //Delegate to the specific scope functions
    if (scope == 'monitor') {
        try {
            txCore.fxMonitor.handleHeartBeat('http');
            return ctx.send(txCore.metrics.txRuntime.currHbData);
        } catch (error) {
            return ctx.send({
                txAdminVersion: txEnv.txaVersion,
                success: false,
            });
        }
    } else if (scope == 'resources') {
        if (!Array.isArray(postData.resources)) {
            return ctx.utils.error(400, 'Invalid Request');
        }
        txCore.fxResources.tmpUpdateResourceList(postData.resources);
        return ctx.send({ txAdminVersion: txEnv.txaVersion, success: true });
    } else if (scope == 'schedule') {
        const { action, parameter, reason, invokingResource } = postData;
        const authorDesc = invokingResource ? `resource '${invokingResource}'` : 'Lua script';
        const reasonDesc = reason ? ` (${reason})` : '';

        if (action === 'setNextTempSchedule') {
            try {
                if (typeof parameter !== 'string' && typeof parameter !== 'number') {
                    return ctx.send({ success: false, error: 'Parameter must be a string (HH:MM or +minutes) or number (minutes).' });
                }
                const timeString = typeof parameter === 'number' ? `+${Math.floor(parameter)}` : String(parameter).trim();
                const author = invokingResource ? `FXServer:${invokingResource}` : 'FXServer';
                const res = txCore.fxScheduler.setNextTempSchedule(timeString, author);
                const logMsg = `Scheduling server restart at ${res.string} via ${authorDesc}${reasonDesc}`;
                console.log(logMsg);
                txCore.logger.admin.write('FXServer', logMsg);
                return ctx.send({
                    success: true,
                    action: 'setNextTempSchedule',
                    time: res.string,
                    minuteFloorTs: res.minuteFloorTs,
                    secondsRemaining: res.secondsRemaining,
                    message: `Restart scheduled for ${res.string} (in ${Math.round(res.secondsRemaining / 60)}m).`,
                });
            } catch (error) {
                return ctx.send({
                    success: false,
                    error: (error as Error).message,
                });
            }
        } else if (action === 'setNextSkip' || action === 'cancel') {
            try {
                const author = invokingResource ? `FXServer:${invokingResource}` : 'FXServer';
                const res = txCore.fxScheduler.setNextSkip(true, author);
                const logMsg = `Cancelled scheduled restart via ${authorDesc}${reasonDesc}`;
                console.log(logMsg);
                txCore.logger.admin.write('FXServer', logMsg);
                return ctx.send({
                    success: true,
                    action: 'setNextSkip',
                    cancelled: res.cancelled,
                    message: res.cancelled ? 'Scheduled restart cancelled.' : 'No scheduled restart was active.',
                });
            } catch (error) {
                return ctx.send({
                    success: false,
                    error: (error as Error).message,
                });
            }
        } else if (action === 'restartServer') {
            try {
                const author = invokingResource ? `FXServer:${invokingResource}` : 'FXServer';
                const reasonText = reason ? String(reason) : 'Lua export restartServer';
                const logMsg = `Restarting server immediately via ${authorDesc}${reasonDesc}`;
                console.log(logMsg);
                txCore.logger.admin.write('FXServer', logMsg);
                txCore.fxRunner.restartServer(reasonText, author);
                return ctx.send({
                    success: true,
                    action: 'restartServer',
                    message: 'Server restart triggered.',
                });
            } catch (error) {
                return ctx.send({
                    success: false,
                    error: (error as Error).message,
                });
            }
        } else if (action === 'getStatus') {
            try {
                const status = txCore.fxScheduler.getStatus();
                return ctx.send({
                    success: true,
                    status,
                });
            } catch (error) {
                return ctx.send({
                    success: false,
                    error: (error as Error).message,
                });
            }
        } else {
            return ctx.send({
                success: false,
                error: 'Unknown schedule action.',
            });
        }
    } else {
        return ctx.send({
            type: 'danger',
            message: 'Unknown intercom scope.',
        });
    }

    return ctx.send({
        txAdminVersion: txEnv.txaVersion,
        success: false,
    });
};
