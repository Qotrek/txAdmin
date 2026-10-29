-- Prevent running in monitor mode
if not TX_SERVER_MODE then return end

if TX_LUACOMHOST == "invalid" or not TX_LUACOMTOKEN or TX_LUACOMTOKEN == "invalid" then
    return
end

-- =============================================
-- MARK: Restart Scheduler Exports & Events
-- =============================================

--- Checks if current Lua thread can yield
local function canYield()
    local thread, isMain = coroutine.running()
    return thread ~= nil and not isMain
end

--- Normalizes time argument to string expected by txAdmin (+minutes or HH:MM)
local function normalizeTimeString(time)
    if type(time) == 'number' then
        local mins = math.floor(time)
        if mins < 1 then mins = 1 end
        return '+' .. tostring(mins)
    elseif type(time) == 'string' then
        local trimmed = string.gsub(time, '^%s*(.-)%s*$', '%1')
        -- If user passed raw numbers like "15", convert to "+15"
        if string.match(trimmed, '^%d+$') then
            return '+' .. trimmed
        end
        return trimmed
    end
    return nil
end

--- Internal helper to send schedule requests to txAdmin intercom
local function requestSchedulerIntercom(action, parameter, reason, invokingRes, cb)
    local url = "http://" .. TX_LUACOMHOST .. "/intercom/schedule"
    local payload = json.encode({
        txAdminToken = TX_LUACOMTOKEN,
        action = action,
        parameter = parameter,
        reason = reason,
        invokingResource = invokingRes or 'unknown'
    })

    PerformHttpRequest(url, function(httpCode, rawData, resultHeaders)
        if httpCode == 200 and rawData then
            local ok, resp = pcall(json.decode, tostring(rawData))
            if ok and type(resp) == 'table' then
                if resp.success then
                    if cb then cb(true, resp.message or resp) end
                else
                    local errMsg = resp.error or 'unknown txAdmin error'
                    if cb then cb(false, errMsg) end
                end
                return
            end
        end

        local err = "HTTP request failed (code " .. tostring(httpCode) .. ")"
        if rawData and #tostring(rawData) > 0 then
            err = err .. ": " .. tostring(rawData)
        end
        if cb then cb(false, err) end
    end, 'POST', payload, { ['Content-Type'] = 'application/json' })
end

--- Schedule a server restart
--- Usage:
---   exports.monitor:scheduleRestart(15) -- in 15 minutes
---   exports.monitor:scheduleRestart("+15", "Maintenance")
---   exports.monitor:scheduleRestart("04:00", "Daily restart")
---   local success, message = exports.monitor:scheduleRestart(15) -- inside coroutine/thread
---   exports.monitor:scheduleRestart(15, function(success, message) ... end)
---
--- @param time number|string (+minutes, minutes number, or HH:MM string)
--- @param reason? string|function optional reason string or callback
--- @param cb? function optional callback(success, message)
--- @return boolean success, string message (if called within a coroutine)
local function scheduleRestart(time, reason, cb)
    local invokingRes = GetInvokingResource() or GetCurrentResourceName()

    if type(reason) == 'function' and cb == nil then
        cb = reason
        reason = nil
    end

    local normalizedTime = normalizeTimeString(time)
    if not normalizedTime then
        local err = "Invalid time argument. Expected integer minutes or 'HH:MM' string, got " .. type(time)
        if cb then cb(false, err) end
        return false, err
    end

    -- Send FD3 trace as fast bridged backup
    PrintStructuredTrace(json.encode({
        type = 'txAdminCommandBridge',
        command = 'scheduleRestart',
        time = normalizedTime,
        reason = reason,
        author = invokingRes,
        invokingResource = invokingRes
    }))

    if cb then
        requestSchedulerIntercom('setNextTempSchedule', normalizedTime, reason, invokingRes, cb)
        return true
    elseif canYield() then
        local p = promise.new()
        requestSchedulerIntercom('setNextTempSchedule', normalizedTime, reason, invokingRes, function(success, message)
            p:resolve({ success = success, message = message })
        end)
        local result = Citizen.Await(p)
        return result.success, result.message
    else
        requestSchedulerIntercom('setNextTempSchedule', normalizedTime, reason, invokingRes, function(success, message)
            if not success then
                txPrintError('[scheduleRestart] ' .. tostring(message))
            end
        end)
        return true
    end
end

