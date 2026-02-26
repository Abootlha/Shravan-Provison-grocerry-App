declare module 'html5-qrcode' {
    export interface Html5QrcodeConfig {
        fps?: number;
        qrbox?: number | { width: number; height: number };
        aspectRatio?: number;
        disableFlip?: boolean;
        verbose?: boolean;
    }

    export interface CameraDevice {
        id: string;
        label: string;
    }

    export class Html5Qrcode {
        constructor(elementId: string, verbose?: boolean);

        start(
            cameraIdOrConfig: string | { facingMode: string },
            config: Html5QrcodeConfig,
            qrCodeSuccessCallback: (decodedText: string, result?: any) => void,
            qrCodeErrorCallback?: (errorMessage: string, error?: any) => void
        ): Promise<void>;

        stop(): Promise<void>;
        clear(): void;

        static getCameras(): Promise<CameraDevice[]>;
    }

    export class Html5QrcodeScanner {
        constructor(
            elementId: string,
            config: Html5QrcodeConfig,
            verbose?: boolean
        );

        render(
            qrCodeSuccessCallback: (decodedText: string, result?: any) => void,
            qrCodeErrorCallback?: (errorMessage: string, error?: any) => void
        ): void;

        clear(): Promise<void>;
    }
}
