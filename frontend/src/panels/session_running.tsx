import React, { useEffect, useRef, useState } from "react";
import Paper from '@mui/material/Paper';
import { Client } from '@substrate/playground-client';
import { CenteredContainer, ErrorMessage, Loading } from '../components';
import { fetchWithTimeout, sessionUrl } from '../utils';

interface Error {
    reason: string,
    action: () => void,
    actionTitle?: string,
}

interface Loading {
    phase: string,
    retry: number,
}

export function RunningSessionPanel({ client, autoDeploy, onMissingSession, onSessionFailing, onSessionTimeout }: { client: Client, autoDeploy: string | null, onMissingSession: () => void, onSessionFailing: () => void, onSessionTimeout: () => void }): JSX.Element {
    const maxRetries = 5*60;
    const ref = useRef(null);
    const [error, setError] = useState<Error>();
    const [url, setUrl] = useState<string>();
    const [loading, setLoading] = useState<Loading>();

    useEffect(() => {
        function createSession(id: string): void {
            client.createCurrentSession({template: id}).then(fetchData);
        }

        async function fetchData() {
            const session = await client.getCurrentSession();
            const phase = session?.pod.phase;
            if (session) {
                if (phase == 'Running') {
                    // Check URL is fine
                    const url = sessionUrl(session);
                    if (url) {
                        if ((await fetchWithTimeout(url)).ok) {
                            setUrl(url);
                            return;
                        }
                    }
                } else if (phase == 'Failed') {
                    setError({reason: session.pod.reason || 'Pod crashed', action: onSessionFailing});
                } else if (phase == 'Pending') {
                    const condition = session?.pod.conditions?.find(condition => {
                        if (condition.reason == "Unschedulable") {
                            return condition;
                        }
                    });
                    if (condition) {
                        setError({reason: condition.message || 'Pod failed to schedule', action: onSessionFailing});
                    }
                }
                // The repository is being deployed, nothing to do
            }

            const retry = loading?.retry ?? 0;
            if (retry < maxRetries) {
                setLoading({phase: phase || 'Unknown', retry: retry + 1});
                setTimeout(fetchData, 1000);
            } else if (retry == maxRetries) {
                setError({reason: "Couldn't access the session in time",
                          action: onSessionTimeout});
            }
        }

        // Entry point.
        // If autoDeploy, first attempt to locate the associated repository and deploy it.
        // In all cases, delegates to `fetchData`
        if (autoDeploy) {
            client.getRepository(autoDeploy).then(repository => {
                if (!repository) {
                    setError({reason: `Unknown repository ${autoDeploy}`,
                              action: onMissingSession});
                    return;
                }

                try {
                    client.getCurrentSession().then(session => {
                        if (session) {
                            setError({reason: "You can only have one active substrate playground session open at a time. \n Please close all other sessions to open a new one",
                                      action: () => {
                                          // Trigger current session deletion, wait for deletion then re-create a new one
                                          return client.deleteCurrentSession()
                                            .then(function() {
                                                return new Promise<void>(function(resolve) {
                                                    const id = setInterval(async function() {
                                                        const session = await client.getCurrentSession();
                                                        if (!session) {
                                                            clearInterval(id);
                                                            resolve();
                                                        }
                                                    }, 1000);
                                                }
                                            )})
                                            .then(() => setError(undefined))
                                            .then(() => createSession(autoDeploy));
                                      },
                                      actionTitle: "Replace existing session"});
                        } else {
                            createSession(autoDeploy);
                        }
                    })
                } catch {
                    setError({ reason: 'Error', action: onMissingSession});
                }
            });
        } else {
            fetchData();
        }
    }, []);

    if (url) {
        return <iframe ref={ref} src={url} frameBorder="0" width="100%" height="100%"></iframe>
    } else {
        return (
            <CenteredContainer>
                <Paper style={{ display: "flex", flexDirection: "column", height: "60vh", width: "60vw", justifyContent: "center"}} elevation={3}>
                    {error?.reason
                     ? <ErrorMessage reason={error.reason} action={error.action} actionTitle={error.actionTitle} />
                     : <Loading phase={loading?.phase} retry={loading?.retry} />}
                </Paper>
            </CenteredContainer>
        );
    }
}
