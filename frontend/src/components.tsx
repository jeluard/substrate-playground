import React, { useState } from "react";
import { useSpring, animated } from 'react-spring'
import { Alert, AlertTitle } from '@material-ui/lab';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import marked from 'marked';
import { useHover, useInterval, useWindowMaxDimension } from './hooks';
import { useLifecycle, checking, deploy, deploying, failed, initial, restart, show, stop } from './lifecycle';
import { useParams } from "react-router-dom";

export function Background({isHovered}: {isHovered: boolean}) {
    const blurFactor = isHovered ? 0 : 10;
    const dimension = useWindowMaxDimension();
    return (
        <React.Fragment>
            <div className="box-bg box-fullscreen bg-screen" style={{filter: `blur(${blurFactor}px)`}}></div>
            <div className="box-bg box-fullscreen">
                <div id="svgBox" className="box-svg" data-state={isHovered ? 2 : 1} style={{width: dimension, height: dimension}}>
                    <svg id="svg" width={dimension} height={dimension} viewBox="0 0 1535 1535" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 483.5H1535" stroke="#C4C4C4" strokeWidth="120"/>
                        <path d="M0 820H1535" stroke="#DBDCDC" strokeWidth="120"/>
                        <path d="M0 1363.5H1535" stroke="#DBDCDC" strokeWidth="120"/>
                        <path d="M0 130.5H1535" stroke="#FF1864"/>
                        <path d="M0 249.5H1535" stroke="#C4C4C4"/>
                        <path d="M0 397.5H1535" stroke="#FF1864"/>
                        <path d="M0 513.5H1535" stroke="#000000"/>
                        <path d="M0 620.5H1535" stroke="#C4C4C4"/>
                        <path d="M0 688.5H1535" stroke="#6E6E6E"/>
                        <path d="M0 756.5H1535" stroke="#FF1864"/>
                        <path d="M0 921.5H1535" stroke="#C4C4C4"/>
                        <path d="M0 850H1535" stroke="#FF1864"/>
                        <path d="M0 1097.5H1535" stroke="#000000"/>
                        <path d="M0 1196.5H1535" stroke="#C4C4C4"/>
                        <path d="M0 1253.5H1535" stroke="#FF1864"/>
                        <path d="M0 1273.5H1535" stroke="#FF1864"/>
                        <path d="M0 1293.5H1535" stroke="#C4C4C4"/>

                        <path d="M0 938.5H1535" stroke="#000000"/>
                        <path d="M0 738.5H1535" stroke="#FFFFFF"/>
                        <path d="M0 338.5H1535" stroke="#FF1864"/>
                    </svg>
                </div>
            </div>
        </React.Fragment>);
}

export function ErrorMessage({reason, onClick}: {reason?: string, onClick: () => void}) {
    return (
        <Alert severity="error" style={{padding: 20}}
                action={<Button onClick={onClick}>TRY AGAIN</Button>}>
            <AlertTitle>Oops! Looks like something went wrong :(</AlertTitle>
            <Box component="span" display="block">{reason}</Box>
        </Alert>
    );
}

const loadingPhrases = [
    'First, you take the dinglepop',
    'You smooth it out with a bunch of schleem',
    'The schleem is then repurposed for later batches',
    'Then you take the dinglebop and push it through the grumbo',
    "It's important that the fleeb is rubbed",
    'A Shlami shows up and he rubs it, and spits on it',
    "There's several hizzards in the way.",
    'The blaffs rub against the chumbles',
    'That leaves you with a regular old plumbus!']

function Phase( {value}: {value: string}) {
    switch (value) {
        case "Pending":
            return <div>Deploying image</div>;
        case "Running":
            return <div>Creating your custom domain</div>;
    }
    return null;
}

export function Loading({phase}: {phase?: string}) {
    const [phrase, setPhrase] = useState(loadingPhrases[0]);
    const [props, set] = useSpring(() => ({opacity: 1}));

    useInterval(() => {
        set({ opacity: 0 });

        setTimeout(function(){ setPhrase(loadingPhrases[Math.floor(Math.random()*loadingPhrases.length)]); }, 500);
        setTimeout(function(){ set({ opacity: 1 }); }, 1000);
    }, 3000);

    return (
        <div className="box-fullscreen box-text">
            <span>Please wait, because</span>
            <animated.h1 style={props}>{phrase}</animated.h1>
            {false &&
                <div>It looks like it takes longer than expected to load. Please be patient :)</div>}
            {phase &&
                <Phase value={phase} />}
        </div>
    );
}

export function TheiaPanel() {
    const { uuid } = useParams();
    const url = `//${uuid}.${window.location.hostname}`;
    // TODO handle loading and error handling
    return (
        <div>
            <iframe src={url} frameBorder="0" style={{overflow:"hidden",height:"100vh",width:"100vm"}} height="100%" width="100%"></iframe>
        </div>
    );
}

function Nav() {
    return (
        <div style={{fontSize: 20, fontWeight: "bold", color: "#FF1864",padding: "0.9em 2em 1em 3.3em", position: "fixed", top: 20, right: 20, cursor: "pointer"}}>
            <Button color="primary" variant="contained" style={{marginRight: 10}} onClick={() => window.open("https://docs.google.com/forms/d/e/1FAIpQLSdXpq_fHqS_ow4nC7EpGmrC_XGX_JCIRzAqB1vaBtoZrDW-ZQ/viewform?edit_requested=true")}>Send Feedback</Button>
        </div>
    );
}

