import { WebVTTParser, WebVTTSerializer, Cue } from './webvtt-parser-esm/parser.mjs';

const enableBootstrapTooltips = () => {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  });
};

document.addEventListener('DOMContentLoaded', () => {
  enableBootstrapTooltips();
  const SUBTITLES = [];
  window.currentFilepath = '';
  const vttParser = new WebVTTParser();
  const vttSerializer = new WebVTTSerializer();

  const buttonReloadPage = document.querySelector('#reload-page');
  const buttonViewMyRenders = document.querySelector('#btn-view-my-renders');
  

  const dropzone = document.querySelector('.drop-area');
  const fileInput = dropzone.querySelector('input');
  const previewWrapper = document.querySelector('.preview');
  const buttonAddTimecode = document.querySelector('.add-timecode');
  const subtitlesInput = document.querySelector('.subtitles-input');
  const buttonCreateVtt = document.querySelector('.btn-create-vtt');
  const buttonRender = document.querySelector('.btn-render');

  const onFileSelected = (file) => {
    window.currentFilepath = file.path;
    ipcRenderer.send('file-dropped', window.currentFilepath);
    createVideoPlayer(window.currentFilepath);
    console.log(window.currentFilepath)
  };

  const onDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onFileSelected(event.dataTransfer.files[0]);
  };

  const openFileSelector = () => {
    onFileSelected(fileInput.files[0]);
  };

  const createVideoPlayer = (filepath = ``) => {
    while (previewWrapper.firstChild) {
      previewWrapper.firstChild.remove();
    };

    const videoPlayer = document.createElement('video');
    videoPlayer.src = `file://${filepath}`;
    videoPlayer.load();
    videoPlayer.controls = true;

    previewWrapper.append(videoPlayer);
  };

  const createHtmlTimecode = () => {
    const timecodeContainer = document.createElement('div');
    timecodeContainer.classList.add('row', 'm-2', 'px-3', 'py-2', 'timecode');
    const createInput = (maxValue = 0, currentValue = '00', placeholder = '', tooltipTitle = '') => {
      const inputContainer = document.createElement('div');
      inputContainer.classList.add('col', 'p-0', 'mx-1');
      const inputElement = document.createElement('input');
      inputElement.classList.add('form-control', 'form-control-sm');
      inputElement.type = 'number';
      inputElement.min = 0;
      inputElement.max = maxValue;
      inputElement.step = 1;
      inputElement.value = currentValue;
      inputElement.placeholder = placeholder;
      inputElement.setAttribute('data-bs-toggle', 'tooltip');
      inputElement.setAttribute('data-bs-placement', 'top');
      inputElement.setAttribute('data-bs-title', tooltipTitle);

      inputContainer.append(inputElement)
      return {inputContainer, inputElement};
    };  
    const hoursInput= createInput(99, '00', 'HH', 'Hours (HH)');
    const minutesInput = createInput(59, '00', 'MM', 'Minutes (MM)');
    const secondsInput = createInput(59, '00', 'SS', 'Seconds (SS)');
    const millisecondsInput = createInput(999, '000', 'SSS', 'Milliseconds (SSS)');
    timecodeContainer.append(hoursInput.inputContainer);
    timecodeContainer.append(minutesInput.inputContainer);
    timecodeContainer.append(secondsInput.inputContainer);
    timecodeContainer.append(millisecondsInput.inputContainer);
    return { 
      timecodeContainer, 
      hoursInput: hoursInput.inputElement, 
      minutesInput: minutesInput.inputElement, 
      secondsInput: secondsInput.inputElement,
      millisecondsInput: millisecondsInput.inputElement,
    };
  };
  const createButtonRemoveSelf = () => {
    const buttonRemoveSelf = document.createElement('div');
    buttonRemoveSelf.classList.add('remove-self');
    buttonRemoveSelf.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    buttonRemoveSelf.setAttribute('data-bs-toggle', 'tooltip');
    buttonRemoveSelf.setAttribute('data-bs-placement', 'top');
    buttonRemoveSelf.setAttribute('data-bs-title', `Remove Cue`);

    return buttonRemoveSelf;
  }
  const createVttTimecode = () => {
    const buttonRemoveSelf = createButtonRemoveSelf();
    const timecodeIN = createHtmlTimecode();
    const timecodeOUT = createHtmlTimecode();
    const timecodeVttContainer = document.createElement('div')
    timecodeVttContainer.classList.add('d-flex', 'justify-content-start');
    timecodeVttContainer.append(timecodeIN.timecodeContainer);
    timecodeVttContainer.append(timecodeOUT.timecodeContainer);
    timecodeVttContainer.append(buttonRemoveSelf);

    return { timecodeVttContainer, timecodeIN, timecodeOUT, buttonRemoveSelf };
  };

  const createVttCueInput = () => {
    const vttCueInput = document.createElement('textarea');
    vttCueInput.classList.add('form-control', 'cue-input', 'm-3');
    vttCueInput.placeholder = 'Input cue text...';
    return vttCueInput;
  };

  const timeStringToSeconds = (timeString) => {
    const [hours, minutes, secondsWithMillis] = timeString.split(':');
    const [seconds, milliseconds] = (secondsWithMillis || '0').split('.');
  
    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);
    const secondsNum = parseInt(seconds, 10);
    const millisecondsNum = parseInt(milliseconds, 10) || 0;
  
    const totalSeconds = hoursNum * 3600 + minutesNum * 60 + secondsNum;
    const floatingSeconds = totalSeconds + millisecondsNum / 1000;
  
    return floatingSeconds;
  };

  const addCue = () => {
    const cue = new Cue();
    cue.tree = { children: [{ type: 'text', value: cue.text }] };
    SUBTITLES.push(cue);
    const cueWrapper = document.createElement('div');
    cueWrapper.classList.add('cue');
    const timecodeVTT = createVttTimecode();
    const vttCueInput = createVttCueInput();

    const IN_hoursInput = timecodeVTT.timecodeIN.hoursInput;
    const IN_minutesInput = timecodeVTT.timecodeIN.minutesInput;
    const IN_secondsInput = timecodeVTT.timecodeIN.secondsInput;
    const IN_millisecondsInput = timecodeVTT.timecodeIN.millisecondsInput;
    const OUT_hoursInput = timecodeVTT.timecodeOUT.hoursInput;
    const OUT_minutesInput = timecodeVTT.timecodeOUT.minutesInput;
    const OUT_secondsInput = timecodeVTT.timecodeOUT.secondsInput;
    const OUT_millisecondsInput = timecodeVTT.timecodeOUT.millisecondsInput;
    const buttonRemoveSelf = timecodeVTT.buttonRemoveSelf;

    const setTimeStart = (HH='00', MM='00', SS='00', SSS='000') => {
      const startTimeStr = `${HH}:${MM}:${SS}.${SSS}`;
      const floatingSeconds = timeStringToSeconds(startTimeStr);
      cue.startTime = floatingSeconds;
      cue.startTimeStr = startTimeStr;
    };
    const setTimeEnd = (HH='00', MM='00', SS='00', SSS='000') => {
      const endTimeStr = `${HH}:${MM}:${SS}.${SSS}`;
      const floatingSeconds = timeStringToSeconds(endTimeStr);
      cue.endTime = floatingSeconds;
      cue.endTimeStr = endTimeStr;
    };
    const setCueText = () => {
      cue.text = vttCueInput.value;
      cue.tree.children[0].value = cue.text;
    };

    const removeSelf = () => {
      const idx = SUBTITLES.findIndex(cue => cue === cue);
      SUBTITLES.splice(idx, 1);
      cueWrapper.remove();
    };

    IN_hoursInput.addEventListener('input', () => {
      IN_hoursInput.value = ('00' + String(IN_hoursInput.value)).slice(-2);
      setTimeStart(IN_hoursInput.value, IN_minutesInput.value, IN_secondsInput.value, IN_millisecondsInput.value);
    });
    IN_minutesInput.addEventListener('input', () => {
      IN_minutesInput.value = ('00' + String(IN_minutesInput.value)).slice(-2);
      setTimeStart(IN_hoursInput.value, IN_minutesInput.value, IN_secondsInput.value, IN_millisecondsInput.value);
    });
    IN_secondsInput.addEventListener('input', () => {
      IN_secondsInput.value = ('00' + String(IN_secondsInput.value)).slice(-2);
      setTimeStart(IN_hoursInput.value, IN_minutesInput.value, IN_secondsInput.value, IN_millisecondsInput.value);
    });
    IN_millisecondsInput.addEventListener('input', () => {
      IN_millisecondsInput.value = ('000' + String(IN_millisecondsInput.value)).slice(-3);
      setTimeStart(IN_hoursInput.value, IN_minutesInput.value, IN_secondsInput.value, IN_millisecondsInput.value);
    });

    OUT_hoursInput.addEventListener('input', () => {
      OUT_hoursInput.value = ('00' + String(OUT_hoursInput.value)).slice(-2);
      setTimeEnd(OUT_hoursInput.value, OUT_minutesInput.value, OUT_secondsInput.value, OUT_millisecondsInput.value);
    });
    OUT_minutesInput.addEventListener('input', () => {
      OUT_minutesInput.value = ('00' + String(OUT_minutesInput.value)).slice(-2);
      setTimeEnd(OUT_hoursInput.value, OUT_minutesInput.value, OUT_secondsInput.value, OUT_millisecondsInput.value);
    });
    OUT_secondsInput.addEventListener('input', () => {
      OUT_secondsInput.value = ('00' + String(OUT_secondsInput.value)).slice(-2);
      setTimeEnd(OUT_hoursInput.value, OUT_minutesInput.value, OUT_secondsInput.value, OUT_millisecondsInput.value);
    });
    OUT_millisecondsInput.addEventListener('input', () => {
      OUT_millisecondsInput.value = ('000' + String(OUT_millisecondsInput.value)).slice(-3);
      setTimeEnd(OUT_hoursInput.value, OUT_minutesInput.value, OUT_secondsInput.value, OUT_millisecondsInput.value);
    });

    vttCueInput.addEventListener('input', setCueText);
    buttonRemoveSelf.addEventListener('click', removeSelf);

    cueWrapper.append(timecodeVTT.timecodeVttContainer);
    cueWrapper.append(vttCueInput);
    subtitlesInput.append(cueWrapper);
  };

  const render = () => {
    const vtt = vttSerializer.serialize(SUBTITLES);
    ipcRenderer.send('render-vtt', vtt);
    buttonRender.classList.add('is-rendering');
    buttonRender.disabled = true;
  };

  const createVtt = () => {
    const vtt = vttSerializer.serialize(SUBTITLES);
    ipcRenderer.send('create-vtt', vtt);
    buttonCreateVtt.classList.add('is-rendering');
    buttonCreateVtt.disabled = true;
    setTimeout(() => {
      buttonCreateVtt.classList.remove('is-rendering');
      buttonCreateVtt.disabled = false;
    }, 1.5 * 1000);
  };

  dropzone.addEventListener('drop', onDrop);
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  dropzone.addEventListener('click', (event) => {
    fileInput.click();
  });
  fileInput.addEventListener('change', openFileSelector);
  buttonAddTimecode.addEventListener('click', addCue);
  buttonRender.addEventListener('click', render);
  buttonCreateVtt.addEventListener('click', createVtt);

  buttonReloadPage.addEventListener('click', () => setTimeout(() => location.reload(), 200));

  const checkRendering = () => {
    ipcRenderer.send('check-rendering');
  };
  buttonViewMyRenders.addEventListener('click', checkRendering);
});