--- Cancel scheduled server restart
--- Usage:
---   exports.monitor:cancelRestart()
---   exports.monitor:cancelRestart("Event postponed")
---   local success, message = exports.monitor:cancelRestart() -- inside coroutine/thread
---   exports.monitor:cancelRestart(function(success, message) ... end)
---
--- @param reason? string|function optional reason or callback
--- @param cb? function optional callback(success, message)
--- @return boolean success, string message (if called within a coroutine)
local function cancelRestart(reason, cb)
    local invokingRes = GetInvokingResource() or GetCurrentResourceName()

    if type(reason) == 'function' and cb == nil then
        cb = reason
        reason = nil
    end

    -- Send FD3 trace as fast bridged backup
    PrintStructuredTrace(json.encode({
        type = 'txAdminCommandBridge',
        command = 'cancelRestart',
        reason = reason,
        author = invokingRes,
        invokingResource = invokingRes
    }))

    if cb then
        requestSchedulerIntercom('setNextSkip', true, reason, invokingRes, cb)
        return true
    elseif canYield() then
        local p = promise.new()
        requestSchedulerIntercom('setNextSkip', true, reason, invokingRes, function(success, message)
            p:resolve({ success = success, message = message })
        end)
        local result = Citizen.Await(p)
        return result.success, result.message
    else
        requestSchedulerIntercom('setNextSkip', true, reason, invokingRes, function(success, message)
            if not success then
                txPrintError('[cancelRestart] ' .. tostring(message))
            end
        end)
        return true
    end
end

--- Get current scheduled restart status
--- @param cb? function optional callback(success, statusTable)
--- @return table|boolean statusTable or false on error (if called within a coroutine)
local function getScheduledRestart(cb)
    local invokingRes = GetInvokingResource() or GetCurrentResourceName()

    if cb then
        requestSchedulerIntercom('getStatus', nil, nil, invokingRes, function(success, res)
            if success and type(res) == 'table' and res.status then
                cb(true, res.status)
            else
                cb(false, res)
            end
        end)
        return true
    elseif canYield() then
        local p = promise.new()
        requestSchedulerIntercom('getStatus', nil, nil, invokingRes, function(success, res)
            if success and type(res) == 'table' and res.status then
                p:resolve({ success = true, status = res.status })
            else
                p:resolve({ success = false, message = res })
            end
        end)
        local result = Citizen.Await(p)
        if result.success then
            return result.status
        else
            return false, result.message
        end
    else
        return false, "Cannot fetch status synchronously outside a coroutine. Provide a callback function."
    end
end

--- Trigger immediate server restart
--- @param reason? string|function optional reason or callback
--- @param cb? function optional callback(success, message)
--- @return boolean success, string message (if called within a coroutine)
local function restartServer(reason, cb)
    local invokingRes = GetInvokingResource() or GetCurrentResourceName()

    if type(reason) == 'function' and cb == nil then
        cb = reason
        reason = nil
    end

    PrintStructuredTrace(json.encode({
        type = 'txAdminCommandBridge',
        command = 'restartServer',
        reason = reason,
        author = invokingRes,
        invokingResource = invokingRes
    }))

    if cb then
        requestSchedulerIntercom('restartServer', nil, reason, invokingRes, cb)
        return true
    elseif canYield() then
        local p = promise.new()
        requestSchedulerIntercom('restartServer', nil, reason, invokingRes, function(success, message)
            p:resolve({ success = success, message = message })
        end)
        local result = Citizen.Await(p)
        return result.success, result.message
    else
        requestSchedulerIntercom('restartServer', nil, reason, invokingRes, function(success, message)
            if not success then
                txPrintError('[restartServer] ' .. tostring(message))
            end
        end)
        return true
    end
end

-- Export declarations
exports('scheduleRestart', scheduleRestart)
exports('cancelRestart', cancelRestart)
exports('getScheduledRestart', getScheduledRestart)
exports('restartServer', restartServer)

-- Event listeners for other resources
AddEventHandler('txAdmin:scheduleRestart', scheduleRestart)
AddEventHandler('txAdmin:cancelRestart', cancelRestart)
AddEventHandler('txAdmin:getScheduledRestart', getScheduledRestart)
AddEventHandler('txAdmin:restartServer', restartServer)

-- Server console commands
RegisterCommand('txaScheduleRestart', function(source, args)
    if source ~= 0 then return end
    local time = args[1]
    if not time then
        return txPrint("^1Usage: txaScheduleRestart <time (+mins or HH:MM)> [reason]^0")
    end
    table.remove(args, 1)
    local reason = #args > 0 and table.concat(args, ' ') or nil
    scheduleRestart(time, reason, function(success, msg)
        if success then
            txPrint("^2[txAdmin] " .. tostring(msg) .. "^0")
        else
            txPrintError("[txAdmin] Failed to schedule restart: " .. tostring(msg))
        end
    end)
end, true)

RegisterCommand('txaCancelRestart', function(source, args)
    if source ~= 0 then return end
    local reason = #args > 0 and table.concat(args, ' ') or nil
    cancelRestart(reason, function(success, msg)
        if success then
            txPrint("^2[txAdmin] " .. tostring(msg) .. "^0")
        else
            txPrintError("[txAdmin] Failed to cancel restart: " .. tostring(msg))
        end
    end)
end, true)
