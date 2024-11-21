'use strict';

var transport = require('@chargerwallet/hd-transport');
var hdShared = require('@chargerwallet/hd-shared');
var ByteBuffer = require('bytebuffer');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var transport__default = /*#__PURE__*/_interopDefaultLegacy(transport);
var ByteBuffer__default = /*#__PURE__*/_interopDefaultLegacy(ByteBuffer);

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const { parseConfigure, buildEncodeBuffers, decodeProtocol, receiveOne, check } = transport__default["default"];
const ONEKEY_FILTER = [
    { vendorId: 0x1209, productId: 0x53c0 },
    { vendorId: 0x1209, productId: 0x53c1 },
];
const CONFIGURATION_ID = 1;
const INTERFACE_ID = 0;
const ENDPOINT_ID = 1;
const PACKET_SIZE = 64;
const HEADER_LENGTH = 6;
class WebUsbTransport {
    constructor() {
        this.stopped = false;
        this.configured = false;
        this._lastDevices = [];
        this.configurationId = CONFIGURATION_ID;
        this.endpointId = ENDPOINT_ID;
        this.interfaceId = INTERFACE_ID;
    }
    init(logger) {
        this.Log = logger;
        const { usb } = navigator;
        if (!usb) {
            throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.RuntimeError, 'WebUSB is not supported by current browsers');
        }
        this.usb = usb;
    }
    configure(signedData) {
        const messages = parseConfigure(signedData);
        this.configured = true;
        this._messages = messages;
    }
    enumerate() {
        return __awaiter(this, void 0, void 0, function* () {
            const list = yield this._getDeviceList();
            return list;
        });
    }
    _getDeviceList() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.usb)
                return [];
            const devices = yield this.usb.getDevices();
            const chargerwalletDevices = devices.filter(dev => {
                const isChargerWallet = ONEKEY_FILTER.some(desc => dev.vendorId === desc.vendorId && dev.productId === desc.productId);
                const hasSerialNumber = typeof dev.serialNumber === 'string' && dev.serialNumber.length > 0;
                return isChargerWallet && hasSerialNumber;
            });
            this._lastDevices = chargerwalletDevices.map(device => ({
                path: device.serialNumber,
                device,
            }));
            return this._lastDevices;
        });
    }
    acquire(input) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!input.path)
                return;
            try {
                yield this.connect((_a = input.path) !== null && _a !== void 0 ? _a : '', true);
                return yield Promise.resolve(input.path);
            }
            catch (e) {
                this.Log.debug('acquire error: ', e);
                throw e;
            }
        });
    }
    _findDevice(path) {
        const device = this._lastDevices.find(d => d.path === path);
        if (device == null) {
            throw new Error('Action was interrupted.');
        }
        return device.device;
    }
    connect(path, first) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < 5; i++) {
                if (i > 0) {
                    yield new Promise(resolve => setTimeout(() => resolve(undefined), i * 200));
                }
                try {
                    return yield this._connectIn(path, first);
                }
                catch (e) {
                    if (i === 4) {
                        throw e;
                    }
                }
            }
        });
    }
    _connectIn(path, first) {
        return __awaiter(this, void 0, void 0, function* () {
            const device = yield this._findDevice(path);
            yield device.open();
            if (first) {
                yield device.selectConfiguration(this.configurationId);
                try {
                    yield device.reset();
                }
                catch (error) {
                }
            }
            yield device.claimInterface(this.interfaceId);
        });
    }
    call(path, name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._messages == null) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.TransportNotConfigured);
            }
            const device = yield this._findDevice(path);
            if (!device) {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.DeviceNotFound);
            }
            const messages = this._messages;
            if (transport.LogBlockCommand.has(name)) {
                this.Log.debug('call-', ' name: ', name);
            }
            else {
                this.Log.debug('call-', ' name: ', name, ' data: ', data);
            }
            const encodeBuffers = buildEncodeBuffers(messages, name, data);
            for (const buffer of encodeBuffers) {
                const newArray = new Uint8Array(PACKET_SIZE);
                newArray[0] = 63;
                newArray.set(new Uint8Array(buffer), 1);
                if (!device.opened) {
                    yield this.connect(path, false);
                }
                yield device.transferOut(this.endpointId, newArray);
            }
            const resData = yield this._receive(path);
            if (typeof resData !== 'string') {
                throw hdShared.ERRORS.TypedError(hdShared.HardwareErrorCode.NetworkError, 'Returning data is not string.');
            }
            const jsonData = receiveOne(messages, resData);
            return check.call(jsonData);
        });
    }
    _receive(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const device = yield this._findDevice(path);
            if (!device.opened) {
                yield this.connect(path, false);
            }
            const firstPacket = yield device.transferIn(this.endpointId, PACKET_SIZE);
            const firstData = (_a = firstPacket.data) === null || _a === void 0 ? void 0 : _a.buffer.slice(1);
            const { length, typeId, restBuffer } = decodeProtocol.decodeChunked(firstData);
            const lengthWithHeader = Number(length + HEADER_LENGTH);
            const decoded = new ByteBuffer__default["default"](lengthWithHeader);
            decoded.writeUint16(typeId);
            decoded.writeUint32(length);
            if (length) {
                decoded.append(restBuffer);
            }
            while (decoded.offset < lengthWithHeader) {
                const res = yield device.transferIn(this.endpointId, PACKET_SIZE);
                if (!res.data) {
                    throw new Error('no data');
                }
                if (res.data.byteLength === 0) {
                    console.warn('empty data');
                }
                const buffer = res.data.buffer.slice(1);
                if (lengthWithHeader - decoded.offset >= PACKET_SIZE) {
                    decoded.append(buffer);
                }
                else {
                    decoded.append(buffer.slice(0, lengthWithHeader - decoded.offset));
                }
            }
            decoded.reset();
            const result = decoded.toBuffer();
            return Buffer.from(result).toString('hex');
        });
    }
    release(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const device = yield this._findDevice(path);
            yield device.releaseInterface(this.interfaceId);
            yield device.close();
        });
    }
    requestDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.usb)
                return;
            try {
                const device = yield this.usb.requestDevice({ filters: ONEKEY_FILTER });
                return device;
            }
            catch (e) {
                this.Log.debug('requestDevice error: ', e);
            }
        });
    }
}

module.exports = WebUsbTransport;
