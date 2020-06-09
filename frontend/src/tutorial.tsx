import React, { useEffect, useState } from "react";
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import marked from 'marked';
import { Container } from "@material-ui/core";
import { deployInstance, getUserDetails } from "./api";
import { executeCommand, startNode, gotoLine, moveCursor } from "./commands";
import { TheiaInstance } from "./components";
import { Discoverer } from "./connect";

import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepContent from '@material-ui/core/StepContent';

import Skeleton from '@material-ui/lab/Skeleton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
    },
    button: {
      marginTop: theme.spacing(1),
      marginRight: theme.spacing(1),
    },
    actionsContainer: {
      marginBottom: theme.spacing(2),
    },
    resetContainer: {
      padding: theme.spacing(3),
    },
  }),
);

function createSteps(instance) {
  const url = `wss://${instance.uuid}.playground-staging.substrate.dev/wss`;
  return [
      {label: 'Launch your instance',
       content: `First start by launching your instance in a personal instance`,
       actions: {launch: () => executeCommand(instance, "substrate.startNode", "/home/substrate/workspace/substrate-node-template")}},
      {label: 'Access via PolkadotJS',
       content: `Use PolkadotJS Apps to interact with your chain.`,
       actions: {open: () => window.open(`https://polkadot.js.org/apps/?rpc=${url}`)}},
      {label: 'Add a new pallet dependency',
       content: `Using the nice integrated view`},
      {label: 'Relaunch your instance',
       content: `Stop and restart your instance. See how changes are reflected`,
       actions: {launch: () => executeCommand(instance, "substrate.startNode", "/home/substrate/workspace/substrate-node-template")}}];
}

function VerticalLinearStepper({ uuid }) {
    const classes = useStyles();
    const [activeStep, setActiveStep] = useState(0);
    const [steps, setSteps] = useState([]);

    useEffect(() => {
        const discoverer = new Discoverer(instance => {
          setSteps(createSteps(instance));
        }, null);
        return () => discoverer.close();
      }, []);
  
    const handleNext = () => {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };
  
    const handleBack = () => {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };
  
    const handleReset = () => {
      setActiveStep(0);
    };
  
    if (steps.length == 0) {
      return (
        <div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
          <CircularProgress />
        </div>
      );
    } else {
      return (
        <div className={classes.root}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map(({label, content, next, back, actions}, index) => (
              <Step key={index}>
                <StepLabel>{label}</StepLabel>
                <StepContent>
                  <Typography>
                  <span dangerouslySetInnerHTML={{__html:marked(content)}}></span>
                  </Typography>
                  {actions &&
                  <div className={classes.actionsContainer}>
                    <div>
                      {Object.entries(actions).map((o, index) => (
                      <Button
                        key={index}
                        onClick={o[1]}
                        className={classes.button}
                      >
                        {o[0]}
                      </Button>
                      ))
                      }
                    </div>
                  </div>
                  }
                  <div className={classes.actionsContainer}>
                    <div>
                      <Button
                        disabled={activeStep === 0}
                        onClick={() => {handleBack(); if (back) back();}}
                        className={classes.button}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {handleNext(); if (next) next();}}
                        className={classes.button}
                      >
                        {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                      </Button>
                    </div>
                  </div>
                </StepContent>
              </Step>
            ))}
          </Stepper>
          {steps && (activeStep === steps.length) && (
            <Paper square elevation={0} className={classes.resetContainer}>
              <Typography>Congrats, you're done!</Typography>
              <Button onClick={handleReset} className={classes.button}>
                Restart
              </Button>
            </Paper>
          )}
        </div>
      );
    }
  }

const template = "workshop";

function Cartouche({children}) {
    return (
    <Paper style={{display: "flex", flex: 1, alignItems: "center"}}>
        <div style={{display: "flex", flex: 1, alignItems: "center", justifyContent: "center", height: "50vh"}}>
            {children}
        </div>
    </Paper>
    );
}

function TutorialController({uuid}) {
    return (
      <div style={{display: "flex", flex: 1, alignItems: "center", justifyContent: "center"}}>
        <div style={{flex: 1}}>
            <VerticalLinearStepper uuid={uuid} />
        </div>
        <div style={{flex: 2, margin: 20, height: "50vh"}}>
            <TheiaInstance uuid={uuid} />
        </div>
      </div>
    );
}

function Media() {
  return (
    <Card style={{width: "30vw", height: "30vh"}}>
      <CardHeader
        avatar={<Skeleton animation="wave" variant="circle" width={40} height={40} />}
        title={<Skeleton animation="wave" height={10} width="80%" style={{ marginBottom: 6 }} />}
        subheader={<Skeleton animation="wave" height={10} width="40%" />}
      />
      <Skeleton animation="wave" variant="rect" height={80} />
      <CardContent>
        <React.Fragment>
          <Skeleton animation="wave" height={10} style={{ marginBottom: 6 }} />
          <Skeleton animation="wave" height={10} width="80%" />
        </React.Fragment>
      </CardContent>
    </Card>
  );
}

export function TutorialPanel() {
    const [instanceUUID, setInstanceUUID] = useState(null);
    useEffect(() => {
        async function fetchData() {
            const { result, error } = await getUserDetails(localStorage.getItem("userUUID"));
            if (error) {
                // This instance doesn't exist
                return;
            }

            const instance = result[0];
            if (instance?.template?.name == template) {
              // TODO handle errors
              setInstanceUUID(instance.instance_uuid);
            }
        }

        fetchData();
      }, []);

    async function createInstance() {
        const {result, error} = await deployInstance(localStorage.getItem("userUUID"), template);
        if (result) {
          setInstanceUUID(result);
        }
    }

    return (
      <div style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", margin: 20}}>
        <Media />
        <div style={{width: "100%", margin: 40}}>
          {instanceUUID ?
          <TutorialController uuid={instanceUUID} />
          :
          <Cartouche>
              <Container style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"}}>
                  <Typography>Want to give it a try?</Typography>
                  <Button onClick={createInstance}>GO</Button>
              </Container> 
          </Cartouche>
          }
        </div>
        <Media />
      </div>
      );
}
