import * as transport from '@chargerwallet/hd-transport';
import transport__default, { AcquireInput } from '@chargerwallet/hd-transport';

declare class WebUsbTransport {
    _messages: ReturnType<typeof transport__default.parseConfigure> | undefined;
    stopped: boolean;
    configured: boolean;
    Log?: any;
    usb?: USB;
    _lastDevices: Array<{
        path: string;
        device: USBDevice;
    }>;
    configurationId: number;
    endpointId: number;
    interfaceId: number;
    init(logger: any): void;
    configure(signedData: any): void;
    enumerate(): Promise<{
        path: string;
        device: USBDevice;
    }[]>;
    _getDeviceList(): Promise<{
        path: string;
        device: USBDevice;
    }[]>;
    acquire(input: AcquireInput): Promise<string | undefined>;
    _findDevice(path: string): USBDevice;
    connect(path: string, first: boolean): Promise<void>;
    _connectIn(path: string, first: boolean): Promise<void>;
    call(path: string, name: string, data: Record<string, unknown>): Promise<transport.MessageFromChargerWallet>;
    _receive(path: string): Promise<string>;
    release(path: string): Promise<void>;
    requestDevice(): Promise<USBDevice | undefined>;
}

export { WebUsbTransport as default };
