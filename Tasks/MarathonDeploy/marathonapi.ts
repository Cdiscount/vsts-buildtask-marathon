import request = require('request-promise-any');
import fs = require('fs');
import { MarathonConfig, OptionUrl } from './marathonconfig';



interface MarathonDeployment {
    deploymentId: string,
    version: string,
    message: string,
}

export class MarathonApi {
    static successEventName: string = 'containerDeployedSuccessful';
    config: MarathonConfig;
    containerIsRunning: boolean = false;
    constructor(conf: MarathonConfig) {
        this.config = conf;
    }

    public async sendToMarathon(): Promise<boolean> {
        const options = this.config.toOptions(OptionUrl.App);
        let app: any = undefined;
        try {
            let response = await request(options);
            app = JSON.parse(response);

        } catch (error) {
            if (this.config.failOnScaledTo0) {
                throw new Error('Application should fail on scale 0, but it does not exist.');
            } else if (error.statusCode && error.statusCode !== 404) {
                throw error;
            } else {
                console.log('Application does not exist. It will be created.');
            }
        }
        if (this.config.failOnScaledTo0 && (app && app.app.instances === 0)) {
            throw new Error("Application was previously scaled to 0. We won't override its config and won't restart it");
        }
        let deployment = await this.createOrUpdateApp(this.config.marathonFilePath);
        const isDeploymentLaunched = await this.isDeploymentLaunched(deployment);
        if (!isDeploymentLaunched) {
            deployment = await this.restartApp();
        }
        await this.checkContainerBoot(deployment);
        return await this.checkRunningVersion(deployment);

    }

    private async createOrUpdateApp(marathonFilePath: string): Promise<MarathonDeployment> {
        console.log("Creating or updating a given app. Put request with a given marathon json file.");
        const options = this.config.toOptions(OptionUrl.App);
        options.qs = { force: true }; //Query string data
        options.method = 'PUT';
        options.body = fs.createReadStream(marathonFilePath);
        const deploy = await request(options);
        return JSON.parse(deploy) as MarathonDeployment;
    }

    private async isDeploymentLaunched(deployment: MarathonDeployment): Promise<boolean> {
        console.log("Checking if deployment is running...");
        const options = this.config.toOptions(OptionUrl.Deployment);
        const runningDeployments = (await request(options)) as string;
        const typedDeployments = JSON.parse(runningDeployments) as any[];
        return typedDeployments.some(d => d.id === deployment.deploymentId);
    }

    private async restartApp(): Promise<MarathonDeployment> {
        console.log("Restart Application");
        const options = this.config.toOptions(OptionUrl.Restart);
        options.qs = { force: true }; //Query string data
        options.method = 'POST';
        const deploy = await request(options);
        return JSON.parse(deploy) as MarathonDeployment;
    }

    private checkContainerBoot(deployment: MarathonDeployment): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const start = new Date().getTime();
            let interval = setInterval(async () => {
                var deploymentRuns = await this.isDeploymentLaunched(deployment);
                var currentDate = new Date().getTime();
                if (!deploymentRuns) {
                    clearInterval(interval);
                    resolve(!deploymentRuns);
                }
                else if ((currentDate - start) > this.config.maxBootTimeInMilliseconds) {
                    clearInterval(interval);
                    console.error(`Container did not boot within ${this.config.maxBootTimeInMilliseconds}ms`);
                    reject(`Container did not boot within ${this.config.maxBootTimeInMilliseconds}ms`);
                }
            }, 1000);
        });
    }

    private async checkRunningVersion(deployment: MarathonDeployment): Promise<boolean> {
        const options = this.config.toOptions(OptionUrl.App);
        const response = await request(options);
        const typedResponse = JSON.parse(response);
        const deploymentSuccessful = (typedResponse.app.version === deployment.version);
        if (!deploymentSuccessful) {
            throw Error('Container version incorrect');
        } else {
            return deploymentSuccessful;
        }
    }
}