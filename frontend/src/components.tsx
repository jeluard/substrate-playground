import React, { useState } from "react";
import { useSpring, animated } from 'react-spring'
import { Alert, AlertTitle } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from "@mui/material/Container";
import Fade from '@mui/material/Fade';
import CloseIcon from '@mui/icons-material/Close';
import GitHubIcon from '@mui/icons-material/GitHub';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Snackbar from "@mui/material/Snackbar";
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Configuration, LoggedUser } from "@substrate/playground-client";
import { useInterval } from './hooks';
import { Params } from "./index";
import { LogoSubstrate } from "./LogoSubstrate";

function ErrorMessageAction({action, actionTitle = "TRY AGAIN"}: {action: (() => void) | (() => Promise<void>), actionTitle?: string}): JSX.Element {
    const [executing, setExecuting] = useState(false);
    return (
        <Button disabled={executing}
                onClick={() => {
                    const res = action();
                    if (res instanceof Promise) {
                        setExecuting(true);
                        res.finally(() => setExecuting(false));
                    }
                }}>
            {executing &&
              <CircularProgress style={{marginRight: 10}} size={20} />}
            {actionTitle}
        </Button>
    );
}

export function ErrorMessage({ title = "Oops! Looks like something went wrong :(", reason, action, actionTitle }: { title?: string, reason?: string, action: (() => void) | (() => Promise<void>), actionTitle?: string}): JSX.Element {
    return (
        <Alert severity="error" style={{ margin: 20, alignItems: "center" }}
            action={<ErrorMessageAction action={action} actionTitle={actionTitle} />}>
            <AlertTitle style={{margin: "unset"}}>{title}</AlertTitle>
            {reason &&
              <Box component="span" display="block">{reason}</Box>}
        </Alert>
    );
}

export function ErrorSnackbar({ message, open, onClose }: { message: string, open: boolean, onClose: () => void }): JSX.Element {
    return (
        <Snackbar
            anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
            }}
            open={open}
            onClose={onClose}
            autoHideDuration={6000}
            message={message}
            action={
                <>
                  <IconButton size="small" aria-label="close" color="inherit" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </>
              }>
            <Alert onClose={onClose} severity="error">
                {message}
            </Alert>
        </Snackbar>
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

function Phase({ value }: { value: string }): JSX.Element {
    switch (value) {
        case "Preparing":
            return <div>Preparing...</div>;
        case "Pending":
            return <div>Deploying image</div>;
        case "Running":
            return <div>Creating your custom domain</div>;
        default:
            return <></>;
    }
}

export function Loading({ phase, retry = 0 }: { phase?: string, retry?: number }): JSX.Element {
    const [phrase, setPhrase] = useState(loadingPhrases[0]);
    const [props, spring] = useSpring(() => ({ opacity: 1 }));

    useInterval(() => {
        spring.update({ opacity: 0 });

        setTimeout(function () { setPhrase(loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)]); }, 500);
        setTimeout(function () { spring.update({ opacity: 1 }); }, 1000);
    }, 3000);

    return (
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", flexDirection: "column", textAlign: "center" }}>
            <Typography variant="h3">Please wait, because</Typography>
            <animated.h1 style={props}>{phrase}</animated.h1>
            {(retry > 10) &&
                <div>It looks like it takes longer than expected to load. Please be patient :)</div>}
            {phase
              ? <Phase value={phase} />
              : <CircularProgress size={20} />}
        </div>
    );
}

