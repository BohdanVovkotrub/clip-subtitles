const os = require('os');
const { exec } = require('child_process');
const path = require('path');
const { EventEmitter } = require('node:events');

const currentScript = `./SubtitlesApp.mjs`;


const checkIsNVIDIA = async () => {
  try {
    const checkByWmic = () => {
      return new Promise((resolve) => {
        exec('wmic path win32_videocontroller get caption', (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing command: ${error.message}`);
            return resolve(false);
          };
          if (stderr) {
            console.error(`Command execution returned an error: ${stderr}`)
            return resolve(false);
          };
          const isNVIDIA = /\bNVIDIA\b/gmi.test(stdout);
          resolve(isNVIDIA);
        });
      });
    };
    const checkByLSPCI = () => {
      return new Promise((resolve) => {
        exec('lspci | grep -i nvidia', (error, stdout, stderr) => {
          if (!error && !stderr) {
            const isNVIDIA = stdout.toLowerCase().includes('nvidia');
            resolve(isNVIDIA);
          } else {
            resolve(false);
          };
        });
      });
    };
    let isNVIDIA = false;
    if (os.platform() === 'win32') {
      isNVIDIA = await checkByWmic();
    };
    if (os.platform() === 'linux') {
      isNVIDIA = await checkByLSPCI();
    };
    return isNVIDIA;
  } catch (error) {
    console.error(`Error while <checkIsNVIDIA> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};

const timestringToSeconds = (timeString = `00:00:00.000`) => {
  try {
    const [hours, minutes, secondsWithMillis] = timeString.split(':');
    const [seconds, milliseconds] = (secondsWithMillis || '0').split('.');

    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);
    const secondsNum = parseInt(seconds, 10);
    const millisecondsNum = parseInt(milliseconds, 10) || 0;

    const totalSeconds = hoursNum * 3600 + minutesNum * 60 + secondsNum;
    const floatingSeconds = totalSeconds + millisecondsNum / 1000;

    return floatingSeconds;
  } catch (error) {
    console.error(`Error while <timcodeToSeconds> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};

const getClipDuration = (ffprobePath = 'ffprobe', fileFullpath, inSexagesimal = false) => {
  try {
    let command = `"${ffprobePath}" -i "${fileFullpath}" -show_entries format=duration -v quiet -of csv="p=0"`;
    if (inSexagesimal === true) command += '-sexagesimal';
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (!error && !stderr) {
          const duration = Number(stdout);
          if (duration === NaN) reject(`Cannot get duration. Duration is NaN.`);
          resolve(duration);
        };
        reject(error || stderr);
      })
    });
  } catch (error) {
    console.error(`Error while <getClipDuration> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};

const renderSubtitles = async (ffmpegPath = 'ffmpeg', dirname, inFilenameExt, inSubtitles, outFilename, duration = undefined) => {
  try {
    const isNVIDIA = await checkIsNVIDIA();
    const useNVIDIA = process.env.USE_NVIDIA == true;
    const cpuCodec = process.env.FORCE_H264 == true ? `-c:v libx264` : ``;
    const emitter = new EventEmitter();
    const outputOptions = isNVIDIA === true && useNVIDIA === true ? `-c:v h264_nvenc -preset fast` : cpuCodec;
    const outExtention = isNVIDIA === true ? `.mp4` : path.extname(inFilenameExt);
    const outFilenameExt = `${outFilename}${outExtention}`;
    const command =  os.platform() === 'win32' //,Fontname=Arial,Fontsize=10,Alignment=2
      ? `powershell -Command "cd '${dirname}'; ${ffmpegPath} -i ${inFilenameExt} -vf 'subtitles=${inSubtitles}:force_style=''OutlineColour=&HFFFFFFFF,BorderStyle=4,BackColour=&H80000000,Outline=6,Shadow=0,MarginV=10''' ${outputOptions} ${outFilenameExt} -y -loglevel error -stats"`
      : `cd "${dirname}" && "${ffmpegPath}" -i "${inFilenameExt}" -vf "subtitles=${inSubtitles}:force_style='OutlineColour=&HFFFFFFFF,BorderStyle=4,BackColour=&H80000000,Outline=6,Shadow=0,MarginV=10'" ${outputOptions} "${outFilenameExt}" -y -loglevel quiet -stats`;
    const encoding = exec(command);
    encoding.stdout.on('data', (data) => console.log('stdout:', data));
    encoding.stderr.on('data', (data) => {
      
      const timeMatch = data.match(/time=(\d{2}:\d{2}:\d{2}.\d+)/);
      if (!!timeMatch && timeMatch.length > 0) {
        const timeString = timeMatch[1];
        const currentTime = timestringToSeconds(timeString);
        const percentage = duration === undefined ? `0%` : `${parseInt(currentTime * 100 / duration)}%`;
        emitter.emit('progress', { currentTime, percentage });
      } else {
        console.error('stderr: '+data)
      };
    });
    encoding.on('error', (error) => emitter.emit('error', error));
    encoding.on('exit', (code, signal) => emitter.emit('end'));
    return {emitter, encoding };
  } catch (error) {
    console.error(`Error while <renderSubtitles> in file <${currentScript}>. Details: ${error.message}.`);
    throw error;
  };
};



module.exports = {
  renderSubtitles,
  getClipDuration,
};