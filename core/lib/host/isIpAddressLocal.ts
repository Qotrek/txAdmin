const modulename = 'IpChecker';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

const extendedAllowedLanIps: string[] = [];


/**
 * Return if the IP Address is a loopback interface, LAN, detected WAN or any other
 * IP that is registered by the user via the forceInterface convar or config file.
 * 
 * This is used to secure the webpipe auth and the rate limiter.
 */
export const isIpAddressLocal = (ipAddress: string): boolean => {
    const cleanIp = ipAddress.startsWith('::ffff:') ? ipAddress.substring(7) : ipAddress;
    return (
        /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|::1|fd00::)/.test(cleanIp)
        || extendedAllowedLanIps.includes(ipAddress)
        || extendedAllowedLanIps.includes(cleanIp)
    );
}


/**
 * Used to register a new LAN interface. 
 * Added automatically from TXHOST_INTERFACE and banner.js after detecting the WAN address.
 */
export const addLocalIpAddress = (ipAddress: string): void => {
    // console.verbose.debug(`Adding local IP address: ${ipAddress}`);
    extendedAllowedLanIps.push(ipAddress);
}
