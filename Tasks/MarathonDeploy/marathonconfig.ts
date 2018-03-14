import { Options as requestOptions } from "request";

export enum OptionUrl {
    App,
    Deployment,
    Restart,
}

export class MarathonConfig {
    constructor(debugLogger: Function | null) {
        this.logger = console.info;
        if (debugLogger) {
            this.logger = debugLogger;
        }
    }
    logger: any;
    baseUrl: string;
    identifier: string;
    marathonUser: string;
    marathonPassword: string;
    useBasicAuthentication: boolean;
    marathonFilePath: string;
    failOnScaledTo0: boolean;
    strictSSL: boolean;
    maxBootTimeInMilliseconds: number;

    /* Creates the deployment options for a marathon API */
    toOptions(urlType: OptionUrl): requestOptions {
        const options: requestOptions = {
            url: this.getUrl(urlType),
            strictSSL: true,
            method: 'GET',
            headers: {
                'content-type': 'application/json'
            },
        }
        if (this.strictSSL === false) {
            options.strictSSL = false;
        }
        if (this.useBasicAuthentication) {
            options.auth = {
                user: this.marathonUser,
                pass: this.marathonPassword
            };
        }
        this.logger(`Marathon Settings : ${JSON.stringify(options).replace(new RegExp(this.marathonPassword, 'g'), 'PASSWORD')}`);
        return options;
    }

    getUrl(urlType: OptionUrl): string {
        let url = '';
        switch (urlType) {
            case OptionUrl.Deployment: {
                url = this.getDeployPath();
                break;
            }
            case OptionUrl.Restart: {
                url = this.getRestartPath();
                break;
            }
            default: {
                url = this.getAppPath();
                break;
            }
        }
        return url.replace(/\/\//g, '/').replace(':/', '://');
    }


    getAppPath(): string {
        return `${this.baseUrl}/v2/apps/${this.identifier}`;
    }

    getDeployPath(): string {
        return `${this.baseUrl}/v2/deployments`;
    }

    getRestartPath(): string {
        return `${this.baseUrl}/v2/apps/${this.identifier}/restart`;
    }
}