export function NavSecondMenuAdmin({ onStatsClick, onAdminClick }: { onStatsClick: () => void, onAdminClick: () => void }): JSX.Element {
    const [anchorElAdmin, setAnchorElAdmin] = React.useState<null | HTMLElement>(null);
    const openAdmin = Boolean(anchorElAdmin);
    const handleMenuAdmin = (event: React.MouseEvent<HTMLElement>) => setAnchorElAdmin(event.currentTarget);
    const handleCloseAdmin = () => setAnchorElAdmin(null);
    return (
        <div style={{paddingLeft: 12}}>
            <IconButton
                aria-label="account of current user"
                aria-controls="menu-admin"
                aria-haspopup="true"
                onClick={handleMenuAdmin}
                color="inherit"
                size="small"
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
                id="menu-admin"
                anchorEl={anchorElAdmin}
                anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
                }}
                open={openAdmin}
                onClose={handleCloseAdmin}
            >
                <MenuItem onClick={async () => {handleCloseAdmin(); onStatsClick();}}>STATS</MenuItem>
                <MenuItem onClick={async () => {handleCloseAdmin(); onAdminClick();}}>ADMIN</MenuItem>
            </Menu>
        </div>
    );
}

export function NavMenuUnlogged(): JSX.Element {
    return (
        <div style={{paddingLeft: 12}}>
            <IconButton
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                color="inherit"
                size="small"
            >
                <Avatar alt="Not logged">
                    <GitHubIcon />
                </Avatar>
            </IconButton>
        </div>
    );
}

export function NavMenuLogged({ conf, user, onLogout }: { conf: Configuration, user: LoggedUser, onLogout: () => void}): JSX.Element {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    return (
        <div style={{paddingLeft: 12}}>
                <IconButton
                    aria-label="account of current user"
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleMenu}
                    color="inherit"
                    size="small"
                >
                    <Avatar alt={user.id} src={`https://github.com/${user.id}.png`} />
                </IconButton>
                <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                    }}
                    open={open}
                    onClose={handleClose}
                >
                    <MenuItem onClick={() => window.open("https://github.com/paritytech/substrate-playground/discussions")}>FEEDBACK</MenuItem>
                    <MenuItem onClick={() => window.open(`https://github.com/settings/connections/applications/${conf.githubClientId}`)}>GITHUB APPLICATION</MenuItem>

                    <MenuItem onClick={async () => {handleClose(); onLogout()}}>LOGOUT</MenuItem>
                </Menu>
            </div>
    );
}

export function Nav({ onPlayground, children }: { onPlayground: () => void, children?: React.ReactElement }): JSX.Element {
    return (
        <AppBar style={{ padding: "2rem", borderBottom: "1px solid" }} position="sticky" color="transparent" elevation={1}>
            <Toolbar style={{ justifyContent: "space-between" }} variant="dense">
                <LogoSubstrate theme={true} onClick={onPlayground} />
                {children}
            </Toolbar>
        </AppBar>
    );
}

export function Wrapper({ params, thin = false, children, nav}: { params: Params, thin?: boolean, children: React.ReactElement, nav?: React.ReactElement}): JSX.Element {
    return (
        <div style={{display: "flex", flexDirection: "column", width: "inherit", height: "inherit"}}>

            {nav}

            <Fade in appear>
                <div>
                  {children}
                </div>
            </Fade>

            {!thin &&
            <Container style={{display: "flex", justifyContent: "space-between", alignItems: "center"}} component="footer" maxWidth={false}>
                <Typography color="textSecondary">
                    {params.base != "/api" &&
                    <>Connected to {params.base}</>}
                </Typography>
                <Link
                    href="https://www.parity.io/privacy/"
                    rel="noreferrer"
                    variant="inherit"
                    style={{ margin: 15 }}>
                    Privacy Policy
                </Link>
                <Typography color="textSecondary">
                    #{params.version || 'UNKNOWN'}
                </Typography>
            </Container>}

        </div>
    );
}

export function LoadingPanel(): JSX.Element {
    return (
        <CenteredContainer>
            <Typography style={{margin: 20}} variant="h6">
                Loading
            </Typography>
            <CircularProgress />
        </CenteredContainer>
    );
}

export function CenteredContainer({ children }: { children: NonNullable<React.ReactNode> }): JSX.Element {
    return (
        <Container style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            {children}
        </Container>
    );
}
