require('dotenv').config();
require('./logger');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { renderSubtitles, getClipDuration } = require('./SubtitlesApp'); 
const { exec } = require('child_process');

const currentScript = `main.js`;
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';

let mainWindow;

const currentFile = {
  stats: null,
  dirname: null,
  filename: null,
  filenameExt: null,
  fullpath: null,
  extname: null,
};

const renders = new Map();


const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1920,// 1280,
    height: 1080,// 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true, // чтобы можно было использовать ipcRenderer в рендер-процессе
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  //mainWindow.webContents.openDevTools();
  
  mainWindow.loadFile('index.html');

  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  try {
    const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Команда для завершения процесса FFmpeg на Windows
    exec('taskkill /F /IM ffmpeg.exe', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error killing FFmpeg processes on Windows: ${error.message}`);
      } else {
        console.log('FFmpeg processes on Windows terminated successfully.');
      }
    });
  } else {
    // Команда для завершения процесса FFmpeg на Unix-подобных системах
    exec('pkill -f ffmpeg', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error killing FFmpeg processes on Unix: ${error.message}`);
      } else {
        console.log('FFmpeg processes on Unix terminated successfully.');
      }
    });
  }
  } catch (error) {
    console.error(`Error while <app.on('before-quit')> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
})

// Обработка события из рендер-процесса
ipcMain.on('file-dropped', (event, fullpath) => {
  console.log('Get filepath:', fullpath);

  const stats = fs.statSync(fullpath);
  const dirname = path.dirname(fullpath);
  const filenameExt = path.basename(fullpath);
  const extname = path.extname(fullpath);
  const filename = path.basename(fullpath, extname);

  currentFile.fullpath = fullpath;
  currentFile.stats = stats;
  currentFile.dirname = dirname;
  currentFile.filename = filename;
  currentFile.filenameExt = filenameExt;
  currentFile.extname = extname;
  currentFile.subtitleFilename = `${filename}.vtt`;
});

const onRendersChanged = () => {
  // console.log([...renders])
  // mainWindow.webContents.send('renders', {renders});
  mainWindow.webContents.send('renders', {renders: [...renders].map((render) => {
    return {
      filename: render[1].filename,
      progress: render[1].progress,
      fullpath: render[1].fullpath,
    };
  }), currentFile});
};
const sendErrorToClient = (error) => {
  mainWindow.webContents.send('alert-error', error);
};


const createVtt = async (vtt) => {
  try {
    if (currentFile.fullpath === null) throw new Error(`Current file required.`);
    const { dirname, subtitleFilename } = currentFile;
    const vttPath = path.join(dirname, subtitleFilename);
    fs.writeFileSync(vttPath, vtt, 'utf-8');
    return;
  } catch (error) {
    console.error(`Error while <createVtt> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};
const runRenderingSubtitles = async () => {
  try {
    if (currentFile.fullpath === null) throw new Error(`Current file required.`);
    
    const { fullpath, dirname, filename, filenameExt, extname, subtitleFilename } = currentFile;
    const duration = await getClipDuration(ffprobePath, fullpath, false);
    const progress = { duration, currentTime: 0, percentage: 0 };
    const outFilename = `sub-${filename}`;
    const {emitter, encoding} = await renderSubtitles(ffmpegPath, dirname, filenameExt, subtitleFilename, outFilename, duration);
    const currentRender = { filename, progress, fullpath, encoding };
    renders.set(fullpath, currentRender);
    onRendersChanged();
    const onProgress = ({ currentTime, percentage }) => {
      progress.percentage = percentage;
      progress.currentTime = currentTime;
      onRendersChanged();
    };
    const onError = (error) => {
      console.log({error});
      sendErrorToClient(error);
    };
    const onEnd = () => {
      renders.delete(fullpath);
      onRendersChanged();
    };
    emitter.on('progress', onProgress);
    emitter.on('error', onError);
    emitter.on('end', onEnd);
  } catch (error) {
    console.error(`Error while <runRenderingSubtitles> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};

ipcMain.on('create-vtt', async (event, vtt) => {
  try {
    await createVtt(vtt);
  } catch (error) {
    console.error(`Error while <ipcMain.on('create-vtt')> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
});


ipcMain.on('render-vtt', async (event, vtt) => {
  try {
    await createVtt(vtt);
    await runRenderingSubtitles();
  } catch (error) {
    console.error(`Error while <ipcMain.on('render-vtt')> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
});

ipcMain.on('check-rendering', (event, request) => {
  onRendersChanged();
});


