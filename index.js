const inquirer = require('inquirer');
const program = require('commander');
const fs = require('fs');
const path = require('path');
const os = require('os');

const gitUrl = 'https://sstdev.visualstudio.com/DefaultCollection/Backbone/_git/';
//const vsCodeExePath = 'C:/Program Files/Microsoft VS Code/code';
const vsCodeExePath = path.join(os.homedir(), '/AppData/Local/Programs/Microsoft VS Code/Code.exe');
const conEmuDirectory = 'C:/Program Files/ConEmu';
const conEmuExe = 'ConEmu64.exe';
const bbDirectory = 'C:/code/strategic/backbone';

const siloPath = bbDirectory+'/silos';
const libraryPath = bbDirectory+'/Libraries';
const devicesPath = bbDirectory+'/devices';
const infraPath = bbDirectory+'/infra';
const toolsPath = bbDirectory+'/tools';
const useCasePath = bbDirectory+'/useCase';
const siloPackagePath = bbDirectory+'/silos/silo_ui/packages';

const commandAvailable = [
    {
        name: 'clone',
        short: 'c',
        description: 'Clone',
        path: bbDirectory
    },
    {
        name: 'silo',
        short: 's',
        description: 'Open a silo.',
        path: siloPath
    },
    {
        name: 'siloPackage',
        short: 'sp',
        description: 'Open a silo package.',
        path: siloPackagePath
    },
    {
        name: 'useCase',
        short: 'u',
        description: 'Open a use case.',
        path: useCasePath
    },
    {
        name: 'tool',
        short: 't',
        description: 'Open a tool.',
        path: toolsPath
    },
    {
        name: 'infra',
        short: 'i',
        description: 'Open an infrastructure.',
        path: infraPath
    },
    {
        name: 'library',
        short: 'l',
        description: 'Open a library.',
        path: libraryPath
    },
    {
        name: 'device',
        short: 'd',
        description: 'Open a device.',
        path: devicesPath
    },
    {
        name: 'killPort',
        short: 'kp',
        description: 'Kill a process using a port.'
    }
];

const getSubDirectories = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory())

program
    .version('1.0.0');

// thingsToOpen.forEach(t=>{
//     program.option(`${t.name}, ${t.short} <selector>`, t.description);
// })

program
    .arguments('<cmd> [selector]')
    .option('-v --vscode', 'Open in VS Code too.')
    .option('-b --bash', 'Open in Bash.')
    .action(function(cmd, selector){
        let commandToRun = commandAvailable.find(t=>t.name === cmd);
        if (!commandToRun) {
            commandToRun = commandAvailable.find(t=>t.short === cmd);
        }
        if (!commandToRun) {
            console.error(cmd, ' is not a valid command');
        }

        if (commandToRun.short === 'c') {
            return clone(selector);
        }
        if (commandToRun.short === 'kp') {
            return killProcess(selector);
        }

        let dirs = getSubDirectories(commandToRun.path);
        let selectedSubdirectories = dirs.filter(d=>d.includes(selector));
        const openBash = !!program.bash;
        if (selectedSubdirectories.length === 0) {
            console.log(selector, ' not found.');
        } else if (selectedSubdirectories.length === 1) {
            return openThing(commandToRun, selectedSubdirectories[0], openBash);
        } else {
            inquirer.prompt([{
                type: 'list',
                name: 'whichThing',
                message: `Which ${commandToRun.name} do you want?`,
                choices: selectedSubdirectories
            }]).then(answers=>{
                return openThing(commandToRun, answers.whichThing, openBash);
            })
        }
    })
    .parse(process.argv);


function clone(selector) {
    let [type] = selector.split('_');
    let subPath = {
        'silo': 'silos',
        'lib': 'libraries',
        'device': 'devices',
        'infra': 'infra',
        'tool': 'tools',
        'uc': 'useCase'
    }[type];
    let shortCmd = {
        'silo': 's',
        'lib': 'l',
        'device': 'd',
        'infra': 'i',
        'tool': 't',
        'uc': 'u'
    }[type];
    const absolutePath = path.join(bbDirectory, subPath);
    const url = gitUrl+selector;
    return spawn('git', ['clone', url], absolutePath).then(()=>{
        return openThing({ path: absolutePath}, selector);
    });
}

function openThing(thing, selectedSubDirectory, openBash) {
    let thingPath = path.join(thing.path, selectedSubDirectory);
    if (program.vscode) {
        return spawn(vsCodeExePath, ['.'], thingPath).then(()=>{
            return conEmu(thingPath, openBash);
        });
    } else {
        return conEmu(thingPath, openBash);
    }
}

function conEmu(pathToOpen, openBash) {
    if (openBash) {
        return spawn(path.join(conEmuDirectory, conEmuExe), ['-Dir', pathToOpen, '-run', '{Bash::Git bash}', '-new_console'], conEmuDirectory);
    } else {
        return spawn(path.join(conEmuDirectory, conEmuExe), ['-Dir', pathToOpen, '-run', '{Shells::PowerShell}', '-new_console'], conEmuDirectory);
    }
}

function killProcess(port){
    console.log('Trying to kill process with port ' + port);
    let command = `(Get-Process -PID (Get-NetTCPConnection | ? {($_.State -eq "Listen") -and ($_.LocalPort -eq ${port})}).OwningProcess) | Stop-Process -Force`;
    return spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Unrestricted', '-Command', command]);
}

function spawn(pathToExe, args, cwd = os.tmpdir()) {
    return new Promise((resolve, reject) => {
        let spawn = require('child_process').spawn;
        let spawnedProcess = spawn(pathToExe, args, { cwd });

        spawnedProcess.stdout.on('data', function (data) {
            console.log(data.toString());
        });

        spawnedProcess.stderr.on('data', function (data) {
            console.log(data.toString());
        });

        spawnedProcess.on('exit', function (code) {
            console.log(`child process exited with code ${code.toString()}`);
            if (code !== 0) {
                console.log(`Failing executable was: ${pathToExe}.`);
                console.log(`Active directory was ${cwd}.`);
                console.log(`Failure arguments are: ${JSON.stringify(args)}.`)
                reject();
            } else {
                resolve();
            }
        });
    });
}