function TemplateSelector({templates, hoverRef, onSelect, onErrorClick, onRetryClick, state}) {
    const [selection, select] = useState(templates[0]);
    const templatesAvailable = templates.length != 0;
    return (
    <Dialog
        open={true}
        scroll={"paper"}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
        maxWidth="md"
    >
        <DialogTitle id="scroll-dialog-title">Select a template</DialogTitle>
        <DialogContent style={{padding: 0}} dividers={true}>
            {state.matches(failed)
                ? <ErrorMessage reason={state.context.error} onClick={onRetryClick} />
                : (templatesAvailable
                    ? <div style={{display: "flex", flexDirection: "row", flex: 1, minHeight: 0}}>
                        <List style={{flex: 1, padding: 0, overflow: "auto"}}>
                            {templates.map((template, index: number) => (
                            <ListItem button key={index} onClick={() => select(template)}>
                                <ListItemText primary={template.name} />
                            </ListItem>
                            ))}
                        </List>
                        <Divider flexItem={true} orientation={"vertical"} light={true} />
                        {selection &&
                        <Typography component="div" style={{flex: 6, margin: 20, overflow: "auto", textAlign: "left"}}>
                            <div dangerouslySetInnerHTML={{__html:marked(selection.description)}}></div>
                        </Typography>}
                    </div>
                    : <ErrorMessage reason={"No template available"} onClick={onErrorClick} />
                )
            }
            
            
        </DialogContent>
        <DialogActions ref={hoverRef}>
            <Button onClick={() => onSelect(selection.name)} color="primary" variant="contained" disableElevation disabled={!templatesAvailable || state.matches(failed)}>
                Create
            </Button>
        </DialogActions>
    </Dialog>
    );
}

function EnvTable({envs}) {
    return (
    <TableContainer component={Paper}>
        <Table size="small" aria-label="a dense table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {envs.map((env) => (
              <TableRow key={env.name}>
                <TableCell component="th" scope="row">
                  {env.name}
                </TableCell>
                <TableCell align="right">{env.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
}

function PortsTable({ports}) {
    return (
    <TableContainer component={Paper}>
        <Table size="small" aria-label="a dense table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Path</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ports.map((port) => (
              <TableRow key={port.name}>
                <TableCell component="th" scope="row">
                  {port.name}
                </TableCell>
                <TableCell align="right">{port.path}</TableCell>
                <TableCell align="right">{port.port}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
}

function formatDate(t: number) {
    return new Date(t).toISOString();
}

function Instance({instance}) {
    const {instance_uuid, started_at, template, phase} = instance;
    const {name, runtime} = template;
    const {env, ports} = runtime;
    return (
    <Card style={{margin: 20}} variant="outlined">
        <CardContent>
            <Typography>
            {name} ({instance_uuid})
            </Typography>
            <Typography color="textSecondary" gutterBottom>
            Started at {formatDate(started_at.secs_since_epoch)}
            </Typography>
            <Typography color="textSecondary" gutterBottom>
            Phase: <em>{phase}</em>
            </Typography>
            <div style={{display: "flex", paddingTop: 20}}>
                <div style={{flex: 1, paddingRight: 10}}>
                    <Typography variant="h6" id="tableTitle" component="div">
                    Environment
                    </Typography>
                    <EnvTable envs={env} />
                </div>
                <div style={{flex: 1}}>
                    <Typography variant="h6" id="tableTitle" component="div">
                    Ports
                    </Typography>
                    <PortsTable ports={ports} />
                </div>
            </div>
        </CardContent>
    </Card>
    );
}

function ExistingInstances({instances, onStopClick, onConnectClick, hoverRef}) {
    const instance = instances[0]; // A single instance per user is supported for now
    return (
    <Dialog
        open={true}
        scroll={"paper"}
        aria-labelledby="scroll-dialog-title"
        aria-describedby="scroll-dialog-description"
    >
        <DialogTitle id="scroll-dialog-title">Running instance</DialogTitle>
        <DialogContent dividers={true}>
            <Instance instance={instance} />
        </DialogContent>
        <DialogActions ref={hoverRef}>
            <Button onClick={() => onStopClick(instance)} color="secondary" variant="outlined" disableElevation>
                Stop
            </Button>
            <Button onClick={() => onConnectClick(instance)} color="primary" variant="contained" disableElevation>
                Connect
            </Button>
        </DialogActions>
    </Dialog>
    );
}

export function MainPanel() {
    const [state, send] = useLifecycle();
    const [hoverRef, isHovered] = useHover<string>();

    const {instances, templates, phase} = state.context;
    return (
        <React.Fragment>
            <Background isHovered={isHovered} />

            <Nav />

            {(state.matches(initial) || state.matches(failed)) &&
                <div className="box-fullscreen box-text">
                    {instances?.length == 0
                        ? <TemplateSelector hoverRef={hoverRef} state={state} templates={templates} onRetryClick={() => send(restart)} onSelect={(template) => send(deploy, {template: template})} onErrorClick={() => send(restart)} />
                        : <ExistingInstances hoverRef={hoverRef} onConnectClick={(instance) => send(show, {instance: instance})} onStopClick={(instance) => send(stop, {instance: instance})} instances={instances} />
                    }
                </div>
            }

            {state.matches(deploying) || state.matches(checking) &&
                <Loading phase={phase} />
            }
        </React.Fragment>
    );
}