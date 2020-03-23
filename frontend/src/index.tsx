import { useState } from "react";
import React from "react";
import * as ReactDOM from "react-dom";
import { Machine } from 'xstate';
import { useMachine } from '@xstate/react';
import { SVGBox, ErrorMessage, Loading, Help } from './components';
import { useHover, useLocalStorage } from './hooks';
import { v4 as uuidv4 } from 'uuid';

async function deployDocker(template: string) {
    const response = await fetch(`/api/new?template=${template}`, {
        method: 'POST',
        headers: {'Accept': 'application/json',
                  'Content-Type': 'application/json'}
    });
    const contentType = response.headers.get("content-type");
    if (response.status == 200 && contentType && contentType != null && contentType.indexOf("application/json") !== -1) {
        try {
            return await response.json();
        } catch {
            return {reason: "Failed to parse returned JSON"};
        }
    } else {
        return {reason: response.statusText};
    }
}

function generateIdentifier() {
    return uuidv4();
}

async function deployAndRedirect(send, template: string) {
    const result = await deployDocker(template);
    if (result && result.status === "ok") {
        const uuid = result.uuid;
        if (uuid) {
            send("FETCH", {uuid: uuid});
            window.history.replaceState(null, "", `${window.location.pathname}?uuid=${uuid}`);
        } else {
            send("FAIL", {reason: "Missing id in returned response"});
        }
    } else {
        send("FAIL", {reason: result.reason});
    }
}

const lifecycle = Machine({
    id: 'lifecycle',
    initial: 'initial',
    states: {
        initial: {
          on: { LOAD: 'loading',
                FETCH: 'fetching',
                FAIL: 'error' }
        },
        loading: {
          on: { FETCH: 'fetching',
                FAIL: 'error' }
        },
        fetching: {
          on: { DONE: 'loaded',
                SLOW: 'slow',
                FAIL: 'error' }
        },
        slow: {
          on: { DONE: 'loaded',
                FAIL: 'error' }
        },
        loaded: {
          on: { RESTART: 'initial' }
        },
        error: {
          on: { RESTART: 'initial' }
        }
    }
});

function rejectAfterTimeout(ms: number) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

function App() {
    const [state, send] = useMachine(lifecycle);
    const [showHelp, setShowHelp] = useState(false);
    const [hoverRef, isHovered] = useHover();
    const [identifier, setIdentifier] = useLocalStorage("identifier");

    if (!identifier) {
        setIdentifier(generateIdentifier());
    }

    const uuid = new URLSearchParams(window.location.search).get("uuid");
    if (uuid) {
        send("FETCH", {uuid: uuid});
    }

    if (state.matches('fetching')) {
        document.body.classList.add("loading");
        var retries = 0;
        
        const id = setInterval(async () => {
            const url = `//${state.event.uuid}.${window.location.hostname}`;
            const response = await Promise.race([fetch(url).catch(() => {}), rejectAfterTimeout(5000)]);
            if (response != null && (response.status == 200 || response.status == 304)) {
                clearInterval(id);
                send("DONE", {url: url});
            } else {
                retries ++;
                if (retries == 30) {
                    send("SLOW");
                }
                if (retries > 300) {
                    clearInterval(id);
                    send("FAIL", {reason: "Failed to access the theia image in time"});
                }
            }
        }, 1000);
    }

    if (state.matches('loaded') || state.matches('error')) {
        document.body.classList.remove("loading");
    }

    // Landing page
    return (
    <React.Fragment>

        <Help open={showHelp} onClose={() => setShowHelp(false)} />

        {!state.matches('loaded') &&
            <SVGBox isHovered={isHovered} />
        }
        
        {state.matches('initial') &&
            <div className="box-fullscreen box-text">
                <div style={{fontSize: 20, fontWeight: "bold", color: "#FF1864",padding: "0.9em 2em 1em 3.3em", position: "fixed", top: 20, right: 20, cursor: "pointer"}}>
                    <span style={{padding: 10}} onClick={() => window.open("https://docs.google.com/forms/d/e/1FAIpQLSdXpq_fHqS_ow4nC7EpGmrC_XGX_JCIRzAqB1vaBtoZrDW-ZQ/viewform?edit_requested=true")}>Send Feedback</span>
                    <span onClick={() => setShowHelp(true)}>Help</span>
                </div>
                <h1>
                    Start hacking your substrate runtime in a web based VSCode like IDE
                </h1>
                <div ref={hoverRef} className="cta" onClick={() => {send("LOAD"); deployAndRedirect(send, "default")}}>
                    <span>Experiment!</span>
                </div>
            </div>
        }
        {(state.matches('loading') || state.matches('fetching') || state.matches('slow')) &&
            <Loading slow={state.matches('slow')} />
        }
        {state.matches('loaded') &&
            <div>
                <iframe src={state.event.url} onError={() => send("FAIL", {reason: "Failed to load theia"})} frameBorder="0" style={{overflow:"hidden",height:"100vh",width:"100vm"}} height="100%" width="100%"></iframe>
            </div>
        }

        {state.matches('error') &&
            <ErrorMessage state={state} send={send} />
        }
        </React.Fragment>
    );

}

ReactDOM.render(
    <App />,
    document.getElementById("root")
);
