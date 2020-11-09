import { Polly, Timing } from '@pollyjs/core';
import FetchAdapter from '@pollyjs/adapter-fetch';

const description = `#frdsfd

* dsfds
* dsfdsf

* dsfds
* dsfdsf

* dsfds
* dsfdsf

* dsfds
* dsfdsf

dsfds dsfdsf dsf dsf dsf dsf dsf dsf dsfdsf dsf ds fds fdsf ds fds fds 

## erez`;
const runtime = {env: [{name: "SOME_ENV", value: "1234"}], ports: [{name: "web", protocol: "TCP", path: "/", port: 123, target: 123}]};
const build = {base: "", extensions: [{name: "", value: ""}], repositories: [{name: "", value: ""}], commands: [{name: "", run: "", working_directory: ""}]};
const template = {image: "paritytech/substrate-playground-template-base@sha256:0b3ec9ad567d0f5b0eed8a0fc2b1fa3fe1cca24cc02416047d71f83770b05e34", name: "Node Template", public: true, description: description, runtime: runtime, build: build};
const template_private = {image: "paritytech/substrate-playground-template-base@sha256:0b3ec9ad567d0f5b0eed8a0fc2b1fa3fe1cca24cc02416047d71f83770b05e34", name: "Node Template", public: false, description: description, runtime: runtime, build: build};
const url = "http://www.google.fr";
const pod = {version: "1.23", details: {status: {phase: "Running", startTime: "2020-05-15T14:06:18Z"}}};
const uuid = "1234";
const instance = {user_uuid: "", instance_uuid: uuid, template: template, pod: pod, url: url};

export function intercept({logged = false, noInstance = true, delay = 100}: {logged?: boolean, noInstance?: boolean, delay?: number}) {
  Polly.register(FetchAdapter);

  const polly = new Polly('Sign In', {
    adapters: ['fetch'],
    logging: false,
  });
  const { server } = polly;
  server.get(url).intercept(async (req, res) => {
    await server.timeout(delay);
    res.status(200);
  });
  server.get('/theia').intercept(async (req, res) => {
    await server.timeout(delay);
    res.status(200);
  });
  server.get('/api/').intercept(async (req, res) => {
    await server.timeout(delay);
    let templates = {workshop: template_private, workshop2: template, workshop3: template, workshop4: template, workshop5: template, workshop6: template, workshop7: template};
    let user = logged ?
      {
        username: 'john',
        parity: true,
        admin: true
      } : null;
    res.status(200).json({result: {
      templates: templates,
      instance: instance,
      "all_instances": {"instance1": instance,
                        "instance2": instance,
                        "instance3": instance,
                        "instance4": instance,
                        "instance5": instance},
      user: user
    }});
  });
  server.delete('/api/').intercept(async (req, res) => {
    await server.timeout(delay);
    res.status(200).json({
      result: null,
    });
  });
  server.post('/api/?template=:template').intercept(async (req, res) => {
    await server.timeout(delay);
    res.status(200).json({
      result: uuid,
    });
  });
}