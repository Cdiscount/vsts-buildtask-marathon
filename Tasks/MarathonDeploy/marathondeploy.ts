import fs = require('fs');
import tl = require('vsts-task-lib');
import { MarathonConfig } from './marathonconfig';
import { MarathonApi } from './marathonapi';

class Main {
    run() {
        try {
            let config = this.initializeMarathonConfig();
            // will error and fail task if it doesn't exist
            tl.checkPath(config.marathonFilePath, 'jsonFilePath');
            tl._writeLine(`marathon.json file path: ${config.marathonFilePath}`);
            // if identifier not passed in parameter, read it from marathon.json
            if (!config.identifier) {
                let marathonJsonContent = fs.readFileSync(config.marathonFilePath);
                let marathonJson = JSON.parse(marathonJsonContent.toString());
                config.identifier = marathonJson.id;
            }
            // identifier not found , throw exception
            if (!config.identifier) {
                throw new Error("Application id not found.");
            }

            let marathonApi = new MarathonApi(config);
            marathonApi.sendToMarathon().then(d => {
                if (d) {
                    tl._writeLine("Deployment Succeeded.");
                    tl.setResult(tl.TaskResult.Succeeded, "Deployment Succeeded.");
                } else {
                    tl.setResult(tl.TaskResult.Failed, `Container did not boot.`);
                }
            }).catch(err => {
                console.error(err);
                if (err && err.statusCode === 401) {
                    tl.setResult(tl.TaskResult.Failed, `You are not allowed to access marathon.`);
                } else if (err && err.statusCode === 403) {
                    tl.setResult(tl.TaskResult.Failed, `You are not allowed to manage this app.`);
                } else if (err && err.statusCode) {
                    tl.setResult(tl.TaskResult.Failed, `API error occurred. Check your configuration.`);
                } else {
                    tl.setResult(tl.TaskResult.Failed, err);
                }
            });
        }
        catch (err) {
            tl.error(err);
            tl.setResult(tl.TaskResult.Failed, 'General error occurred. Check your configuration.');
        }
    }

    initializeMarathonConfig(): MarathonConfig {
        //Injecting the debug logger
        let config = new MarathonConfig(tl.debug);
        let marathonEndpoint = tl.getInput('marathonEndpoint', true);
        config.baseUrl = tl.getEndpointUrl(marathonEndpoint, false);
        config.marathonUser = tl.getEndpointAuthorizationParameter(marathonEndpoint, "username", true);
        config.marathonPassword = tl.getEndpointAuthorizationParameter(marathonEndpoint, "password", true);
        config.useBasicAuthentication = false;
        if (config.marathonUser != null || config.marathonPassword != null) {
            config.useBasicAuthentication = true;
            if (config.marathonUser == null) {
                // PAT is set into password var
                config.marathonUser = "";
            }
        }

        config.identifier = tl.getInput('identifier', false);
        config.marathonFilePath = tl.getPathInput('jsonFilePath', false);
        config.failOnScaledTo0 = tl.getBoolInput('failOnScaledTo0', false);
        config.strictSSL = tl.getBoolInput('verifySSL', true);
        config.maxBootTimeInMilliseconds = parseInt(tl.getInput('maxContainerBootTime', true), 10) * 1000;
        tl._writeLine(`Configuration: ${JSON.stringify(config)}`);
        return config;

    }
}

new Main().run();